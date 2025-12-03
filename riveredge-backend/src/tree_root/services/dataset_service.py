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

from tree_root.models.dataset import Dataset
from tree_root.models.data_source import DataSource
from tree_root.schemas.dataset import DatasetCreate, DatasetUpdate, ExecuteQueryRequest, ExecuteQueryResponse
from soil.exceptions.exceptions import NotFoundError, ValidationError


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
        
        # 搜索条件
        if search:
            query = query.filter(
                name__icontains=search,
            ) | query.filter(
                code__icontains=search,
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
        
        # 获取总数
        total = await query.count()
        
        # 分页查询
        datasets = await query.prefetch_related('data_source').order_by("-created_at").offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
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
        
        # 更新数据集
        update_data = dataset_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(dataset, key, value)
        
        await dataset.save()
        
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
        
        # 软删除
        dataset.deleted_at = datetime.now()
        await dataset.save()
    
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
        data_source: DataSource,
        query_config: Dict[str, Any],
        parameters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        执行 API 查询
        
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
            
            # 执行请求
            async with httpx.AsyncClient(timeout=30.0) as client:
                if method == 'GET':
                    response = await client.get(url, headers=headers, params=params)
                elif method == 'POST':
                    body = query_config.get('body', {})
                    response = await client.post(url, headers=headers, params=params, json=body)
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

