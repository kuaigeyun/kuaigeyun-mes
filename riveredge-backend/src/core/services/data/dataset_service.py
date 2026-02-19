"""
数据集管理服务模块

提供数据集的 CRUD 操作和查询执行功能。
"""

import re
import time
import httpx
from typing import Dict, Any, Optional, List, Tuple
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from core.models.dataset import Dataset
from core.models.integration_config import IntegrationConfig
from core.models.api import API
from core.schemas.dataset import DatasetCreate, DatasetUpdate, ExecuteQueryRequest, ExecuteQueryResponse
from infra.exceptions.exceptions import NotFoundError, ValidationError

# 应用连接器类型（与 application_connections API 一致）
APPLICATION_CONNECTOR_TYPES = (
    "feishu", "dingtalk", "wecom",
    "sap", "kingdee", "yonyou", "dsc",
    "teamcenter", "windchill", "dassault_3dx",
    "salesforce", "xiaoshouyi", "fenxiang",
)


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
        
        # 获取数据连接/数据源（统一为 IntegrationConfig）
        integration_config = await IntegrationConfig.filter(
            tenant_id=tenant_id,
            uuid=str(dataset_data.data_source_uuid),
            deleted_at__isnull=True,
        ).first()
        
        if not integration_config:
            raise ValidationError(f"数据连接/数据源不存在: {dataset_data.data_source_uuid}")
        
        # 如果查询类型为 'api'，验证接口管理中的 API 是否存在
        if dataset_data.query_type == 'api':
            query_config = dataset_data.query_config
            api_uuid = query_config.get('api_uuid') if isinstance(query_config, dict) else None
            api_code = query_config.get('api_code') if isinstance(query_config, dict) else None
            
            if api_uuid or api_code:
                from core.services.application.api_service import APIService
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
            integration_config_id=integration_config.id,
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
        ).prefetch_related('integration_config').first()
        
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
        
        # 数据连接/数据源筛选
        if data_source_uuid:
            integration_config = await IntegrationConfig.filter(
                tenant_id=tenant_id,
                uuid=str(data_source_uuid),
                deleted_at__isnull=True,
            ).first()
            if integration_config:
                query = query.filter(integration_config_id=integration_config.id)
        
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
        datasets = await query.prefetch_related('integration_config').order_by("-created_at").offset(offset).limit(page_size).all()
        
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
                from core.services.application.api_service import APIService
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
        
        # 获取数据连接/数据源
        await dataset.fetch_related('integration_config')
        integration_config = dataset.integration_config

        if not integration_config.is_connected:
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
            # 应用连接器类型：使用 REST 拉取（query_config 含 endpoint、method）
            if integration_config.type in APPLICATION_CONNECTOR_TYPES:
                result = await self._execute_app_connector_query(
                    integration_config=integration_config,
                    query_config=dataset.query_config,
                    parameters=execute_request.parameters,
                    limit=execute_request.limit,
                    offset=execute_request.offset,
                )
            else:
                # 兼容历史错误数据：visual 等无效值按 sql 处理
                qt = dataset.query_type if dataset.query_type in ('sql', 'api') else 'sql'
                if qt == 'sql':
                    result = await self._execute_sql_query(
                        tenant_id=tenant_id,
                        integration_config=integration_config,
                        query_config=dataset.query_config,
                        parameters=execute_request.parameters,
                        limit=execute_request.limit,
                        offset=execute_request.offset,
                    )
                elif qt == 'api':
                    result = await self._execute_api_query(
                        tenant_id=tenant_id,
                        integration_config=integration_config,
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
    
    @staticmethod
    def _convert_named_params_to_positional(sql: str, params: Dict[str, Any]) -> Tuple[str, list]:
        """将 :param 占位符转为 asyncpg 的 $1,$2 格式，按 SQL 中首次出现顺序，返回 (sql, args)"""
        if not params:
            return sql, []
        param_names = list(dict.fromkeys(re.findall(r":(\w+)\b", sql)))
        args = [params[n] for n in param_names]
        for i, name in enumerate(param_names, 1):
            sql = re.sub(rf":{re.escape(name)}\b", f"${i}", sql)
        return sql, args

    @staticmethod
    def _inject_tenant_filter_sql(sql: str) -> str:
        """
        共享库租户隔离：自动在 SQL 中注入 tenant_id = :tenant_id 条件。
        tenant_id 由系统自动注入，用户无需在 SQL 中指定，也不允许被覆盖。
        注意：多表 JOIN 时若多表均有 tenant_id 列，可能产生列歧义，可设置 tenant_isolation=false 后手动添加带表别名的条件。
        """
        sql = sql.strip()
        sql_upper = sql.upper()
        tenant_condition = f"tenant_id = :tenant_id"
        if "WHERE" in sql_upper:
            # 已有 WHERE，在 WHERE 后追加 AND tenant_id = :tenant_id
            sql = re.sub(
                r"(\bWHERE\b)(\s+)",
                r"\1 " + tenant_condition + r" AND \2",
                sql,
                count=1,
                flags=re.IGNORECASE,
            )
        else:
            # 无 WHERE，在 FROM 子句后、GROUP BY/ORDER BY/LIMIT 前添加
            match = re.search(r"\b(GROUP BY|ORDER BY|LIMIT)\b", sql_upper)
            if match:
                insert_pos = match.start()
                sql = sql[:insert_pos].rstrip() + " WHERE " + tenant_condition + " " + sql[insert_pos:]
            else:
                sql = sql.rstrip().rstrip(";") + " WHERE " + tenant_condition
        return sql

    async def _execute_sql_query(
        self,
        tenant_id: int,
        integration_config: IntegrationConfig,
        query_config: Dict[str, Any],
        parameters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        执行 SQL 查询

        数据隔离：自动注入 tenant_id 到查询参数，确保 SQL 中可使用 :tenant_id 过滤当前租户数据。
        若业务表含 tenant_id 列，请在 WHERE 子句中使用 tenant_id = :tenant_id 以实现租户隔离。

        Args:
            tenant_id: 当前租户ID（用于数据隔离）
            integration_config: 数据连接/数据源（IntegrationConfig）
            query_config: 查询配置
            parameters: 查询参数
            limit: 限制返回行数
            offset: 偏移量

        Returns:
            Dict[str, Any]: 查询结果
        """
        try:
            # 仅支持 PostgreSQL（使用 Tortoise ORM）
            if integration_config.type != 'postgresql':
                return {
                    'success': False,
                    'data': [],
                    'total': None,
                    'columns': None,
                    'error': f'SQL 查询暂仅支持 PostgreSQL，当前类型: {integration_config.type}',
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

            # 共享库租户隔离：默认自动注入 tenant_id 过滤，仅查当前租户。可通过 query_config.tenant_isolation=false 关闭（如每租户独立库）
            if query_config.get("tenant_isolation", True):
                sql = self._inject_tenant_filter_sql(sql)

            # 合并查询参数；共享库模式下强制注入 tenant_id（不允许被覆盖）
            query_params = dict(query_config.get('parameters', {}))
            if parameters:
                query_params.update(parameters)
            if query_config.get("tenant_isolation", True):
                query_params['tenant_id'] = tenant_id  # 强制注入当前租户ID

            # 添加 LIMIT 和 OFFSET
            if 'LIMIT' not in sql_upper:
                sql = f"{sql} LIMIT {limit} OFFSET {offset}"

            # 将 :param 占位符转为 asyncpg 的 $1,$2 格式
            sql, args = self._convert_named_params_to_positional(sql, query_params)

            # 使用 asyncpg 直接连接执行
            import asyncpg
            config = integration_config.get_config()
            conn = await asyncpg.connect(
                host=config.get('host', 'localhost'),
                port=int(config.get('port', 5432)),
                user=config.get('user') or config.get('username', ''),
                password=config.get('password', ''),
                database=config.get('database', ''),
            )
            try:
                rows = await conn.fetch(sql, *args) if args else await conn.fetch(sql)
                columns = list(rows[0].keys()) if rows else []
                data = [dict(row) for row in rows]
            finally:
                await conn.close()
            
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
    
    async def _execute_app_connector_query(
        self,
        integration_config: IntegrationConfig,
        query_config: Dict[str, Any],
        parameters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        执行应用连接器查询（通用 REST 拉取）

        query_config 需包含: endpoint, method, 可选 params/headers/body/params_mapping
        协作类（feishu、dingtalk、wecom）与 ERP/PLM/CRM 均使用通用 REST 方式。
        """
        try:
            endpoint = query_config.get("endpoint", "")
            method = (query_config.get("method") or "GET").upper()
            if not endpoint:
                return {
                    "success": False,
                    "data": [],
                    "total": None,
                    "columns": None,
                    "error": "应用连接器 query_config 需包含 endpoint",
                }
            cfg = integration_config.get_config()
            base_url = (cfg.get("base_url") or cfg.get("url") or "").rstrip("/")
            if not base_url:
                return {
                    "success": False,
                    "data": [],
                    "total": None,
                    "columns": None,
                    "error": "应用连接器配置缺少 base_url 或 url",
                }
            url = f"{base_url}/{endpoint.lstrip('/')}" if endpoint else base_url

            headers = dict(cfg.get("headers") or {})
            if cfg.get("auth_type") == "bearer" and cfg.get("token"):
                headers["Authorization"] = f"Bearer {cfg['token']}"
            if query_config.get("headers"):
                headers.update(query_config.get("headers", {}))

            params = dict(query_config.get("params") or {})
            if parameters:
                params.update(parameters)
            params["limit"] = limit
            params["offset"] = offset

            body = query_config.get("body") or {}

            async with httpx.AsyncClient(timeout=30.0) as client:
                if method == "GET":
                    response = await client.get(url, headers=headers, params=params)
                elif method == "POST":
                    response = await client.post(url, headers=headers, params=params, json=body)
                elif method == "PUT":
                    response = await client.put(url, headers=headers, params=params, json=body)
                elif method == "PATCH":
                    response = await client.patch(url, headers=headers, params=params, json=body)
                else:
                    return {
                        "success": False,
                        "data": [],
                        "total": None,
                        "columns": None,
                        "error": f"不支持的 HTTP 方法: {method}",
                    }

                if response.status_code >= 400:
                    return {
                        "success": False,
                        "data": [],
                        "total": None,
                        "columns": None,
                        "error": f"请求失败，状态码: {response.status_code}",
                    }
                try:
                    response_data = response.json()
                except Exception:
                    response_data = {"data": response.text}
                if isinstance(response_data, list):
                    data = response_data
                elif isinstance(response_data, dict):
                    if "data" in response_data:
                        data = (
                            response_data["data"]
                            if isinstance(response_data["data"], list)
                            else [response_data["data"]]
                        )
                    elif "items" in response_data:
                        data = response_data["items"]
                    else:
                        data = [response_data]
                else:
                    data = []
                data = data[offset : offset + limit]
                columns = list(data[0].keys()) if data and isinstance(data[0], dict) else []
                return {
                    "success": True,
                    "data": data,
                    "total": len(data),
                    "columns": columns,
                }
        except httpx.TimeoutException:
            return {
                "success": False,
                "data": [],
                "total": None,
                "columns": None,
                "error": "应用连接器请求超时",
            }
        except Exception as e:
            return {
                "success": False,
                "data": [],
                "total": None,
                "columns": None,
                "error": f"应用连接器执行失败: {str(e)}",
            }

    async def _execute_api_query(
        self,
        tenant_id: int,
        integration_config: IntegrationConfig,
        query_config: Dict[str, Any],
        parameters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        执行 API 查询

        支持两种方式：
        1. 从接口管理获取 API 配置（如果 query_config 中包含 api_uuid 或 api_code）
        2. 从数据连接/数据源（IntegrationConfig）获取 API 配置

        Args:
            tenant_id: 组织ID
            integration_config: 数据连接/数据源对象
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
                from core.services.application.api_service import APIService
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
                    from infra.config.infra_config import infra_settings as settings
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
                # 从数据连接/数据源获取 API 配置
                if integration_config.type not in ('api', 'API'):
                    return {
                        'success': False,
                        'data': [],
                        'total': None,
                        'columns': None,
                        'error': f'API 查询需要 API 类型数据连接，当前类型: {integration_config.type}',
                    }

                cfg = integration_config.get_config()
                base_url = cfg.get('base_url') or cfg.get('url', '')
                endpoint = query_config.get('endpoint', '')
                method = query_config.get('method', 'GET').upper()

                if not base_url or not endpoint:
                    return {
                        'success': False,
                        'data': [],
                        'total': None,
                        'columns': None,
                        'error': 'API base_url/url 和 endpoint 不能为空',
                    }

                url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}" if endpoint else base_url

                headers = cfg.get('headers', {})
                if cfg.get('auth_type') == 'bearer' and cfg.get('token'):
                    headers['Authorization'] = f"Bearer {cfg['token']}"
                
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
        from core.services.application.api_service import APIService
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
        通知数据集管理数据连接/数据源变更（预留接口）

        统一后使用 IntegrationConfig；数据连接变更时更新关联数据集。
        """
        import logging
        logger = logging.getLogger(__name__)

        logger.info(
            f"Data connection '{data_source_code}' in tenant {tenant_id} changed. "
            f"Active: {is_active}, Deleted: {is_deleted}, Config changed: {config_changed}"
        )

        if is_deleted or not is_active:
            ic = await IntegrationConfig.filter(
                tenant_id=tenant_id,
                code=data_source_code,
                deleted_at__isnull=True,
            ).first()

            if ic:
                await Dataset.filter(
                    tenant_id=tenant_id,
                    integration_config_id=ic.id,
                    deleted_at__isnull=True,
                ).update(
                    last_error=f"数据连接已{'删除' if is_deleted else '禁用'}，无法执行查询"
                )
                logger.info(
                    f"Updated {await Dataset.filter(tenant_id=tenant_id, integration_config_id=ic.id, deleted_at__isnull=True).count()} "
                    f"datasets for connection '{data_source_code}'"
                )
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
        
        # 获取数据连接
        await dataset.fetch_related('integration_config')
        integration_config = dataset.integration_config

        from core.services.integration.integration_config_service import IntegrationConfigService
        test_result = await IntegrationConfigService.test_connection(
            tenant_id=tenant_id,
            uuid=str(integration_config.uuid),
        )

        return {
            "success": test_result.get("success", False),
            "message": test_result.get("message", ""),
            "elapsed_time": test_result.get("data", {}).get("elapsed_time", 0) if isinstance(test_result.get("data"), dict) else 0,
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
        ).prefetch_related('integration_config').first()

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

