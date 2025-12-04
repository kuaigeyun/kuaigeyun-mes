"""
数据集管理服务模块

提供数据集的 CRUD 操作和查询执行功能。
"""

import time
import httpx
from typing import Dict, Any, Optional, List
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from core.models.dataset import Dataset
from core.models.data_source import DataSource
from core.models.api import API
from core.schemas.dataset import DatasetCreate, DatasetUpdate, ExecuteQueryRequest, ExecuteQueryResponse
from infra.exceptions.exceptions import NotFoundError, ValidationError


class DatasetService:
    """
    数据集管理服务类
    
    提供数据集的 CRUD 操作和查询执行功能。
    """
    
    async def create_dataset(
        self,
        tenant_id: int,
        dataset_data: DatasetCreate,
    ) -> Dataset:
        """
        创建数据集
        
        Args:
            tenant_id: 组织ID
            dataset_data: 数据集创建数据
            
        Returns:
            Dataset: 创建的数据集对象
            
        Raises:
            ValidationError: 数据集代码已存在或数据源不存在
        """
        # 检查数据集代码是否已存在
        existing_dataset = await Dataset.filter(
            tenant_id=tenant_id,
            code=dataset_data.code,
            deleted_at__isnull=True,
        ).first()
        
        if existing_dataset:
            raise ValidationError(f"数据集代码 '{dataset_data.code}' 已存在")
        
        # 获取数据源
        data_source = await DataSource.filter(
            tenant_id=tenant_id,
            uuid=dataset_data.data_source_uuid,
            deleted_at__isnull=True,
        ).first()
        
        if not data_source:
            raise ValidationError(f"数据源不存在: {dataset_data.data_source_uuid}")
        
        # 如果查询类型为 'api'，验证接口管理中的 API 是否存在
        if dataset_data.query_type == 'api':
            query_config = dataset_data.query_config
            api_uuid = query_config.get('api_uuid') if isinstance(query_config, dict) else None
            api_code = query_config.get('api_code') if isinstance(query_config, dict) else None
            
            if api_uuid or api_code:
                from core.services.api_service import APIService
                api_service = APIService()
                
                if api_uuid:
                    try:
                        api = await api_service.get_api_by_uuid(tenant_id, api_uuid)
                        if not api.is_active:
                            raise ValidationError(f"接口 {api_uuid} 未启用")
                    except NotFoundError:
                        raise ValidationError(f"接口不存在: {api_uuid}")
                elif api_code:
                    api = await API.filter(
                        tenant_id=tenant_id,
                        code=api_code,
                        deleted_at__isnull=True,
                        is_active=True
                    ).first()
                    if not api:
                        raise ValidationError(f"接口不存在或未启用: {api_code}")
        
        # 创建数据集
        dataset = await Dataset.create(
            tenant_id=tenant_id,
            data_source_id=data_source.id,
            **dataset_data.model_dump(exclude={'data_source_uuid'}),
        )
        
        return dataset
    
    async def get_dataset_by_uuid(
        self,
        tenant_id: int,
        dataset_uuid: UUID,
    ) -> Dataset:
        """
        根据 UUID 获取数据集
        
        Args:
            tenant_id: 组织ID
            dataset_uuid: 数据集UUID
            
        Returns:
            Dataset: 数据集对象
            
        Raises:
            NotFoundError: 数据集不存在
        """
        dataset = await Dataset.filter(
            tenant_id=tenant_id,
            uuid=dataset_uuid,
            deleted_at__isnull=True,
        ).prefetch_related('data_source').first()
        
        if not dataset:
            raise NotFoundError(f"数据集不存在: {dataset_uuid}")
        
        return dataset
    
    async def list_datasets(
        self,
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        query_type: Optional[str] = None,
        data_source_uuid: Optional[UUID] = None,
        is_active: Optional[bool] = None,
    ) -> tuple[List[Dataset], int]:
        """
        获取数据集列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            search: 搜索关键词（名称、代码）
            query_type: 查询类型筛选
            data_source_uuid: 数据源UUID筛选
            is_active: 是否启用筛选
            
        Returns:
            tuple[List[Dataset], int]: (数据集列表, 总数)
        """
        query = Dataset.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        
        # 搜索条件（优化：使用 OR 查询）
        if search:
            from tortoise.expressions import Q
            query = query.filter(
                Q(name__icontains=search) |
                Q(code__icontains=search)
            )
        
        # 查询类型筛选
        if query_type:
            query = query.filter(query_type=query_type)
        
        # 数据源筛选
        if data_source_uuid:
            data_source = await DataSource.filter(
                tenant_id=tenant_id,
                uuid=data_source_uuid,
                deleted_at__isnull=True,
            ).first()
            if data_source:
                query = query.filter(data_source_id=data_source.id)
        
        # 启用状态筛选
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        # 优化分页查询：先查询总数，再查询数据
        total = await query.count()
        
        # 限制分页大小，避免过大查询
        if page_size > 100:
            page_size = 100
        
        # 分页查询（使用索引字段排序，预加载关联数据）
        offset = (page - 1) * page_size
        datasets = await query.prefetch_related('data_source').order_by("-created_at").offset(offset).limit(page_size).all()
        
        return datasets, total
    
    async def update_dataset(
        self,
        tenant_id: int,
        dataset_uuid: UUID,
        dataset_data: DatasetUpdate,
    ) -> Dataset:
        """
        更新数据集
        
        Args:
            tenant_id: 组织ID
            dataset_uuid: 数据集UUID
            dataset_data: 数据集更新数据
            
        Returns:
            Dataset: 更新后的数据集对象
            
        Raises:
            NotFoundError: 数据集不存在
            ValidationError: 数据集代码已存在
        """
        # 获取数据集
        dataset = await self.get_dataset_by_uuid(tenant_id, dataset_uuid)
        
        # 如果更新了代码，检查是否重复
        if dataset_data.code and dataset_data.code != dataset.code:
            existing_dataset = await Dataset.filter(
                tenant_id=tenant_id,
                code=dataset_data.code,
                deleted_at__isnull=True,
            ).exclude(uuid=dataset_uuid).first()
            
            if existing_dataset:
                raise ValidationError(f"数据集代码 '{dataset_data.code}' 已存在")
        
        # 如果查询类型为 'api'，验证接口管理中的 API 是否存在
        if dataset_data.query_type == 'api' or (not dataset_data.query_type and dataset.query_type == 'api'):
            query_config = dataset_data.query_config if dataset_data.query_config else dataset.query_config
            api_uuid = query_config.get('api_uuid') if isinstance(query_config, dict) else None
            api_code = query_config.get('api_code') if isinstance(query_config, dict) else None
            
            if api_uuid or api_code:
                from core.services.api_service import APIService
                api_service = APIService()
                
                if api_uuid:
                    try:
                        api = await api_service.get_api_by_uuid(tenant_id, api_uuid)
                        if not api.is_active:
                            raise ValidationError(f"接口 {api_uuid} 未启用")
                    except NotFoundError:
                        raise ValidationError(f"接口不存在: {api_uuid}")
                elif api_code:
                    api = await API.filter(
                        tenant_id=tenant_id,
                        code=api_code,
                        deleted_at__isnull=True,
                        is_active=True
                    ).first()
                    if not api:
                        raise ValidationError(f"接口不存在或未启用: {api_code}")
        
        # 记录变更前的状态
        old_is_active = dataset.is_active
        old_query_config = dataset.query_config
        
        # 更新数据集
        update_data = dataset_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(dataset, key, value)
        
        await dataset.save()
        
        # 如果数据集状态或配置变更，异步通知业务模块
        if (dataset_data.is_active is not None and old_is_active != dataset.is_active) or \
           (dataset_data.query_config and old_query_config != dataset.query_config):
            import asyncio
            asyncio.create_task(
                DatasetService._notify_business_modules(
                    tenant_id=tenant_id,
                    dataset_code=dataset.code,
                    is_active=dataset.is_active,
                    config_changed=(dataset_data.query_config and old_query_config != dataset.query_config)
                )
            )
        
        return dataset
    
    async def delete_dataset(
        self,
        tenant_id: int,
        dataset_uuid: UUID,
    ) -> None:
        """
        删除数据集（软删除）
        
        Args:
            tenant_id: 组织ID
            dataset_uuid: 数据集UUID
            
        Raises:
            NotFoundError: 数据集不存在
        """
        # 获取数据集
        dataset = await self.get_dataset_by_uuid(tenant_id, dataset_uuid)
        
        # 记录数据集代码（用于通知）
        dataset_code = dataset.code
        
        # 软删除
        dataset.deleted_at = datetime.now()
        await dataset.save()
        
        # 异步通知业务模块数据集已被删除
        import asyncio
        asyncio.create_task(
            DatasetService._notify_business_modules(
                tenant_id=tenant_id,
                dataset_code=dataset_code,
                is_active=False,
                is_deleted=True
            )
        )
    
    async def execute_query(
        self,
        tenant_id: int,
        dataset_uuid: UUID,
        execute_request: ExecuteQueryRequest,
    ) -> ExecuteQueryResponse:
        """
        执行数据集查询
        
        Args:
            tenant_id: 组织ID
            dataset_uuid: 数据集UUID
            execute_request: 执行查询请求
            
        Returns:
            ExecuteQueryResponse: 查询结果
            
        Raises:
            NotFoundError: 数据集不存在
        """
        # 获取数据集
        dataset = await self.get_dataset_by_uuid(tenant_id, dataset_uuid)
        
        # 获取数据源
        await dataset.fetch_related('data_source')
        data_source = dataset.data_source
        
        if not data_source.is_connected:
            return ExecuteQueryResponse(
                success=False,
                data=[],
                total=None,
                columns=None,
                elapsed_time=0.0,
                error='数据源未连接，请先测试连接',
            )
        
        start_time = time.time()
        
        try:
            # 根据查询类型执行查询
            if dataset.query_type == 'sql':
                result = await self._execute_sql_query(
                    data_source=data_source,
                    query_config=dataset.query_config,
                    parameters=execute_request.parameters,
                    limit=execute_request.limit,
                    offset=execute_request.offset,
                )
            elif dataset.query_type == 'api':
                result = await self._execute_api_query(
                    tenant_id=tenant_id,
                    data_source=data_source,
                    query_config=dataset.query_config,
                    parameters=execute_request.parameters,
                    limit=execute_request.limit,
                    offset=execute_request.offset,
                )
            else:
                result = {
                    'success': False,
                    'data': [],
                    'total': None,
                    'columns': None,
                    'error': f'不支持的查询类型: {dataset.query_type}',
                }
            
            elapsed_time = time.time() - start_time
            
            # 更新执行状态
            dataset.last_executed_at = datetime.now()
            if not result['success']:
                dataset.last_error = result.get('error', '查询执行失败')
            else:
                dataset.last_error = None
            await dataset.save()
            
            return ExecuteQueryResponse(
                success=result['success'],
                data=result.get('data', []),
                total=result.get('total'),
                columns=result.get('columns'),
                elapsed_time=round(elapsed_time, 3),
                error=result.get('error'),
            )
        except Exception as e:
            elapsed_time = time.time() - start_time
            
            # 更新执行状态
            dataset.last_executed_at = datetime.now()
            dataset.last_error = str(e)
            await dataset.save()
            
            return ExecuteQueryResponse(
                success=False,
                data=[],
                total=None,
                columns=None,
                elapsed_time=round(elapsed_time, 3),
                error=f'查询执行异常: {str(e)}',
            )
    
    async def _execute_sql_query(
        self,
        data_source: DataSource,
        query_config: Dict[str, Any],
        parameters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        执行 SQL 查询
        
        Args:
            data_source: 数据源对象
            query_config: 查询配置
            parameters: 查询参数
            limit: 限制返回行数
            offset: 偏移量
            
        Returns:
            Dict[str, Any]: 查询结果
        """
        try:
            # 仅支持 PostgreSQL（使用 Tortoise ORM）
            if data_source.type != 'postgresql':
                return {
                    'success': False,
                    'data': [],
                    'total': None,
                    'columns': None,
                    'error': f'SQL 查询暂仅支持 PostgreSQL，当前数据源类型: {data_source.type}',
                }
            
            # 获取 SQL 语句
            sql = query_config.get('sql', '')
            if not sql:
                return {
                    'success': False,
                    'data': [],
                    'total': None,
                    'columns': None,
                    'error': 'SQL 语句不能为空',
                }
            
            # 验证 SQL 语句（仅允许 SELECT）
            sql_upper = sql.strip().upper()
            if not sql_upper.startswith('SELECT'):
                return {
                    'success': False,
                    'data': [],
                    'total': None,
                    'columns': None,
                    'error': '仅支持 SELECT 查询，禁止执行 DDL、DML 语句',
                }
            
            # 合并查询参数
            query_params = query_config.get('parameters', {})
            if parameters:
                query_params.update(parameters)
            
            # 添加 LIMIT 和 OFFSET
            if 'LIMIT' not in sql_upper:
                sql = f"{sql} LIMIT {limit} OFFSET {offset}"
            
            # 执行查询（使用 Tortoise ORM 的原始 SQL 查询）
            from tortoise import connections
            from tortoise.backends.asyncpg.client import AsyncpgDBClient
            
            # 构建连接配置
            config = data_source.config
            host = config.get('host', 'localhost')
            port = config.get('port', 5432)
            database = config.get('database', '')
            user = config.get('username', '')
            password = config.get('password', '')
            
            # 创建临时连接
            db_client = AsyncpgDBClient(
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
            )
            
            await db_client.create_connection()
            
            # 执行查询
            rows = await db_client.execute_query(sql, query_params if query_params else None)
            
            # 获取列信息
            columns = list(rows[0].keys()) if rows else []
            
            # 转换为字典列表
            data = [dict(row) for row in rows]
            
            await db_client.close()
            
            return {
                'success': True,
                'data': data,
                'total': len(data),  # 简化实现，实际应该执行 COUNT 查询
                'columns': columns,
            }
        except Exception as e:
            return {
                'success': False,
                'data': [],
                'total': None,
                'columns': None,
                'error': f'SQL 查询执行失败: {str(e)}',
            }
    
    async def _execute_api_query(
        self,
        tenant_id: int,
        data_source: DataSource,
        query_config: Dict[str, Any],
        parameters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        执行 API 查询
        
        支持两种方式：
        1. 从接口管理获取 API 配置（如果 query_config 中包含 api_uuid 或 api_code）
        2. 从数据源获取 API 配置（传统方式）
        
        Args:
            tenant_id: 组织ID
            data_source: 数据源对象
            query_config: 查询配置
            parameters: 查询参数
            limit: 限制返回行数
            offset: 偏移量
            
        Returns:
            Dict[str, Any]: 查询结果
        """
        try:
            # 优先从接口管理获取 API 配置
            api_uuid = query_config.get('api_uuid')
            api_code = query_config.get('api_code')
            
            if api_uuid or api_code:
                # 从接口管理获取 API 配置
                from core.services.api_service import APIService
                api_service = APIService()
                
                if api_uuid:
                    try:
                        api = await api_service.get_api_by_uuid(tenant_id, api_uuid)
                    except NotFoundError:
                        return {
                            'success': False,
                            'data': [],
                            'total': None,
                            'columns': None,
                            'error': f'接口不存在: {api_uuid}',
                        }
                elif api_code:
                    # 根据代码获取接口
                    api = await API.filter(
                        tenant_id=tenant_id,
                        code=api_code,
                        deleted_at__isnull=True,
                        is_active=True
                    ).first()
                    
                    if not api:
                        return {
                            'success': False,
                            'data': [],
                            'total': None,
                            'columns': None,
                            'error': f'接口不存在或未启用: {api_code}',
                        }
                
                # 使用接口管理的配置
                url = api.path
                if not url.startswith("http://") and not url.startswith("https://"):
                    # 相对路径，需要添加基础URL
                    from infra.config.platform_config import platform_settings as settings
                    base_url = getattr(settings, "BASE_URL", "http://localhost:8000")
                    url = f"{base_url}{url}"
                
                method = api.method.upper()
                
                # 合并请求头（接口定义的请求头优先，query_config 中的请求头可以覆盖）
                headers = api.request_headers or {}
                if query_config.get('headers'):
                    headers.update(query_config.get('headers', {}))
                
                # 合并请求参数（query_config 中的参数优先）
                params = api.request_params or {}
                if query_config.get('params'):
                    params.update(query_config.get('params', {}))
                if parameters:
                    params.update(parameters)
                
                # 合并请求体（query_config 中的请求体优先）
                body = api.request_body or {}
                if query_config.get('body'):
                    body.update(query_config.get('body', {}))
                
                # 添加分页参数
                params['limit'] = limit
                params['offset'] = offset
                
            else:
                # 传统方式：从数据源获取 API 配置
                if data_source.type != 'api':
                    return {
                        'success': False,
                        'data': [],
                        'total': None,
                        'columns': None,
                        'error': f'API 查询需要 API 类型数据源，当前数据源类型: {data_source.type}',
                    }
                
                # 获取 API 配置
                base_url = data_source.config.get('base_url', '')
                endpoint = query_config.get('endpoint', '')
                method = query_config.get('method', 'GET').upper()
                
                if not base_url or not endpoint:
                    return {
                        'success': False,
                        'data': [],
                        'total': None,
                        'columns': None,
                        'error': 'API base_url 和 endpoint 不能为空',
                    }
                
                # 构建完整 URL
                url = f"{base_url}{endpoint}"
                
                # 构建请求头
                headers = data_source.config.get('headers', {})
                if data_source.config.get('auth_type') == 'bearer' and data_source.config.get('token'):
                    headers['Authorization'] = f"Bearer {data_source.config['token']}"
                
                # 合并查询参数
                params = query_config.get('params', {})
                if parameters:
                    params.update(parameters)
                
                # 添加分页参数
                params['limit'] = limit
                params['offset'] = offset
                
                # 请求体
                body = query_config.get('body', {})
            
            # 执行请求
            async with httpx.AsyncClient(timeout=30.0) as client:
                if method == 'GET':
                    response = await client.get(url, headers=headers, params=params)
                elif method == 'POST':
                    response = await client.post(url, headers=headers, params=params, json=body)
                elif method == 'PUT':
                    response = await client.put(url, headers=headers, params=params, json=body)
                elif method == 'DELETE':
                    response = await client.delete(url, headers=headers, params=params)
                elif method == 'PATCH':
                    response = await client.patch(url, headers=headers, params=params, json=body)
                else:
                    return {
                        'success': False,
                        'data': [],
                        'total': None,
                        'columns': None,
                        'error': f'不支持的 HTTP 方法: {method}',
                    }
                
                if response.status_code >= 400:
                    return {
                        'success': False,
                        'data': [],
                        'total': None,
                        'columns': None,
                        'error': f'API 请求失败，状态码: {response.status_code}',
                    }
                
                # 解析响应
                try:
                    response_data = response.json()
                except Exception:
                    response_data = {'data': response.text}
                
                # 提取数据（支持多种响应格式）
                if isinstance(response_data, list):
                    data = response_data
                elif isinstance(response_data, dict):
                    if 'data' in response_data:
                        data = response_data['data'] if isinstance(response_data['data'], list) else [response_data['data']]
                    elif 'items' in response_data:
                        data = response_data['items']
                    else:
                        data = [response_data]
                else:
                    data = []
                
                # 限制返回行数
                data = data[offset:offset + limit]
                
                # 获取列信息
                columns = list(data[0].keys()) if data and isinstance(data[0], dict) else []
                
                return {
                    'success': True,
                    'data': data,
                    'total': len(data),
                    'columns': columns,
                }
        except httpx.TimeoutException:
            return {
                'success': False,
                'data': [],
                'total': None,
                'columns': None,
                'error': 'API 请求超时',
            }
        except Exception as e:
            return {
                'success': False,
                'data': [],
                'total': None,
                'columns': None,
                'error': f'API 查询执行失败: {str(e)}',
            }
    
    async def test_api_for_dataset(
        self,
        tenant_id: int,
        dataset_uuid: UUID,
        test_parameters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        使用接口管理的测试功能测试数据集关联的 API
        
        Args:
            tenant_id: 组织ID
            dataset_uuid: 数据集UUID
            test_parameters: 测试参数（可选，覆盖数据集定义的参数）
            
        Returns:
            Dict[str, Any]: 测试结果
            {
                "status_code": 200,
                "headers": {...},
                "body": {...},
                "elapsed_time": 0.123
            }
            
        Raises:
            NotFoundError: 数据集不存在
            ValidationError: 数据集查询类型不是 'api' 或未关联接口管理
        """
        # 获取数据集
        dataset = await self.get_dataset_by_uuid(tenant_id, dataset_uuid)
        
        if dataset.query_type != 'api':
            raise ValidationError("数据集查询类型不是 'api'，无法使用接口管理测试功能")
        
        # 获取关联的 API
        query_config = dataset.query_config
        api_uuid = query_config.get('api_uuid') if isinstance(query_config, dict) else None
        api_code = query_config.get('api_code') if isinstance(query_config, dict) else None
        
        if not api_uuid and not api_code:
            raise ValidationError("数据集未关联接口管理中的 API（query_config 中缺少 api_uuid 或 api_code）")
        
        # 从接口管理获取 API
        from core.services.api_service import APIService
        from core.schemas.api import APITestRequest
        api_service = APIService()
        
        if api_uuid:
            api = await api_service.get_api_by_uuid(tenant_id, api_uuid)
        elif api_code:
            api = await API.filter(
                tenant_id=tenant_id,
                code=api_code,
                deleted_at__isnull=True,
                is_active=True
            ).first()
            if not api:
                raise NotFoundError(f"接口不存在或未启用: {api_code}")
        
        # 构建测试请求
        test_request = APITestRequest(
            headers=query_config.get('headers') if isinstance(query_config, dict) else None,
            params=test_parameters if test_parameters else (query_config.get('params') if isinstance(query_config, dict) else None),
            body=query_config.get('body') if isinstance(query_config, dict) else None,
        )
        
        # 调用接口管理的测试功能
        test_result = await api_service.test_api(
            tenant_id=tenant_id,
            api_uuid=api.uuid,
            test_request=test_request,
        )
        
        return test_result
    
    @staticmethod
    async def _notify_datasets_of_data_source_change(
        tenant_id: int,
        data_source_code: str,
        is_active: bool = True,
        is_deleted: bool = False,
        config_changed: bool = False
    ) -> None:
        """
        通知数据集管理数据源变更（预留接口）
        
        此方法用于在数据源变更或删除时，触发后续的业务逻辑，
        例如更新关联数据集的连接状态、重新验证查询配置等。
        目前仅为预留接口，不执行任何实际操作。
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(
            f"Data source '{data_source_code}' in tenant {tenant_id} changed. "
            f"Active: {is_active}, Deleted: {is_deleted}, Config changed: {config_changed}"
        )
        
        # 如果数据源被删除或禁用，可以更新关联数据集的错误信息
        if is_deleted or not is_active:
            # 查找所有关联的数据集
            data_source = await DataSource.filter(
                tenant_id=tenant_id,
                code=data_source_code,
                deleted_at__isnull=True,
            ).first()
            
            if data_source:
                # 更新关联数据集的错误信息
                await Dataset.filter(
                    tenant_id=tenant_id,
                    data_source_id=data_source.id,
                    deleted_at__isnull=True,
                ).update(
                    last_error=f"数据源已{'删除' if is_deleted else '禁用'}，无法执行查询"
                )
                logger.info(
                    f"Updated {await Dataset.filter(tenant_id=tenant_id, data_source_id=data_source.id, deleted_at__isnull=True).count()} "
                    f"datasets associated with data source '{data_source_code}'"
                )
        
        # TODO: 在此处实现更新关联数据集的逻辑，例如：
        # - 如果数据源配置变更，可以重新验证数据集的查询配置
        # - 如果数据源连接状态变更，可以更新数据集的执行状态
        pass
    
    async def test_data_source_for_dataset(
        self,
        tenant_id: int,
        dataset_uuid: UUID,
    ) -> Dict[str, Any]:
        """
        使用数据源管理的测试功能测试数据集关联的数据源连接
        
        Args:
            tenant_id: 组织ID
            dataset_uuid: 数据集UUID
            
        Returns:
            Dict[str, Any]: 测试结果
            {
                "success": true,
                "message": "连接成功",
                "elapsed_time": 0.123
            }
            
        Raises:
            NotFoundError: 数据集不存在
        """
        # 获取数据集
        dataset = await self.get_dataset_by_uuid(tenant_id, dataset_uuid)
        
        # 获取数据源
        await dataset.fetch_related('data_source')
        data_source = dataset.data_source
        
        # 调用数据源管理的测试功能
        from core.services.data_source_service import DataSourceService
        test_result = await DataSourceService().test_connection(
            tenant_id=tenant_id,
            data_source_uuid=data_source.uuid,
        )
        
        return {
            "success": test_result.success,
            "message": test_result.message,
            "elapsed_time": test_result.elapsed_time,
        }
    
    @staticmethod
    async def query_dataset_by_code(
        tenant_id: int,
        dataset_code: str,
        parameters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> ExecuteQueryResponse:
        """
        通过数据集代码查询数据集数据（供业务模块使用）
        
        这是一个便捷方法，供业务模块通过数据集代码快速获取数据。
        
        Args:
            tenant_id: 组织ID
            dataset_code: 数据集代码
            parameters: 查询参数（可选）
            limit: 限制返回行数
            offset: 偏移量
            
        Returns:
            ExecuteQueryResponse: 查询结果
            
        Raises:
            NotFoundError: 数据集不存在或未启用
        """
        # 获取数据集
        dataset = await Dataset.filter(
            tenant_id=tenant_id,
            code=dataset_code,
            deleted_at__isnull=True,
            is_active=True,
        ).prefetch_related('data_source').first()
        
        if not dataset:
            raise NotFoundError(f"数据集不存在或未启用: {dataset_code}")
        
        # 执行查询
        service = DatasetService()
        return await service.execute_query(
            tenant_id=tenant_id,
            dataset_uuid=dataset.uuid,
            execute_request=ExecuteQueryRequest(
                parameters=parameters,
                limit=limit,
                offset=offset,
            ),
        )
    
    @staticmethod
    async def _notify_business_modules(
        tenant_id: int,
        dataset_code: str,
        is_active: bool = True,
        is_deleted: bool = False,
        config_changed: bool = False
    ) -> None:
        """
        通知业务模块数据集变更（预留接口）
        
        此方法用于在数据集变更或删除时，触发后续的业务逻辑，
        例如更新业务模块中缓存的数据集数据、重新加载数据集配置等。
        目前仅为预留接口，不执行任何实际操作。
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(
            f"Dataset '{dataset_code}' in tenant {tenant_id} changed. "
            f"Active: {is_active}, Deleted: {is_deleted}, Config changed: {config_changed}"
        )
        
        # TODO: 在此处实现通知业务模块的逻辑，例如：
        # - 如果数据集配置变更，可以通知业务模块重新加载数据集配置
        # - 如果数据集被删除或禁用，可以通知业务模块清理缓存的数据集数据
        # - 可以通过事件总线、消息队列等方式通知业务模块
        pass

