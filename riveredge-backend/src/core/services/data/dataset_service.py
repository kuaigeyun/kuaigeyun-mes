"""
数据集管理服务模块

提供数据集的 CRUD 操作和查询执行功能。
"""

import asyncio
import re
import time
import httpx  # 仅用于异常类型
from typing import Dict, Any, Optional, List, Tuple

from infra.infrastructure.http import get_http_client
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from core.models.dataset import Dataset
from core.models.integration_config import IntegrationConfig
from core.models.page_metric_config import PageMetricConfig
from core.models.api import API
from core.schemas.dataset import (
    DatasetCreate,
    DatasetUpdate,
    ExecuteQueryRequest,
    ExecuteQueryResponse,
    OUTPUT_TYPE_LIST,
    OUTPUT_TYPE_METRIC,
    OUTPUT_TYPE_MULTI_METRIC,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.utils.timezone_utils import resolve_business_datetime

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
        output_type: Optional[str] = None,
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

        # 输出类型筛选（指标型：metric/multi_metric）
        if output_type:
            query = query.filter(output_type=output_type)

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
        old_code = dataset.code

        # 更新数据集
        update_data = dataset_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(dataset, key, value)

        await dataset.save()

        code_changed = old_code != dataset.code

        # 如果数据集状态或配置变更，异步通知业务模块
        if (
            (dataset_data.is_active is not None and old_is_active != dataset.is_active)
            or (dataset_data.query_config and old_query_config != dataset.query_config)
            or code_changed
        ):
            import asyncio

            asyncio.create_task(
                DatasetService._notify_business_modules(
                    tenant_id=tenant_id,
                    dataset_code=dataset.code,
                    is_active=dataset.is_active,
                    config_changed=(
                        bool(dataset_data.query_config and old_query_config != dataset.query_config)
                        or code_changed
                    ),
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
        dataset.deleted_at = resolve_business_datetime()
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

        # 系统默认数据源使用应用主库，视为始终可用，跳过 is_connected 检查
        is_system_default = (integration_config.get_config() or {}).get('_system_default')
        if not is_system_default and not integration_config.is_connected:
            return ExecuteQueryResponse(
                success=False,
                data=[],
                total=None,
                columns=None,
                elapsed_time=0.0,
                error='数据源未连接，请先测试连接',
            )
        
        start_time = time.time()
        
        stored_qc = dataset.query_config or {}
        override_qc = execute_request.query_config or {}
        effective_qc = {**stored_qc, **override_qc}

        try:
            # 应用连接器类型：使用 REST 拉取（query_config 含 endpoint、method）
            if integration_config.type in APPLICATION_CONNECTOR_TYPES:
                result = await self._execute_app_connector_query(
                    integration_config=integration_config,
                    query_config=effective_qc,
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
                        query_config=effective_qc,
                        parameters=execute_request.parameters,
                        limit=execute_request.limit,
                        offset=execute_request.offset,
                        fill_missing_sql_parameters=execute_request.fill_missing_sql_parameters,
                    )
                elif qt == 'api':
                    result = await self._execute_api_query(
                        tenant_id=tenant_id,
                        integration_config=integration_config,
                        query_config=effective_qc,
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
            dataset.last_executed_at = resolve_business_datetime()
            if not result['success']:
                dataset.last_error = result.get('error', '查询执行失败')
            else:
                dataset.last_error = None
            await dataset.save()

            # 按 output_type 处理返回结构
            data = result.get('data', [])
            output_type = getattr(dataset, 'output_type', None) or OUTPUT_TYPE_LIST
            if result['success'] and output_type != OUTPUT_TYPE_LIST:
                data = self._transform_metric_output(
                    data=data,
                    output_type=output_type,
                    display_config=getattr(dataset, 'display_config', None) or {},
                    columns=result.get('columns'),
                )

            return ExecuteQueryResponse(
                success=result['success'],
                data=data,
                total=result.get('total'),
                columns=result.get('columns'),
                elapsed_time=round(elapsed_time, 3),
                error=result.get('error'),
            )
        except Exception as e:
            elapsed_time = time.time() - start_time
            
            # 更新执行状态
            dataset.last_executed_at = resolve_business_datetime()
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
    def _transform_metric_output(
        data: List[Dict[str, Any]],
        output_type: str,
        display_config: Dict[str, Any],
        columns: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        按 output_type 转换查询结果为指标格式。

        - metric: 取 data[0][first_column]，返回 [{"value": v}]
        - multi_metric: 返回 [data[0]]，保留原始行供 display_config.columns 映射
        """
        if not data:
            if output_type == OUTPUT_TYPE_METRIC:
                return [{"value": None}]
            return [{}]

        row = data[0] if isinstance(data[0], dict) else {}
        if output_type == OUTPUT_TYPE_METRIC:
            cols = columns or list(row.keys())
            first_col = cols[0] if cols else None
            val = row.get(first_col) if first_col else None
            return [{"value": val}]
        if output_type == OUTPUT_TYPE_MULTI_METRIC:
            return [row]
        return data

    @staticmethod
    def _convert_named_params_to_positional(sql: str, params: Dict[str, Any]) -> Tuple[str, list]:
        """将 :param 占位符转为 asyncpg 的 $1,$2 格式，按 SQL 中首次出现顺序，返回 (sql, args)。
        使用 (?<!:) 排除 PostgreSQL 类型转换 ::type（如 ::int、::numeric）被误识别为参数。
        禁止在 params 为空时原样返回含 :name 的 SQL（asyncpg 会报 syntax error at or near \":\"）。"""
        # 仅匹配 :param，不匹配 ::type（PostgreSQL 类型转换）
        param_names = list(dict.fromkeys(re.findall(r"(?<!:):(\w+)\b", sql)))
        if not param_names:
            return sql, []
        missing = [name for name in param_names if name not in (params or {})]
        if missing:
            raise KeyError(f"缺少查询参数: {', '.join(':' + m for m in missing)}")
        args = [params[name] for name in param_names]
        for i, name in enumerate(param_names, 1):
            sql = re.sub(rf"(?<!:):{re.escape(name)}\b", f"${i}", sql)
        return sql, args

    @staticmethod
    def _convert_named_params_to_pymssql(sql: str, params: Dict[str, Any]) -> Tuple[str, List[Any]]:
        """将 :param 转为 pymssql 的 %s，按在 SQL 中出现的顺序绑定参数（排除 :: 类型转换）。"""
        if not params:
            return sql, []
        parts: List[str] = []
        args: List[Any] = []
        last = 0
        for m in re.finditer(r"(?<!:):(\w+)\b", sql):
            parts.append(sql[last : m.start()])
            name = m.group(1)
            if name not in params:
                raise KeyError(f"缺少查询参数: :{name}")
            parts.append("%s")
            args.append(params[name])
            last = m.end()
        parts.append(sql[last:])
        return "".join(parts), args

    @staticmethod
    def _list_sql_named_parameters(sql: str) -> List[str]:
        """提取 SQL 中 :name 命名参数（排除 PostgreSQL ::type）。"""
        return list(dict.fromkeys(re.findall(r"(?<!:):(\w+)\b", sql)))

    @staticmethod
    def _build_sql_query_parameters(
        sql: str,
        query_config: Dict[str, Any],
        parameters: Optional[Dict[str, Any]],
        *,
        tenant_id: int,
        apply_tenant_isolation: bool,
        fill_missing_sql_parameters: bool,
    ) -> Dict[str, Any]:
        query_params = dict(query_config.get("parameters", {}))
        if parameters:
            query_params.update(parameters)
        if apply_tenant_isolation:
            query_params["tenant_id"] = tenant_id
        # SQL 手写 :tenant_id 且关闭自动注入时，仍须绑定当前租户，否则占位符残留导致 PG 语法错误
        named = DatasetService._list_sql_named_parameters(sql)
        if "tenant_id" in named and "tenant_id" not in query_params:
            query_params["tenant_id"] = tenant_id
        if fill_missing_sql_parameters:
            for name in named:
                if name not in query_params:
                    query_params[name] = None
        return query_params

    @staticmethod
    def _cursor_column_names(cursor: Any) -> List[str]:
        """DB-API cursor.description → 列名（0 行时仍可用于列名探测）。"""
        desc = getattr(cursor, "description", None) or []
        names: List[str] = []
        for item in desc:
            if not item:
                continue
            name = item[0]
            if name is None:
                continue
            names.append(str(name))
        return names

    @staticmethod
    def _escape_pymssql_literal_percents(sql: str) -> str:
        """
        pymssql 通过 Python「%」格式化绑定 %s 参数；SQL 里 LIKE 等字面量 % 须写成 %%，否则会破坏语句
        （常见表现：Incorrect syntax near '\\xb3'，多字节中文被截断）。
        """
        parts = sql.split("%s")
        if len(parts) == 1:
            return sql.replace("%", "%%")
        return "%s".join(p.replace("%", "%%") for p in parts)

    @staticmethod
    def _sqlserver_should_wrap_paging(sql: str) -> bool:
        """若语句已含 TOP / OFFSET-FETCH，则不再外包分页。"""
        u = sql.upper()
        if "OFFSET" in u and "ROWS" in u:
            return False
        if "FETCH" in u and "NEXT" in u:
            return False
        if re.search(r"\bSELECT\s+TOP\s+[\d(]", u):
            return False
        return True

    @staticmethod
    def _wrap_sqlserver_paged_sql(sql: str, limit: int, offset: int) -> str:
        """T-SQL 分页：offset=0 用 TOP；否则 ROW_NUMBER（兼容 SQL Server 2008 R2，无 OFFSET/FETCH 时）。"""
        s = sql.strip().rstrip(";")
        lim = max(1, min(int(limit), 10000))
        off = max(0, int(offset))
        inner = f"({s}) AS __inner"
        if off == 0:
            return f"SELECT TOP ({lim}) * FROM {inner}"
        hi = off + lim
        return (
            "SELECT * FROM ("
            "SELECT ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS __rn, * "
            f"FROM {inner}"
            f") AS __paged WHERE __rn > {off} AND __rn <= {hi}"
        )

    @staticmethod
    def _execute_sqlserver_query_sync(config: Dict[str, Any], sql: str, args: List[Any]) -> Dict[str, Any]:
        """
        在线程中连接 SQL Server 并执行只读查询。
        优先 pyodbc（? 占位，无 pymssql 的 % 格式化问题）；失败再试 pymssql（转义字面量 %）。
        """
        import pymssql

        from core.services.integration.integration_config_service import IntegrationConfigService

        tup = tuple(args) if args else tuple()

        odbc_res = IntegrationConfigService._sqlserver_pyodbc_execute_query_sync(config, sql, tup)
        if odbc_res.get("success"):
            return {
                "success": True,
                "data": odbc_res.get("data", []),
                "columns": odbc_res.get("columns", []),
                "total": odbc_res.get("total", 0),
            }

        sql_pymssql = DatasetService._escape_pymssql_literal_percents(sql)
        base_attempts = IntegrationConfigService._sqlserver_connection_attempt_kwargs(config)
        charset_primary = IntegrationConfigService._sqlserver_resolve_charset(config)
        charset_candidates = list(
            dict.fromkeys([charset_primary, "UTF-8" if charset_primary.upper() != "UTF-8" else "CP936"])
        )

        last_exc: Optional[BaseException] = None
        for charset in charset_candidates:
            for base_kw in base_attempts:
                kw = dict(base_kw)
                kw["charset"] = charset
                try:
                    conn = pymssql.connect(**kw)
                    try:
                        cur = conn.cursor(as_dict=True)
                        if tup:
                            cur.execute(sql_pymssql, tup)
                        else:
                            cur.execute(sql_pymssql)
                        rows = cur.fetchall()
                        columns = DatasetService._cursor_column_names(cur)
                        if not rows:
                            return {"success": True, "data": [], "columns": columns, "total": 0}
                        if not columns and rows:
                            columns = list(rows[0].keys())
                        data = IntegrationConfigService._sqlserver_normalize_rows(
                            [dict(r) for r in rows],
                            config,
                        )
                        return {"success": True, "data": data, "columns": columns, "total": len(data)}
                    finally:
                        conn.close()
                except Exception as e:
                    last_exc = e

        pymssql_err = str(last_exc) if last_exc else "SQL Server pymssql 连接或查询失败"
        if odbc_res.get("skipped"):
            hint = (odbc_res.get("hint") or "").strip()
            sep = " " if hint else ""
            return {
                "success": False,
                "data": [],
                "columns": None,
                "total": None,
                "error": pymssql_err + sep + hint,
            }
        odbc_err = (odbc_res.get("error") or "").strip()
        return {
            "success": False,
            "data": [],
            "columns": None,
            "total": None,
            "error": pymssql_err + " ODBC 回退仍失败：" + odbc_err,
        }

    @staticmethod
    def _should_apply_sql_tenant_isolation(
        integration_config: IntegrationConfig,
        query_config: Dict[str, Any],
    ) -> bool:
        """
        是否对本次 SQL 注入 tenant_id 条件并绑定参数。

        - query_config 显式含 tenant_isolation 时以布尔值为准（第三方库可设 false，多租户共享库可设 true）。
        - 未配置时：仅系统默认（本地应用）数据源默认开启；第三方 ERP/SQL Server 等不注入，避免无 tenant_id 列报错。
        """
        from core.services.integration.integration_config_service import SYSTEM_DEFAULT_CODE

        if "tenant_isolation" in query_config:
            return bool(query_config.get("tenant_isolation"))
        cfg = integration_config.get_config() or {}
        if cfg.get("_system_default"):
            return True
        return integration_config.code == SYSTEM_DEFAULT_CODE

    @staticmethod
    def _inject_tenant_filter_sql(sql: str) -> str:
        """
        共享库租户隔离：自动在 SQL 中注入 tenant_id = :tenant_id 条件。
        tenant_id 由系统自动注入，用户无需在 SQL 中指定，也不允许被覆盖。
        注意：多表 JOIN 时若多表均有 tenant_id 列，可能产生列歧义，可设置 tenant_isolation=false 后手动添加带表别名的条件。
        默认仅对系统默认数据源启用隔离，见 DatasetService._should_apply_sql_tenant_isolation。
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
        fill_missing_sql_parameters: bool = False,
    ) -> Dict[str, Any]:
        """
        执行 SQL 查询

        数据隔离：仅对系统默认（本地应用）数据源默认注入 tenant_id；第三方连接不注入，除非在 query_config 中设置 tenant_isolation: true。
        若业务表含 tenant_id 列且需隔离，请在 WHERE 中使用 tenant_id = :tenant_id，并开启 tenant_isolation。
        支持 PostgreSQL（asyncpg）与 SQL Server（优先 pyodbc，失败再 pymssql；与数据源「测试连接」策略一致）。

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
            db_type = integration_config.type
            if db_type not in ("postgresql", "sqlserver"):
                return {
                    "success": False,
                    "data": [],
                    "total": None,
                    "columns": None,
                    "error": f"SQL 查询暂不支持该数据连接类型: {db_type}（支持: postgresql、sqlserver）",
                }

            # 获取 SQL 语句
            sql = query_config.get("sql", "")
            if not sql:
                return {
                    "success": False,
                    "data": [],
                    "total": None,
                    "columns": None,
                    "error": "SQL 语句不能为空",
                }

            # 验证 SQL 语句（仅允许 SELECT）
            sql_upper = sql.strip().upper()
            if not sql_upper.startswith("SELECT"):
                return {
                    "success": False,
                    "data": [],
                    "total": None,
                    "columns": None,
                    "error": "仅支持 SELECT 查询，禁止执行 DDL、DML 语句",
                }

            apply_tenant_isolation = self._should_apply_sql_tenant_isolation(
                integration_config, query_config
            )
            if apply_tenant_isolation:
                sql = self._inject_tenant_filter_sql(sql)

            query_params = self._build_sql_query_parameters(
                sql,
                query_config,
                parameters,
                tenant_id=tenant_id,
                apply_tenant_isolation=apply_tenant_isolation,
                fill_missing_sql_parameters=fill_missing_sql_parameters,
            )

            if db_type == "postgresql":
                # 添加 LIMIT 和 OFFSET
                sql_upper2 = sql.upper()
                if "LIMIT" not in sql_upper2:
                    sql = f"{sql} LIMIT {limit} OFFSET {offset}"

                # 将 :param 占位符转为 asyncpg 的 $1,$2 格式
                sql, args = self._convert_named_params_to_positional(sql, query_params)

                # 使用 asyncpg 直接连接执行（系统默认数据源密码从 ENV 读取）
                import asyncpg
                from core.services.integration.integration_config_service import (
                    _get_system_default_pg_config,
                )

                config = integration_config.get_config()
                if config.get("_system_default"):
                    config = _get_system_default_pg_config()
                conn = await asyncpg.connect(
                    host=config.get("host", "localhost"),
                    port=int(config.get("port", 5432)),
                    user=config.get("user") or config.get("username", ""),
                    password=config.get("password", ""),
                    database=config.get("database", ""),
                )
                try:
                    rows = await conn.fetch(sql, *args) if args else await conn.fetch(sql)
                    columns = list(rows[0].keys()) if rows else []
                    data = [dict(row) for row in rows]
                finally:
                    await conn.close()

                return {
                    "success": True,
                    "data": data,
                    "total": len(data),  # 简化实现，实际应该执行 COUNT 查询
                    "columns": columns,
                }

            # sqlserver：pymssql 在线程中执行；分页用 TOP / ROW_NUMBER（不使用 LIMIT）
            sql_upper2 = sql.upper()
            if "LIMIT" in sql_upper2:
                return {
                    "success": False,
                    "data": [],
                    "total": None,
                    "columns": None,
                    "error": "SQL Server 不支持 LIMIT 语法，请从 SQL 中移除 LIMIT；预览行数由系统自动施加 TOP 或行号分页。",
                }
            if self._sqlserver_should_wrap_paging(sql):
                sql = self._wrap_sqlserver_paged_sql(sql, limit, offset)
            sql, args = self._convert_named_params_to_pymssql(sql, query_params)
            cfg = integration_config.get_config()
            return await asyncio.to_thread(
                DatasetService._execute_sqlserver_query_sync,
                cfg,
                sql,
                args,
            )
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

            client = get_http_client()
            if method == "GET":
                response = await client.get(url, headers=headers, params=params, timeout=30.0)
            elif method == "POST":
                response = await client.post(url, headers=headers, params=params, json=body, timeout=30.0)
            elif method == "PUT":
                response = await client.put(url, headers=headers, params=params, json=body, timeout=30.0)
            elif method == "PATCH":
                response = await client.patch(url, headers=headers, params=params, json=body, timeout=30.0)
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
                    base_url = (settings.BASE_URL or "").strip().rstrip("/")
                    if not base_url:
                        # 服务端 HTTP 客户端需要绝对 URL；开发未配 BASE_URL 时回环本机 API
                        bind = "127.0.0.1" if settings.HOST in ("0.0.0.0", "::") else settings.HOST
                        base_url = f"http://{bind}:{settings.PORT}"
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
            client = get_http_client()
            if method == 'GET':
                response = await client.get(url, headers=headers, params=params, timeout=30.0)
            elif method == 'POST':
                response = await client.post(url, headers=headers, params=params, json=body, timeout=30.0)
            elif method == 'PUT':
                response = await client.put(url, headers=headers, params=params, json=body, timeout=30.0)
            elif method == 'DELETE':
                response = await client.delete(url, headers=headers, params=params, timeout=30.0)
            elif method == 'PATCH':
                response = await client.patch(url, headers=headers, params=params, json=body, timeout=30.0)
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

            try:
                response_data = response.json()
            except Exception:
                response_data = {'data': response.text}

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

            data = data[offset:offset + limit]
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
    
    async def get_metrics_by_page(
        self,
        tenant_id: int,
        page_path: str,
    ) -> Optional[Dict[str, Any]]:
        """
        按页面路径获取指标卡。

        查 page_metric_config -> 执行绑定的 multi_metric 数据集 -> 按 display_config 映射为 stat_cards。
        无配置时返回 None。

        Returns:
            {"stat_cards": [...], "dataset_code": "xxx"} 或 None
        """
        config = await PageMetricConfig.filter(
            tenant_id=tenant_id,
            page_path=page_path,
            deleted_at__isnull=True,
        ).first()
        if not config:
            return None

        dataset = await Dataset.filter(
            tenant_id=tenant_id,
            code=config.dataset_code,
            deleted_at__isnull=True,
            is_active=True,
        ).prefetch_related('integration_config').first()
        if not dataset:
            return None

        output_type = getattr(dataset, 'output_type', None) or OUTPUT_TYPE_LIST
        if output_type != OUTPUT_TYPE_MULTI_METRIC:
            return None

        resp = await self.execute_query(
            tenant_id=tenant_id,
            dataset_uuid=dataset.uuid,
            execute_request=ExecuteQueryRequest(parameters=None, limit=1, offset=0),
        )
        if not resp.success or not resp.data:
            return {"stat_cards": [], "dataset_code": config.dataset_code}

        row = resp.data[0]
        display_config = getattr(dataset, 'display_config', None) or {}
        columns_config = display_config.get('columns') or []
        stat_cards = []
        for col in columns_config:
            key = col.get('key')
            if key is None:
                continue
            val = row.get(key)
            stat_cards.append({
                "key": key,
                "title": col.get('label', key),
                "value": val,
                "suffix": col.get('suffix'),
                "color": col.get('color'),
                "precision": col.get('precision'),
                "formatter": col.get('formatter', 'number'),
                "filter_key": col.get('filter_key'),
                "filter_value": col.get('filter_value'),
            })
        return {"stat_cards": stat_cards, "dataset_code": config.dataset_code}

    async def bind_page_metric(
        self,
        tenant_id: int,
        page_path: str,
        dataset_code: str,
        sort_order: int = 0,
    ) -> "PageMetricConfig":
        """
        绑定页面与指标型数据集。
        若已存在则更新，否则创建。
        """
        from core.models.page_metric_config import PageMetricConfig
        from datetime import datetime

        dataset = await Dataset.filter(
            tenant_id=tenant_id,
            code=dataset_code,
            deleted_at__isnull=True,
            is_active=True,
        ).first()
        if not dataset:
            raise NotFoundError(f"数据集不存在或未启用: {dataset_code}")
        ot = getattr(dataset, 'output_type', None) or OUTPUT_TYPE_LIST
        if ot != OUTPUT_TYPE_MULTI_METRIC:
            raise ValidationError(f"数据集 {dataset_code} 必须是 multi_metric 类型")

        config = await PageMetricConfig.filter(
            tenant_id=tenant_id,
            page_path=page_path,
            deleted_at__isnull=True,
        ).first()
        if config:
            config.dataset_code = dataset_code
            config.sort_order = sort_order
            await config.save()
        else:
            config = await PageMetricConfig.create(
                tenant_id=tenant_id,
                page_path=page_path,
                dataset_code=dataset_code,
                sort_order=sort_order,
            )
        return config

    async def list_page_metric_configs(
        self,
        tenant_id: int,
    ) -> List["PageMetricConfig"]:
        """列出当前租户的页面指标配置"""
        return await PageMetricConfig.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).order_by("sort_order", "page_path").all()

    async def unbind_page_metric(
        self,
        tenant_id: int,
        page_path: str,
    ) -> None:
        """解除页面与指标数据集的绑定（软删除）"""
        from datetime import datetime

        config = await PageMetricConfig.filter(
            tenant_id=tenant_id,
            page_path=page_path,
            deleted_at__isnull=True,
        ).first()
        if config:
            config.deleted_at = resolve_business_datetime()
            await config.save()

    async def init_sales_order_metrics(self, tenant_id: int) -> Dict[str, Any]:
        """
        一键初始化销售订单指标：创建 sales_order_metrics 数据集并绑定到销售订单页面。
        若数据集已存在则跳过创建，仅确保页面绑定存在。
        """
        SALES_ORDER_PAGE_PATH = "/apps/kuaizhizao/sales-management/sales-orders"
        DATASET_CODE = "sales_order_metrics"

        # 优先使用系统默认数据源，否则取第一个 postgresql 类型的 IntegrationConfig
        integration_config = await IntegrationConfig.filter(
            tenant_id=tenant_id,
            code="system_default",
            deleted_at__isnull=True,
        ).first()
        if not integration_config:
            integration_config = await IntegrationConfig.filter(
                tenant_id=tenant_id,
                type="postgresql",
                deleted_at__isnull=True,
            ).first()
        if not integration_config:
            raise ValidationError("未找到 PostgreSQL 数据连接，请先在数据源管理中配置")

        # 检查数据集是否已存在
        existing_dataset = await Dataset.filter(
            tenant_id=tenant_id,
            code=DATASET_CODE,
            deleted_at__isnull=True,
        ).first()

        if not existing_dataset:
            query_config = {
                "sql": """
SELECT
  (SELECT COUNT(*)::int FROM apps_kuaizhizao_sales_orders
   WHERE tenant_id = :tenant_id AND deleted_at IS NULL
     AND delivery_date < CURRENT_DATE
     AND status IN ('AUDITED','已审核','CONFIRMED','已确认')
     AND review_status NOT IN ('REJECTED','已驳回','审核驳回','驳回')
     AND status NOT IN ('COMPLETED','已完成','FINISHED')) AS overdue_count,
  (SELECT COUNT(*)::int FROM apps_kuaizhizao_sales_orders
   WHERE tenant_id = :tenant_id AND deleted_at IS NULL AND order_date = CURRENT_DATE) AS today_new_count,
  (SELECT COUNT(*)::int FROM apps_kuaizhizao_sales_orders
   WHERE tenant_id = :tenant_id AND deleted_at IS NULL
     AND review_status IN ('PENDING','PENDING_REVIEW','待审核')) AS pending_review_count,
  (SELECT COUNT(*)::int FROM apps_kuaizhizao_sales_orders
   WHERE tenant_id = :tenant_id AND deleted_at IS NULL
     AND status NOT IN ('CANCELLED','已取消','COMPLETED','已完成','FINISHED')
     AND review_status NOT IN ('REJECTED','已驳回','审核驳回','驳回')) AS unfulfilled_count,
  (SELECT COALESCE(SUM(total_amount), 0)::numeric(18,2) FROM apps_kuaizhizao_sales_orders
   WHERE tenant_id = :tenant_id AND deleted_at IS NULL
     AND order_date >= date_trunc('year', CURRENT_DATE)::date
     AND status NOT IN ('CANCELLED','已取消')
     AND review_status NOT IN ('REJECTED','已驳回','审核驳回','驳回')) AS annual_total_amount
"""
            }
            display_config = {
                "columns": [
                    {"key": "overdue_count", "label": "逾期未交", "formatter": "number", "color": "#ff4d4f"},
                    {"key": "today_new_count", "label": "今日新签", "formatter": "number", "suffix": "单", "color": "#1890ff"},
                    {"key": "pending_review_count", "label": "待审核", "formatter": "number", "color": "#faad14"},
                    {"key": "unfulfilled_count", "label": "未履约", "formatter": "number", "color": "#2f54eb"},
                    {"key": "annual_total_amount", "label": "本年累计", "formatter": "number", "precision": 2, "color": "#1890ff"},
                ]
            }
            dataset_data = DatasetCreate(
                name="销售订单指标",
                code=DATASET_CODE,
                description="销售订单列表页指标卡数据",
                query_type="sql",
                query_config=query_config,
                output_type=OUTPUT_TYPE_MULTI_METRIC,
                display_config=display_config,
                is_active=True,
                data_source_uuid=UUID(str(integration_config.uuid)),
            )
            await self.create_dataset(tenant_id=tenant_id, dataset_data=dataset_data)
            created = True
        else:
            created = False

        # 确保页面绑定存在（若已绑定则更新 sort_order）
        await self.bind_page_metric(
            tenant_id=tenant_id,
            page_path=SALES_ORDER_PAGE_PATH,
            dataset_code=DATASET_CODE,
            sort_order=0,
        )

        return {
            "created": created,
            "dataset_code": DATASET_CODE,
            "message": "销售订单指标已初始化" if created else "销售订单指标已存在，已更新页面绑定",
        }

    async def init_sales_forecast_metrics(self, tenant_id: int) -> Dict[str, Any]:
        """
        一键初始化销售预测指标：创建 sales_forecast_metrics 数据集并绑定到销售预测页面。
        """
        PAGE_PATH = "/apps/kuaizhizao/sales-management/sales-forecasts"
        DATASET_CODE = "sales_forecast_metrics"

        # 优先使用系统默认数据源
        integration_config = await IntegrationConfig.filter(
            tenant_id=tenant_id,
            code="system_default",
            deleted_at__isnull=True,
        ).first()
        if not integration_config:
            integration_config = await IntegrationConfig.filter(
                tenant_id=tenant_id,
                type="postgresql",
                deleted_at__isnull=True,
            ).first()
        if not integration_config:
            raise ValidationError("未找到 PostgreSQL 数据连接，请先在数据源管理中配置")

        # 检查数据集是否已存在
        existing_dataset = await Dataset.filter(
            tenant_id=tenant_id,
            code=DATASET_CODE,
            deleted_at__isnull=True,
        ).first()

        if not existing_dataset:
            query_config = {
                "sql": """
SELECT
  (SELECT COUNT(*)::int FROM apps_kuaizhizao_sales_forecasts
   WHERE tenant_id = :tenant_id AND deleted_at IS NULL
     AND status IN ('已审核', '已下推')
     AND end_date < CURRENT_DATE) AS overdue_count,
  (SELECT COUNT(*)::int FROM apps_kuaizhizao_sales_forecasts
   WHERE tenant_id = :tenant_id AND deleted_at IS NULL 
     AND created_at >= CURRENT_DATE) AS today_new_count,
  (SELECT COUNT(*)::int FROM apps_kuaizhizao_sales_forecasts
   WHERE tenant_id = :tenant_id AND deleted_at IS NULL
     AND status = '待审核') AS pending_review_count,
  (SELECT COUNT(*)::int FROM apps_kuaizhizao_sales_forecasts
   WHERE tenant_id = :tenant_id AND deleted_at IS NULL
     AND status IN ('已审核', '已下推')) AS in_progress_count
"""
            }
            display_config = {
                "columns": [
                    {"key": "today_new_count", "label": "今日新增", "formatter": "number", "suffix": "单", "color": "#1890ff", "filter_key": "dateRange", "filter_value": "today"},
                    {"key": "pending_review_count", "label": "待审核", "formatter": "number", "color": "#faad14", "filter_key": "status", "filter_value": "待审核"},
                    {"key": "in_progress_count", "label": "执行中", "formatter": "number", "color": "#52c41a", "filter_key": "status", "filter_value": "已下推"},
                    {"key": "overdue_count", "label": "逾期未交", "formatter": "number", "color": "#f5222d"},
                ]
            }
            dataset_data = DatasetCreate(
                name="销售预测指标",
                code=DATASET_CODE,
                description="销售预测列表页指标卡数据",
                query_type="sql",
                query_config=query_config,
                output_type=OUTPUT_TYPE_MULTI_METRIC,
                display_config=display_config,
                is_active=True,
                data_source_uuid=UUID(str(integration_config.uuid)),
            )
            await self.create_dataset(tenant_id=tenant_id, dataset_data=dataset_data)
            created = True
        else:
            created = False

        # 确保页面绑定存在
        await self.bind_page_metric(
            tenant_id=tenant_id,
            page_path=PAGE_PATH,
            dataset_code=DATASET_CODE,
            sort_order=0,
        )

        return {
            "created": created,
            "dataset_code": DATASET_CODE,
            "message": "销售预测指标已初始化" if created else "销售预测指标已存在，已更新页面绑定",
        }

    async def sync_all_page_metrics(self, tenant_id: int) -> Dict[str, Any]:
        """
        同步/初始化所有内置模块的页面指标数据集。
        """
        results = []
        
        # 1. 销售订单
        try:
            res1 = await self.init_sales_order_metrics(tenant_id)
            results.append({"module": "销售订单", "success": True, "message": res1["message"]})
        except Exception as e:
            results.append({"module": "销售订单", "success": False, "message": str(e)})

        # 2. 销售预测
        try:
            res2 = await self.init_sales_forecast_metrics(tenant_id)
            results.append({"module": "销售预测", "success": True, "message": res2["message"]})
        except Exception as e:
            results.append({"module": "销售预测", "success": False, "message": str(e)})

        return {
            "success": True,
            "results": results,
            "message": "已尝试同步所有内置模块指标"
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

