"""
集成配置管理服务模块

提供集成配置的 CRUD 操作和连接测试功能。
系统默认数据源（code=system_default）：密码来自环境变量，不可编辑/删除。
"""

import asyncio
from typing import Optional, List, Dict, Any, Tuple  # noqa: F401
from uuid import UUID
from tortoise.exceptions import IntegrityError
import httpx  # 仅用于 BasicAuth 等类型

from core.models.integration_config import IntegrationConfig
from core.schemas.integration_config import IntegrationConfigCreate, IntegrationConfigUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.http import get_http_client

# 系统默认数据源代码（密码从 ENV 读取，不可编辑）
SYSTEM_DEFAULT_CODE = "system_default"

# 以下类型当前仅做配置项/可达性类校验，未对目标库发起真实连接；测试「成功」不代表 TCP/认证一定可用。
_CONFIG_ONLY_CONNECTION_TYPES = frozenset({
    "oracle",
    "redis",
    "clickhouse",
    "influxdb",
    "doris",
    "starrocks",
    "elasticsearch",
    "mysql",
    "mongodb",
    "Database",
})


def _config_only_user_message(integration_type: str) -> str:
    """对仅配置校验的类型返回明确文案，避免与真实建连成功混淆。"""
    label_map = {
        "oracle": "Oracle",
        "redis": "Redis",
        "clickhouse": "ClickHouse",
        "influxdb": "InfluxDB",
        "doris": "Doris",
        "starrocks": "StarRocks",
        "elasticsearch": "Elasticsearch",
        "mysql": "MySQL",
        "mongodb": "MongoDB",
        "Database": "Database",
    }
    label = label_map.get(integration_type, integration_type)
    return (
        f"{label} 配置检查通过：已校验必填项；当前版本未发起真实连接，"
        f"无法确认网络、端口与账号密码是否可用。"
    )


def _get_system_default_pg_config() -> Dict[str, Any]:
    """从环境变量获取系统默认 PostgreSQL 连接配置（密码不落库）"""
    from infra.config.infra_config import infra_settings
    return {
        "host": infra_settings.DB_HOST,
        "port": infra_settings.DB_PORT,
        "user": infra_settings.DB_USER,
        "username": infra_settings.DB_USER,
        "password": infra_settings.DB_PASSWORD,
        "database": infra_settings.DB_NAME,
    }


def _mask_config_password(config: Dict[str, Any]) -> Dict[str, Any]:
    """脱敏：将 config 中的敏感字段替换为占位符，避免 API 暴露"""
    if not config:
        return {}
    out = dict(config)
    for key in ("password", "app_secret", "client_secret", "secret"):
        if key in out and out[key]:
            out[key] = "****"
    return out


def build_integration_response(integration: IntegrationConfig) -> Dict[str, Any]:
    """构建 API 响应（config 脱敏，is_system_default/is_editable）"""
    is_system_default = integration.code == SYSTEM_DEFAULT_CODE
    return {
        "uuid": str(integration.uuid),
        "tenant_id": integration.tenant_id,
        "name": integration.name,
        "code": integration.code,
        "type": integration.type,
        "description": integration.description,
        "config": _mask_config_password(integration.config or {}),
        "is_active": integration.is_active,
        "is_connected": integration.is_connected,
        "last_connected_at": integration.last_connected_at,
        "last_error": integration.last_error,
        "created_at": integration.created_at,
        "updated_at": integration.updated_at,
        "is_system_default": is_system_default,
        "is_editable": not is_system_default,
    }


class IntegrationConfigService:
    """
    集成配置管理服务类
    
    提供集成配置的 CRUD 操作和连接测试功能。
    """
    
    @staticmethod
    async def create_integration(
        tenant_id: int,
        data: IntegrationConfigCreate
    ) -> IntegrationConfig:
        """
        创建集成配置
        
        Args:
            tenant_id: 组织ID
            data: 集成配置创建数据
            
        Returns:
            IntegrationConfig: 创建的集成配置对象
            
        Raises:
            ValidationError: 当集成代码已存在时抛出
        """
        try:
            integration = IntegrationConfig(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await integration.save()
            return integration
        except IntegrityError:
            raise ValidationError(f"集成代码 {data.code} 已存在")
    
    @staticmethod
    async def get_integration_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> IntegrationConfig:
        """
        根据UUID获取集成配置
        
        Args:
            tenant_id: 组织ID
            uuid: 集成配置UUID
            
        Returns:
            IntegrationConfig: 集成配置对象
            
        Raises:
            NotFoundError: 当集成配置不存在时抛出
        """
        integration = await IntegrationConfig.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not integration:
            raise NotFoundError("集成配置不存在")
        
        return integration
    
    @staticmethod
    async def get_integration_by_code(
        tenant_id: int,
        code: str
    ) -> Optional[IntegrationConfig]:
        """
        根据代码获取集成配置
        
        Args:
            tenant_id: 组织ID
            code: 集成代码
            
        Returns:
            IntegrationConfig: 集成配置对象，如果不存在返回 None
        """
        return await IntegrationConfig.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True
        ).first()
    
    @staticmethod
    async def list_integrations(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        type: Optional[str] = None,
        types: Optional[list[str]] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> tuple[List[IntegrationConfig], int]:
        """
        获取集成配置列表（分页）

        Args:
            tenant_id: 组织ID
            page: 页码（从 1 开始）
            page_size: 每页数量
            type: 集成类型（可选）
            is_active: 是否启用（可选）
            search: 关键词（名称、代码、描述）
            sort_by / sort_order: 排序（白名单字段）

        Returns:
            (集成配置列表, 总数)
        """
        query = IntegrationConfig.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )

        if types is not None:
            query = query.filter(type__in=types)
        elif type:
            query = query.filter(type=type)

        if is_active is not None:
            query = query.filter(is_active=is_active)

        if search:
            from tortoise.expressions import Q
            q = search.strip()
            if q:
                query = query.filter(
                    Q(name__icontains=q)
                    | Q(code__icontains=q)
                    | Q(description__icontains=q)
                )

        total = await query.count()

        allowed_sort = {
            "name",
            "code",
            "type",
            "created_at",
            "updated_at",
            "is_active",
            "last_connected_at",
        }
        if sort_by in allowed_sort:
            desc = sort_order and str(sort_order).lower() in ("desc", "descend")
            primary = f"-{sort_by}" if desc else sort_by
            ordered = query.order_by(primary, "id")
        else:
            ordered = query.order_by("-created_at", "id")

        safe_page = max(page, 1)
        safe_size = min(max(page_size, 1), 1000)
        offset = (safe_page - 1) * safe_size
        items = await ordered.offset(offset).limit(safe_size).all()
        return items, total
    
    @staticmethod
    async def update_integration(
        tenant_id: int,
        uuid: str,
        data: IntegrationConfigUpdate
    ) -> IntegrationConfig:
        """
        更新集成配置
        
        Args:
            tenant_id: 组织ID
            uuid: 集成配置UUID
            data: 集成配置更新数据
            
        Returns:
            IntegrationConfig: 更新后的集成配置对象
            
        Raises:
            NotFoundError: 当集成配置不存在时抛出
        """
        integration = await IntegrationConfigService.get_integration_by_uuid(tenant_id, uuid)
        if integration.code == SYSTEM_DEFAULT_CODE:
            raise ValidationError("系统默认数据源不可编辑，密码来自环境变量")
        
        update_data = data.model_dump(exclude_unset=True)

        if "config" in update_data and isinstance(update_data["config"], dict):
            old_cfg = dict(integration.config or {})
            new_cfg = dict(update_data["config"])
            merged = {**old_cfg, **new_cfg}
            for sk in ("password", "app_secret", "client_secret", "secret"):
                if merged.get(sk) == "****" and old_cfg.get(sk) not in (None, "", "****"):
                    merged[sk] = old_cfg[sk]
            update_data["config"] = merged
        
        for key, value in update_data.items():
            setattr(integration, key, value)
        
        await integration.save()
        return integration
    
    @staticmethod
    async def delete_integration(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除集成配置（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 集成配置UUID
            
        Raises:
            NotFoundError: 当集成配置不存在时抛出
        """
        integration = await IntegrationConfigService.get_integration_by_uuid(tenant_id, uuid)
        if integration.code == SYSTEM_DEFAULT_CODE:
            raise ValidationError("系统默认数据源不可删除")
        
        # 软删除
        from datetime import datetime
        integration.deleted_at = datetime.now()
        await integration.save()
    
    @staticmethod
    async def test_connection(
        tenant_id: int,
        uuid: str
    ) -> Dict[str, Any]:
        """
        测试连接
        
        Args:
            tenant_id: 组织ID
            uuid: 集成配置UUID
            
        Returns:
            Dict[str, Any]: 连接测试结果
            
        Raises:
            NotFoundError: 当集成配置不存在时抛出
        """
        integration = await IntegrationConfigService.get_integration_by_uuid(tenant_id, uuid)
        
        try:
            # 根据集成类型测试连接
            if integration.type in ("API", "api"):
                result = await IntegrationConfigService._test_api_connection(integration)
            elif integration.type == "OAuth":
                result = await IntegrationConfigService._test_oauth_connection(integration)
            elif integration.type == "Webhook":
                result = await IntegrationConfigService._test_webhook_connection(integration)
            elif integration.type == "Database":
                result = await IntegrationConfigService._test_database_connection(integration)
            elif integration.type == "postgresql":
                result = await IntegrationConfigService._test_postgresql_connection(integration)
            elif integration.type == "mysql":
                result = await IntegrationConfigService._test_mysql_connection(integration)
            elif integration.type == "mongodb":
                result = await IntegrationConfigService._test_mongodb_connection(integration)
            elif integration.type == "sqlserver":
                result = await IntegrationConfigService._test_sqlserver_connection(integration)
            elif integration.type in ("oracle", "redis", "clickhouse", "influxdb", "doris", "starrocks", "elasticsearch"):
                result = await IntegrationConfigService._test_database_config_validation(integration)
            elif integration.type == "feishu":
                result = await IntegrationConfigService._test_feishu_connection(integration)
            elif integration.type == "dingtalk":
                result = await IntegrationConfigService._test_dingtalk_connection(integration)
            elif integration.type == "wecom":
                result = await IntegrationConfigService._test_wecom_connection(integration)
            elif integration.type in (
                "sap", "kingdee", "yonyou", "dsc", "inspur", "digiwin_e10",
                "grasp_erp", "super_erp", "chanjet_tplus", "kingdee_kis",
                "oracle_netsuite", "erpnext", "odoo", "sunlike_erp",
                "teamcenter", "windchill", "caxa", "sanpin_plm", "sunlike_plm", "sipm", "inteplm",
                "salesforce", "xiaoshouyi", "fenxiang", "qidian", "supra_crm",
                "weaver", "seeyon", "landray", "cloudhub", "tongda_oa",
                "rootcloud", "casicloud", "alicloud_iot", "huaweicloud_iot", "thingsboard", "jetlinks",
                "flux_wms", "kejian_wms", "digiwin_wms", "openwms",
            ):
                result = await IntegrationConfigService._test_rest_api_connection(integration)
            else:
                raise ValueError(f"不支持的集成类型: {integration.type}")

            if not isinstance(result, dict):
                result = {"message": str(result)}
            if isinstance(result, dict) and result.get("success") is False:
                raise ValueError(result.get("message", "连接失败"))

            if integration.type in _CONFIG_ONLY_CONNECTION_TYPES:
                # 未真实建连：不标记为已连接，避免列表/详情出现「已连通」误导；也不写入 last_error（非失败）
                integration.update_connection_status(False, None)
                await integration.save()
                merged = {**result, "verification_level": "config_only"}
                return {
                    "success": True,
                    "message": _config_only_user_message(integration.type),
                    "data": merged,
                }

            integration.update_connection_status(True)
            await integration.save()
            merged = {**result, "verification_level": "live"}
            return {
                "success": True,
                "message": "连接成功",
                "data": merged,
            }
        except Exception as e:
            # 更新连接状态（失败）
            integration.update_connection_status(False, str(e))
            await integration.save()
            
            return {
                "success": False,
                "message": f"连接失败: {str(e)}",
                "error": str(e)
            }
    
    @staticmethod
    async def _test_api_connection(integration: IntegrationConfig) -> Dict[str, Any]:
        """
        测试 API 连接
        
        Args:
            integration: 集成配置对象
            
        Returns:
            Dict[str, Any]: 测试结果
        """
        config = integration.get_config()
        url = config.get("url") or config.get("base_url")
        if not url:
            raise ValueError("API URL 未配置")
        
        method = config.get("method", "GET")
        headers = config.get("headers", {})
        timeout = config.get("timeout", 10.0)

        response = await get_http_client().request(
            method,
            url,
            headers=headers,
            timeout=timeout,
        )
        return {
            "status_code": response.status_code,
            "response": response.text[:200] if response.text else "",
        }
    
    @staticmethod
    async def _test_oauth_connection(integration: IntegrationConfig) -> Dict[str, Any]:
        """
        测试 OAuth 连接
        
        Args:
            integration: 集成配置对象
            
        Returns:
            Dict[str, Any]: 测试结果
            
        Note:
            后续可以集成 authlib 实现完整的 OAuth 测试
        """
        config = integration.get_config()
        # 基本验证：检查必要配置项
        required_fields = ["client_id", "client_secret", "authorization_url", "token_url"]
        for field in required_fields:
            if not config.get(field):
                raise ValueError(f"OAuth 配置缺少必要字段: {field}")
        
        return {
            "message": "OAuth 配置验证成功（完整连接测试需要集成 authlib）"
        }
    
    @staticmethod
    async def _test_webhook_connection(integration: IntegrationConfig) -> Dict[str, Any]:
        """
        测试 Webhook 连接
        
        Args:
            integration: 集成配置对象
            
        Returns:
            Dict[str, Any]: 测试结果
        """
        config = integration.get_config()
        url = config.get("url")
        if not url:
            raise ValueError("Webhook URL 未配置")
        
        # 发送测试请求
        method = config.get("method", "POST")
        headers = config.get("headers", {})
        timeout = config.get("timeout", 10.0)
        test_payload = config.get("test_payload", {"test": True})

        response = await get_http_client().request(
            method,
            url,
            headers=headers,
            json=test_payload,
            timeout=timeout,
        )
        return {
            "status_code": response.status_code,
            "message": "Webhook 测试请求发送成功",
        }
    
    @staticmethod
    async def _test_database_connection(integration: IntegrationConfig) -> Dict[str, Any]:
        """
        测试数据库连接
        
        Args:
            integration: 集成配置对象
            
        Returns:
            Dict[str, Any]: 测试结果
            
        Note:
            后续可以集成 Tortoise ORM 或其他数据库驱动实现完整的数据库连接测试
        """
        config = integration.get_config()
        # 基本验证：检查必要配置项
        required_fields = ["host", "port", "database", "user", "password"]
        for field in required_fields:
            if not config.get(field):
                raise ValueError(f"数据库配置缺少必要字段: {field}")
        
        # TODO: 后续可以实现实际的数据库连接测试
        # 例如：使用 Tortoise ORM 或其他数据库驱动
        
        return {
            "message": "数据库配置验证成功（完整连接测试需要集成数据库驱动）"
        }

    @staticmethod
    async def test_config(type_: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        保存前测试连接配置（不落库）
        
        Args:
            type_: 集成类型
            config: 连接配置字典
            
        Returns:
            Dict[str, Any]: 测试结果 { success, message, data?, error? }
        """
        class _TempConfig:
            def __init__(self, t: str, c: Dict[str, Any]):
                self.type = t
                self.config = c or {}
            def get_config(self) -> Dict[str, Any]:
                return self.config

        temp = _TempConfig(type_, config)
        try:
            if temp.type in ("API", "api"):
                result = await IntegrationConfigService._test_api_connection(temp)
            elif temp.type == "OAuth":
                result = await IntegrationConfigService._test_oauth_connection(temp)
            elif temp.type == "Webhook":
                result = await IntegrationConfigService._test_webhook_connection(temp)
            elif temp.type == "Database":
                result = await IntegrationConfigService._test_database_connection(temp)
            elif temp.type == "postgresql":
                result = await IntegrationConfigService._test_postgresql_connection(temp)
            elif temp.type == "mysql":
                result = await IntegrationConfigService._test_mysql_connection(temp)
            elif temp.type == "mongodb":
                result = await IntegrationConfigService._test_mongodb_connection(temp)
            elif temp.type == "sqlserver":
                result = await IntegrationConfigService._test_sqlserver_connection(temp)
            elif temp.type in ("oracle", "redis", "clickhouse", "influxdb", "doris", "starrocks", "elasticsearch"):
                result = await IntegrationConfigService._test_database_config_validation(temp)
            elif temp.type == "feishu":
                result = await IntegrationConfigService._test_feishu_connection(temp)
            elif temp.type == "dingtalk":
                result = await IntegrationConfigService._test_dingtalk_connection(temp)
            elif temp.type == "wecom":
                result = await IntegrationConfigService._test_wecom_connection(temp)
            elif temp.type in (
                "sap", "kingdee", "yonyou", "dsc", "inspur", "digiwin_e10",
                "grasp_erp", "super_erp", "chanjet_tplus", "kingdee_kis",
                "oracle_netsuite", "erpnext", "odoo", "sunlike_erp",
                "teamcenter", "windchill", "caxa", "sanpin_plm", "sunlike_plm", "sipm", "inteplm",
                "salesforce", "xiaoshouyi", "fenxiang", "qidian", "supra_crm",
                "weaver", "seeyon", "landray", "cloudhub", "tongda_oa",
                "rootcloud", "casicloud", "alicloud_iot", "huaweicloud_iot", "thingsboard", "jetlinks",
                "flux_wms", "kejian_wms", "digiwin_wms", "openwms",
            ):
                result = await IntegrationConfigService._test_rest_api_connection(temp)
            else:
                raise ValueError(f"不支持的集成类型: {temp.type}")
            if isinstance(result, dict) and result.get("success") is False:
                return {
                    "success": False,
                    "message": result.get("message", "连接失败"),
                    "error": result.get("message"),
                }
            if not isinstance(result, dict):
                result = {"message": str(result)}
            if temp.type in _CONFIG_ONLY_CONNECTION_TYPES:
                return {
                    "success": True,
                    "message": _config_only_user_message(temp.type),
                    "data": {**result, "verification_level": "config_only"},
                }
            return {
                "success": True,
                "message": result.get("message", "连接成功"),
                "data": {**result, "verification_level": "live"},
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"连接失败: {str(e)}",
                "error": str(e),
            }

    @staticmethod
    async def get_schema(tenant_id: int, uuid: str) -> Dict[str, Any]:
        """
        获取数据源的表/列元数据（用于图形化查询构建器）
        目前仅支持 PostgreSQL。
        
        Returns:
            Dict: { "tables": [ { "name": "t1", "columns": [ { "name": "c1", "type": "varchar" } ] } ] }
        """
        integration = await IntegrationConfigService.get_integration_by_uuid(tenant_id, uuid)
        if integration.type != "postgresql":
            return {
                "tables": [],
                "error": f"Schema 暂仅支持 PostgreSQL，当前类型: {integration.type}",
            }
        config = integration.get_config()
        if config.get("_system_default"):
            config = _get_system_default_pg_config()
        try:
            import asyncpg
            host = config.get("host", "localhost")
            port = config.get("port", 5432)
            database = config.get("database", "")
            user = config.get("user") or config.get("username", "")
            password = config.get("password", "")
            conn = await asyncpg.connect(
                host=host,
                port=int(port),
                user=user,
                password=password,
                database=database,
            )
            rows = await conn.fetch(
                """
                SELECT table_schema, table_name, column_name, data_type, ordinal_position
                FROM information_schema.columns
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_schema, table_name, ordinal_position
                """
            )
            await conn.close()
            tables_map: Dict[str, List[Dict[str, str]]] = {}
            for row in rows:
                tbl = f"{row['table_schema']}.{row['table_name']}"
                if tbl not in tables_map:
                    tables_map[tbl] = []
                tables_map[tbl].append({
                    "name": str(row["column_name"]),
                    "type": str(row["data_type"]),
                })
            tables = [
                {"name": k, "columns": v}
                for k, v in tables_map.items()
            ]
            return {"tables": tables}
        except Exception as e:
            return {"tables": [], "error": str(e)}

    @staticmethod
    async def _test_postgresql_connection(integration: IntegrationConfig) -> Dict[str, Any]:
        """测试 PostgreSQL 连接（config: host, port, database, user/username, password；系统默认从 ENV 读取）"""
        config = integration.get_config()
        if config.get("_system_default"):
            config = _get_system_default_pg_config()
        try:
            import asyncpg
            host = config.get("host", "localhost")
            port = config.get("port", 5432)
            database = config.get("database", "")
            user = config.get("user") or config.get("username", "")
            password = config.get("password", "")
            conn = await asyncpg.connect(
                host=host,
                port=int(port),
                user=user,
                password=password,
                database=database,
            )
            await conn.fetchval("SELECT 1")
            await conn.close()
            return {"success": True, "message": "PostgreSQL 连接成功"}
        except Exception as e:
            return {"success": False, "message": f"PostgreSQL 连接失败: {str(e)}"}

    @staticmethod
    def _normalize_sqlserver_host_and_port(config: Dict[str, Any]) -> tuple[str, int]:
        """
        解析 host / port，与 Navicat、SSMS 常见写法一致：
        - host 可为「tcp:主机,端口」或「主机,端口」，逗号后为 TCP 端口。
        - 命名实例可写「SERVER\\INSTANCE,端口」（逗号后为静态端口，与 SSMS 一致）。
        - 若 host 中带端口，则优先使用该端口（避免表单仍填默认 1433 导致 20002）。
        """
        raw = (config.get("host") or "").strip()
        if not raw:
            return "", 1433
        host = raw
        if host.lower().startswith("tcp:"):
            host = host[4:].strip()
        port_cfg = config.get("port")
        embedded: Optional[int] = None
        # 支持「主机,端口」与「命名实例,端口」（如 SERVER\SQLEXPRESS,50444），与 Navicat/SSMS 常见写法一致
        if "," in host:
            left, right = host.rsplit(",", 1)
            rs = right.strip()
            if rs.isdigit():
                host = left.strip()
                embedded = int(rs)
        if embedded is not None:
            port_out = embedded
        elif port_cfg is None or port_cfg == "":
            port_out = 1433
        else:
            port_out = int(port_cfg)
        return host, port_out

    @staticmethod
    def _sqlserver_exception_repr(exc: BaseException) -> str:
        """将 pymssql/FreeTDS 抛出的 tuple、bytes 等转为可读字符串。"""
        if isinstance(exc, BaseExceptionGroup):  # py311
            parts = [IntegrationConfigService._sqlserver_exception_repr(s) for s in exc.exceptions]
            return "; ".join(parts)
        args = getattr(exc, "args", None)
        if args and len(args) == 1 and isinstance(args[0], tuple) and len(args[0]) >= 2:
            code, msg = args[0][0], args[0][1]
            if isinstance(msg, (bytes, bytearray)):
                msg = msg.decode("utf-8", errors="replace").strip() or "(binary message)"
            return f"{code}, {msg}"
        if isinstance(exc, tuple) and len(exc) >= 2:
            code, msg = exc[0], exc[1]
            if isinstance(msg, (bytes, bytearray)):
                msg = msg.decode("utf-8", errors="replace").strip() or "(binary message)"
            return f"{code}, {msg}"
        return str(exc).strip() or type(exc).__name__

    @staticmethod
    def _sqlserver_tcp_probe_sync(host: str, port: int, timeout: float = 5.0) -> Optional[str]:
        """TCP 层探测；失败时返回简短说明（便于与 TDS 20002 区分）。"""
        import socket

        try:
            with socket.create_connection((host, int(port)), timeout=timeout):
                return None
        except OSError as e:
            return f"无法建立 TCP 连接 {host}:{port}（{e.strerror or e}）"

    @staticmethod
    def _normalize_pymssql_tds_version(raw: Any) -> str:
        """
        pymssql/FreeTDS 仅支持约 4.2–7.4；前端「8.0」对应 ODBC/TDS 命名，传入 FreeTDS 易触发 20002，映射为 7.4。
        """
        if raw is None or raw == "":
            return "7.2"
        s = str(raw).strip()
        if not s:
            return "7.2"
        key = s.replace("_", ".").lower()
        if key in ("8", "8.0", "80"):
            return "7.4"
        allowed = frozenset({"4.2", "5.0", "7.0", "7.1", "7.2", "7.3", "7.4"})
        if key in allowed:
            return key
        # 其它未知值避免传入 FreeTDS 产生怪异 20002
        return "7.4"

    @staticmethod
    def _sqlserver_user_locked_encryption(config: Dict[str, Any]) -> bool:
        """
        用户是否锁定了加密策略（仅尝试其选择）。
        「驱动默认 default」与留空一样：仍允许多策略自动协商（Navicat 常自动试多种组合）。
        """
        enc_raw = config.get("encryption")
        if isinstance(enc_raw, str):
            k = enc_raw.strip().lower()
            if not k or k == "default":
                return False
            return True
        if config.get("encrypt") is True or config.get("encrypt") is False:
            return True
        return False

    @staticmethod
    def _sqlserver_connection_attempt_kwargs(config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        生成 pymssql.connect 参数列表（去重）。
        用户未显式配置 encryption/encrypt 时，自动尝试多种加密协商方式，缓解 20002 / Unknown error。
        """
        base = IntegrationConfigService._build_sqlserver_connect_kwargs(config)
        transports = IntegrationConfigService._sqlserver_connect_candidates(base)

        locked_enc = IntegrationConfigService._sqlserver_user_locked_encryption(config)

        if locked_enc:
            return [dict(t) for t in transports]

        # off 优先：穿透/老版本 SQL Server 在 FreeTDS 下常先于 TLS 协商成功
        enc_profiles: List[Optional[str]] = ["off", None, "request", "default", "require"]

        attempts: List[Dict[str, Any]] = []
        seen: set[str] = set()

        for t in transports:
            for enc in enc_profiles:
                kw = dict(t)
                if enc is None:
                    kw.pop("encryption", None)
                else:
                    kw["encryption"] = enc
                sig = repr(sorted(kw.items()))
                if sig not in seen:
                    seen.add(sig)
                    attempts.append(kw)

        if not locked_enc and not config.get("tds_version"):
            extras: List[Dict[str, Any]] = []
            for kw in attempts:
                if kw.get("tds_version") == "7.2":
                    alt = dict(kw)
                    alt["tds_version"] = "7.4"
                    s = repr(sorted(alt.items()))
                    if s not in seen:
                        seen.add(s)
                        extras.append(alt)
            attempts.extend(extras)

        return attempts

    @staticmethod
    def _sqlserver_ping_sync(attempts: List[Dict[str, Any]]) -> None:
        """在线程中依次尝试 connect + SELECT 1，失败时抛出带摘要的异常。"""
        import pymssql

        last: Optional[BaseException] = None
        brief_errors: List[str] = []
        for kw in attempts:
            try:
                conn = pymssql.connect(**kw)
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT 1 AS n")
                    row = cur.fetchone()
                    if row is None or row[0] != 1:
                        raise RuntimeError("SQL Server 探测查询无有效结果")
                finally:
                    conn.close()
                return
            except Exception as e:
                last = e
                enc = kw.get("encryption", "(未设置)")
                tds = kw.get("tds_version", "")
                srv = kw.get("server", "")
                brief_errors.append(
                    f"[server={srv!s} enc={enc!s} tds={tds!s}] {IntegrationConfigService._sqlserver_exception_repr(e)}"
                )
        if last is not None:
            tail = brief_errors[-5:] if len(brief_errors) > 5 else brief_errors
            extra = " 最近尝试: " + " | ".join(tail) if tail else ""
            raise RuntimeError(
                f"{IntegrationConfigService._sqlserver_exception_repr(last)}{extra}"
            ) from last
        raise RuntimeError("SQL Server 连接失败: 无可用连接参数")

    @staticmethod
    def _format_sqlserver_error(exc: BaseException) -> str:
        text = IntegrationConfigService._sqlserver_exception_repr(exc)
        msg = f"SQL Server 连接失败: {text}"
        if "20002" in text or "Adaptive Server connection failed" in text or "Unknown error" in text:
            msg += (
                " 常见排查：①连接测试由「后端服务所在机器」发起，花生壳/FRP 须把公网端口映射到 SQL Server 的 TCP "
                "端口（与配置中端口一致），并放行防火墙；② SQL Server 配置管理器中启用 TCP/IP、确认实际监听端口；"
                "③ SQL Server 2008 R2 / 无 TLS 时优先选加密「关闭(off)」、TDS 选 7.2 或 7.4（勿选 8.0：FreeTDS 不支持该字面版本）；"
                "④已安装 ODBC Driver 17/18 时，后端会优先或回退使用 ODBC（与 Navicat 常用栈一致）；"
                "Driver 17 仅支持 Encrypt=yes/no，勿在连接串中使用 optional；"
                "⑤主机须与 Navicat 一致写成「域名,穿透端口」（如 vicp.fun,30198），勿只填域名却用默认 1433。"
            )
        return msg

    @staticmethod
    def _odbc_brace_segment(value: str) -> str:
        """ODBC 连接串中的 `{literal}`；字面量内的 `}` 需写成 `}}`。"""
        return "{" + str(value).replace("}", "}}") + "}"

    @staticmethod
    def _sqlserver_pyodbc_drivers() -> List[str]:
        try:
            import pyodbc
        except ImportError:
            return []
        names = [d for d in pyodbc.drivers() if "SQL Server" in d]
        if not names:
            return []

        def sort_key(n: str) -> tuple:
            lo = n.lower()
            if "odbc driver 18" in lo:
                return (0, n)
            if "odbc driver 17" in lo:
                return (1, n)
            if "native client" in lo and "11" in lo:
                return (2, n)
            if "native client" in lo:
                return (3, n)
            return (4, n)

        return sorted(names, key=sort_key)

    @staticmethod
    def _sqlserver_pyodbc_runtime_ready() -> bool:
        """pyodbc 已安装且本机已注册 SQL Server ODBC 驱动（与 Navicat 常用栈一致）。"""
        try:
            import pyodbc  # noqa: F401
        except ImportError:
            return False
        return bool(IntegrationConfigService._sqlserver_pyodbc_drivers())

    @staticmethod
    def _sqlserver_odbc_server_clause(host: str, port_int: int) -> str:
        """ODBC Server= 片段：默认实例用 tcp: 前缀强制 TCP；命名实例用「实例,端口」形式。"""
        if "\\" in host:
            return f"{host},{port_int}"
        return f"tcp:{host},{port_int}"

    @staticmethod
    def _sqlserver_pyodbc_driver_major_version(driver_name: str) -> Optional[int]:
        """从驱动注册名解析主版本（17/18 等），未知时返回 None。"""
        lo = (driver_name or "").lower()
        for ver in (18, 17, 13, 11):
            if f"odbc driver {ver}" in lo or f"native client {ver}" in lo:
                return ver
        return None

    @staticmethod
    def _sqlserver_pyodbc_logical_encrypt_modes(config: Dict[str, Any]) -> List[str]:
        """逻辑加密策略（与 UI / pymssql 含义对齐）；尚未按 ODBC 驱动版本裁剪。"""
        enc_raw = config.get("encryption")
        if isinstance(enc_raw, str):
            k = enc_raw.strip().lower()
            if k in ("off", "false", "no", "disable", "0"):
                return ["no"]
            if k in ("require", "strict", "mandatory", "true", "yes", "on", "1"):
                return ["yes", "mandatory"]
            if k in ("request", "optional", "prefer", "auto"):
                return ["optional", "yes"]
            if k == "default":
                return ["no", "optional", "yes", "mandatory"]
        if enc_raw in (0, False):
            return ["no"]
        if enc_raw in (1, True):
            return ["yes", "mandatory"]
        enc_legacy = config.get("encrypt")
        if enc_legacy in (0, False):
            return ["no"]
        if enc_legacy in (1, True, "1"):
            return ["yes", "mandatory"]
        if enc_legacy in ("0",):
            return ["no"]
        return ["no", "optional", "yes", "mandatory"]

    @staticmethod
    def _sqlserver_pyodbc_encrypt_literals_for_driver(
        driver_name: str, logical_modes: List[str]
    ) -> List[str]:
        """
        将逻辑模式映射为 ODBC 连接串合法的 Encrypt= 字面量。
        Driver 17 及更早仅支持 yes/no；optional/mandatory 为 Driver 18+ 同义词。
        """
        major = IntegrationConfigService._sqlserver_pyodbc_driver_major_version(driver_name)
        supports_extended = major is None or major >= 18
        odbc_map = {
            "no": "no",
            "yes": "yes",
            "optional": "optional" if supports_extended else "no",
            "mandatory": "mandatory" if supports_extended else "yes",
        }
        out: List[str] = []
        seen: set[str] = set()
        for mode in logical_modes:
            literal = odbc_map.get(mode)
            if literal and literal not in seen:
                seen.add(literal)
                out.append(literal)
        return out if out else ["no", "yes"]

    @staticmethod
    def _sqlserver_pyodbc_encrypt_modes_for_odbc(
        config: Dict[str, Any], driver_name: str = ""
    ) -> List[str]:
        """按驱动版本返回合法的 Encrypt= 取值列表（去重、保序）。"""
        logical = IntegrationConfigService._sqlserver_pyodbc_logical_encrypt_modes(config)
        if driver_name:
            return IntegrationConfigService._sqlserver_pyodbc_encrypt_literals_for_driver(
                driver_name, logical
            )
        return IntegrationConfigService._sqlserver_pyodbc_encrypt_literals_for_driver(
            "ODBC Driver 17 for SQL Server", logical
        )

    @staticmethod
    def _sqlserver_pyodbc_try_sync(config: Dict[str, Any]) -> Dict[str, Any]:
        """
        使用 pyodbc + 本机已安装的 SQL Server ODBC 驱动尝试建连（SELECT 1）。
        成功时返回 success/driver/encrypt；跳过（无 pyodbc 或无驱动）返回 skipped+hint；失败返回 error。
        """
        try:
            import pyodbc
        except ImportError:
            return {
                "success": False,
                "skipped": True,
                "hint": "可选安装 pyodbc 与 Microsoft ODBC Driver 17/18 for SQL Server："
                "在 pymssql/FreeTDS 与目标环境不兼容时，可走与 Navicat 相同的 ODBC 栈重试。",
            }

        drivers = IntegrationConfigService._sqlserver_pyodbc_drivers()
        if not drivers:
            return {
                "success": False,
                "skipped": True,
                "hint": "未检测到已注册的 ODBC Driver for SQL Server（pyodbc 已安装）。"
                "请在运行 RiverEdge 后端的机器上安装 Microsoft ODBC Driver 17 或 18 for SQL Server。",
            }

        host, port_int = IntegrationConfigService._normalize_sqlserver_host_and_port(config)
        database = (config.get("database") or "").strip()
        user = (config.get("user") or config.get("username") or "").strip()
        password = config.get("password")
        if password is None:
            password = ""
        login_timeout = int(config.get("login_timeout", 15))
        server_clause = IntegrationConfigService._sqlserver_odbc_server_clause(host, port_int)

        last_err: Optional[BaseException] = None
        for driver in drivers:
            encrypt_sequence = IntegrationConfigService._sqlserver_pyodbc_encrypt_modes_for_odbc(
                config, driver
            )
            for enc in encrypt_sequence:
                conn_str = (
                    f"DRIVER={IntegrationConfigService._odbc_brace_segment(driver)};"
                    f"SERVER={IntegrationConfigService._odbc_brace_segment(server_clause)};"
                    f"DATABASE={IntegrationConfigService._odbc_brace_segment(database)};"
                    f"UID={IntegrationConfigService._odbc_brace_segment(user)};"
                    f"PWD={IntegrationConfigService._odbc_brace_segment(str(password))};"
                    f"Encrypt={enc};"
                    "TrustServerCertificate=yes;"
                    "MARS_Connection=no;"
                    f"LoginTimeout={login_timeout};"
                    "APP=RiverEdge-integration-test;"
                )
                try:
                    conn = pyodbc.connect(conn_str)
                    try:
                        cur = conn.cursor()
                        cur.execute("SELECT 1 AS n")
                        row = cur.fetchone()
                        if row is None or int(row[0]) != 1:
                            raise RuntimeError("SQL Server ODBC 探测查询无有效结果")
                    finally:
                        conn.close()
                    return {"success": True, "driver": driver, "encrypt": enc}
                except Exception as e:
                    last_err = e

        err_text = (
            IntegrationConfigService._sqlserver_exception_repr(last_err)
            if last_err is not None
            else "unknown"
        )
        return {"success": False, "error": err_text}

    @staticmethod
    def _sqlserver_percent_s_to_odbc_placeholders(sql: str, expected_n: int) -> str:
        """pymssql 使用 %s；pyodbc 使用 ?。仅替换与参数个数一致的 %s 占位。"""
        if expected_n == 0:
            return sql
        parts = sql.split("%s")
        if len(parts) - 1 != expected_n:
            raise ValueError(
                f"ODBC 路径要求 SQL 中恰有 {expected_n} 个「%s」占位符，当前为 {len(parts) - 1} 个"
            )
        return "?".join(parts)

    @staticmethod
    def _sqlserver_pyodbc_execute_query_sync(
        config: Dict[str, Any],
        sql: str,
        args: Optional[Tuple[Any, ...]] = None,
    ) -> Dict[str, Any]:
        """
        pymssql 失败后使用 pyodbc 执行查询（与测试连接同一套驱动 / Encrypt 策略）。
        sql 须为 pymssql 风格（%s 占位）；内部转为 ODBC 的 ?。
        """
        tup = tuple(args) if args else tuple()
        try:
            sql_odbc = IntegrationConfigService._sqlserver_percent_s_to_odbc_placeholders(sql, len(tup))
        except ValueError as e:
            return {"success": False, "error": str(e), "skipped": False}

        try:
            import pyodbc
        except ImportError:
            return {
                "success": False,
                "skipped": True,
                "hint": (
                    "pyodbc 未安装，无法使用 ODBC 回退执行 SQL。"
                    "请在 riveredge-backend 目录执行：uv sync --no-install-project；"
                    "Linux 还需安装 Microsoft ODBC Driver 17/18 与 unixODBC。"
                ),
            }

        drivers = IntegrationConfigService._sqlserver_pyodbc_drivers()
        if not drivers:
            return {
                "success": False,
                "skipped": True,
                "hint": "未检测到 ODBC Driver for SQL Server，请在后端主机安装 Microsoft ODBC Driver 17/18。",
            }

        host, port_int = IntegrationConfigService._normalize_sqlserver_host_and_port(config)
        database = (config.get("database") or "").strip()
        user = (config.get("user") or config.get("username") or "").strip()
        password = config.get("password")
        if password is None:
            password = ""
        login_timeout = int(config.get("login_timeout", 15))
        server_clause = IntegrationConfigService._sqlserver_odbc_server_clause(host, port_int)
        last_err: Optional[BaseException] = None
        for driver in drivers:
            encrypt_sequence = IntegrationConfigService._sqlserver_pyodbc_encrypt_modes_for_odbc(
                config, driver
            )
            for enc in encrypt_sequence:
                conn_str = (
                    f"DRIVER={IntegrationConfigService._odbc_brace_segment(driver)};"
                    f"SERVER={IntegrationConfigService._odbc_brace_segment(server_clause)};"
                    f"DATABASE={IntegrationConfigService._odbc_brace_segment(database)};"
                    f"UID={IntegrationConfigService._odbc_brace_segment(user)};"
                    f"PWD={IntegrationConfigService._odbc_brace_segment(str(password))};"
                    f"Encrypt={enc};"
                    "TrustServerCertificate=yes;"
                    "MARS_Connection=no;"
                    f"LoginTimeout={login_timeout};"
                    "APP=RiverEdge-dataset-sql;"
                )
                try:
                    conn = pyodbc.connect(conn_str)
                    try:
                        cur = conn.cursor()
                        if tup:
                            cur.execute(sql_odbc, tup)
                        else:
                            cur.execute(sql_odbc)
                        rows = cur.fetchall()
                        cols = [c[0] for c in (cur.description or [])]
                        if not rows:
                            return {"success": True, "data": [], "columns": cols, "total": 0}
                        data = [dict(zip(cols, row)) for row in rows]
                        return {"success": True, "data": data, "columns": cols, "total": len(data)}
                    finally:
                        conn.close()
                except Exception as e:
                    last_err = e

        err_text = (
            IntegrationConfigService._sqlserver_exception_repr(last_err)
            if last_err is not None
            else "unknown"
        )
        return {"success": False, "error": err_text, "skipped": False}

    @staticmethod
    def _sqlserver_encryption_for_pymssql(config: Dict[str, Any]) -> Optional[str]:
        """
        pymssql 2.3+ 仅接受 encryption in (None 不传, 'default', 'off', 'request', 'require')。
        将业务侧常用写法（optional/strict 等）映射到上述枚举。
        """
        enc_raw = config.get("encryption")
        if isinstance(enc_raw, str):
            k = enc_raw.strip().lower()
            if k in ("off", "false", "no", "disable"):
                return "off"
            if k in ("require", "strict", "mandatory", "true", "yes", "on"):
                return "require"
            if k in ("request", "optional", "prefer", "auto"):
                return "request"
            if k == "default":
                return "default"
            return None
        if config.get("encrypt") is True:
            return "request"
        if config.get("encrypt") is False:
            return "off"
        return None

    @staticmethod
    def _build_sqlserver_connect_kwargs(config: Dict[str, Any]) -> Dict[str, Any]:
        """从集成 config 构建 pymssql.connect 参数（支持可选 encryption / tds_version）。"""
        host, port_int = IntegrationConfigService._normalize_sqlserver_host_and_port(config)
        if not host:
            raise ValueError("SQL Server 配置缺少 host")
        database = (config.get("database") or "").strip()
        if not database:
            raise ValueError("SQL Server 配置缺少 database")
        user = (config.get("user") or config.get("username") or "").strip()
        if not user:
            raise ValueError("SQL Server 配置缺少 user/username")
        password = config.get("password")
        if password is None:
            password = ""
        login_timeout = int(config.get("login_timeout", 15))
        query_timeout = int(config.get("query_timeout", 15))

        kwargs: Dict[str, Any] = {
            "server": host,
            "port": str(port_int),
            "user": user,
            "password": password,
            "database": database,
            "login_timeout": login_timeout,
            "timeout": query_timeout,
            "appname": "RiverEdge-integration-test",
            "autocommit": True,
        }

        enc = IntegrationConfigService._sqlserver_encryption_for_pymssql(config)
        if enc is not None:
            kwargs["encryption"] = enc

        tds_version = config.get("tds_version")
        # SQL Server 2008 R2 等：默认 7.2；UI 的 8.0 会规范为 7.4（见 _normalize_pymssql_tds_version）
        kwargs["tds_version"] = IntegrationConfigService._normalize_pymssql_tds_version(tds_version)

        return kwargs

    @staticmethod
    def _sqlserver_connect_candidates(base: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        返回多种 connect 参数，依次尝试。
        FreeTDS 在部分 NAT/穿透场景下，使用 server=host,port 且省略 port 关键字更稳定。
        """
        host = base.get("server") or ""
        port = base.get("port")
        if not port or "\\" in host:
            return [dict(base)]
        alt = {k: v for k, v in base.items() if k != "port"}
        alt["server"] = f"{host},{port}"
        # NAT/穿透场景下「server=host,port 且省略 port」常比拆成 server+port 更稳，优先尝试
        return [alt, dict(base)]

    @staticmethod
    async def _test_sqlserver_connection(integration: Any) -> Dict[str, Any]:
        """测试 SQL Server 连接（TCP 探测 + pymssql 多策略重试；失败时再试 ODBC/pyodbc，贴近 Navicat）。"""
        try:
            import pymssql  # noqa: F401
        except ImportError:
            return {
                "success": False,
                "message": "SQL Server 连接测试需要 pymssql 依赖，请在后端环境中安装并重试",
            }
        config = integration.get_config()
        pwd = config.get("password")
        if isinstance(pwd, str) and pwd.strip() == "****":
            return {
                "success": False,
                "message": "SQL Server 密码无效：当前为占位符「****」（多为保存数据源时把脱敏显示当成了真实密码）。"
                "请在编辑数据源中重新输入数据库密码并保存，再测试连接。",
            }
        host, port_int = IntegrationConfigService._normalize_sqlserver_host_and_port(config)
        if not host:
            return {"success": False, "message": "SQL Server 配置缺少 host"}
        try:
            tcp_err = await asyncio.to_thread(
                IntegrationConfigService._sqlserver_tcp_probe_sync,
                host,
                port_int,
            )
            if tcp_err:
                return {
                    "success": False,
                    "message": f"SQL Server: {tcp_err}（若本机 Navicat 能连而此处不能，请确认 RiverEdge 后端运行环境与 Navicat 是否在同一网络/能否访问该公网地址与端口。）",
                }
        except Exception as e:
            return {"success": False, "message": f"SQL Server TCP 探测异常: {e}"}

        try:
            attempts = IntegrationConfigService._sqlserver_connection_attempt_kwargs(config)
        except ValueError as e:
            return {"success": False, "message": str(e)}

        if IntegrationConfigService._sqlserver_pyodbc_runtime_ready():
            odbc_res = await asyncio.to_thread(
                IntegrationConfigService._sqlserver_pyodbc_try_sync,
                config,
            )
            if odbc_res.get("success"):
                drv = odbc_res.get("driver", "ODBC")
                enc = odbc_res.get("encrypt", "")
                detail = f"{drv}" + (f"，Encrypt={enc}" if enc else "")
                return {
                    "success": True,
                    "message": f"SQL Server 连接成功（ODBC / {detail}，与常见 Navicat 配置一致）",
                }
            if not odbc_res.get("skipped"):
                odbc_err = (odbc_res.get("error") or "").strip()
                pymssql_note = ""
                try:
                    await asyncio.to_thread(
                        IntegrationConfigService._sqlserver_ping_sync,
                        attempts,
                    )
                    return {
                        "success": True,
                        "message": "SQL Server 连接成功（pymssql；ODBC 曾失败已自动回退）",
                    }
                except Exception as e:
                    pymssql_note = IntegrationConfigService._format_sqlserver_error(e)
                return {
                    "success": False,
                    "message": (
                        f"ODBC 连接失败：{odbc_err}。"
                        + (f" pymssql：{pymssql_note}" if pymssql_note else "")
                    ),
                }

        try:
            await asyncio.to_thread(
                IntegrationConfigService._sqlserver_ping_sync,
                attempts,
            )
            return {"success": True, "message": "SQL Server 连接成功（pymssql）"}
        except Exception as e:
            odbc_res = await asyncio.to_thread(
                IntegrationConfigService._sqlserver_pyodbc_try_sync,
                config,
            )
            if odbc_res.get("success"):
                drv = odbc_res.get("driver", "ODBC")
                enc = odbc_res.get("encrypt", "")
                detail = f"{drv}" + (f"，Encrypt={enc}" if enc else "")
                return {
                    "success": True,
                    "message": f"SQL Server 连接成功（ODBC / {detail}，与常见 Navicat 配置一致）",
                }
            if odbc_res.get("skipped"):
                hint = odbc_res.get("hint", "")
                sep = " " if hint else ""
                return {
                    "success": False,
                    "message": IntegrationConfigService._format_sqlserver_error(e) + sep + hint,
                }
            odbc_err = odbc_res.get("error", "")
            return {
                "success": False,
                "message": IntegrationConfigService._format_sqlserver_error(e)
                + " ODBC（pyodbc）补充尝试仍失败："
                + str(odbc_err).strip(),
            }

    @staticmethod
    async def _test_mysql_connection(integration: IntegrationConfig) -> Dict[str, Any]:
        """测试 MySQL 连接（暂未实现实际连接，仅校验必要字段）"""
        config = integration.get_config()
        user = config.get("user") or config.get("username")
        if not config.get("host") or not config.get("database") or not user:
            raise ValueError("MySQL 配置缺少必要字段: host、database、user/username")
        return {
            "message": "MySQL 配置验证成功（完整连接测试需要安装 aiomysql 等驱动）",
        }

    @staticmethod
    async def _test_mongodb_connection(integration: IntegrationConfig) -> Dict[str, Any]:
        """测试 MongoDB 连接（暂未实现实际连接）"""
        config = integration.get_config()
        if not config.get("host") and not config.get("uri"):
            raise ValueError("MongoDB 配置缺少 host 或 uri")
        return {
            "message": "MongoDB 配置验证成功（完整连接测试需要安装 motor 等驱动）",
        }

    @staticmethod
    async def _test_database_config_validation(integration: Any) -> Dict[str, Any]:
        """通用数据库配置校验（暂未实现实际连接）"""
        config = integration.get_config()
        if not config.get("host"):
            raise ValueError("配置缺少 host")
        return {
            "message": f"{integration.type} 配置基本校验通过",
        }

    # ── 应用连接器测试（协作、ERP、PLM、CRM）────────────────────────────────────

    @staticmethod
    async def _test_feishu_connection(integration: IntegrationConfig) -> Dict[str, Any]:
        """测试飞书连接（调用 app_access_token 接口）"""
        config = integration.get_config()
        app_id = config.get("app_id")
        app_secret = config.get("app_secret")
        if not app_id or not app_secret:
            raise ValueError("飞书配置缺少 app_id 或 app_secret")
        url = "https://open.feishu.cn/openapi-connector/auth/v1/app_access_token/internal"
        resp = await get_http_client().post(
            url,
            json={"app_id": app_id, "app_secret": app_secret},
            timeout=10.0,
        )
        data = resp.json()
        if data.get("code") != 0:
            raise ValueError(data.get("msg", "获取 token 失败"))
        return {"message": "飞书连接成功", "tenant_access_token": "***"}

    @staticmethod
    async def _test_dingtalk_connection(integration: IntegrationConfig) -> Dict[str, Any]:
        """测试钉钉连接（调用 gettoken 接口）"""
        config = integration.get_config()
        app_key = config.get("app_key")
        app_secret = config.get("app_secret")
        if not app_key or not app_secret:
            raise ValueError("钉钉配置缺少 app_key 或 app_secret")
        url = "https://oapi.dingtalk.com/gettoken"
        resp = await get_http_client().get(
            url,
            params={"appkey": app_key, "appsecret": app_secret},
            timeout=10.0,
        )
        data = resp.json()
        if data.get("errcode") != 0:
            raise ValueError(data.get("errmsg", "获取 token 失败"))
        return {"message": "钉钉连接成功", "access_token": "***"}

    @staticmethod
    async def _test_wecom_connection(integration: IntegrationConfig) -> Dict[str, Any]:
        """测试企业微信连接（调用 gettoken 接口）"""
        config = integration.get_config()
        corp_id = config.get("corp_id")
        corp_secret = config.get("corp_secret")
        if not corp_id or not corp_secret:
            raise ValueError("企业微信配置缺少 corp_id 或 corp_secret")
        url = "https://qyapi.weixin.qq.com/cgi-bin/gettoken"
        resp = await get_http_client().get(
            url,
            params={"corpid": corp_id, "corpsecret": corp_secret},
            timeout=10.0,
        )
        data = resp.json()
        if data.get("errcode") != 0:
            raise ValueError(data.get("errmsg", "获取 token 失败"))
        return {"message": "企业微信连接成功", "access_token": "***"}

    @staticmethod
    async def _test_rest_api_connection(integration: IntegrationConfig) -> Dict[str, Any]:
        """通用 REST API 连接测试（ERP/PLM/CRM 等）"""
        config = integration.get_config()
        base_url = (config.get("base_url") or config.get("url") or "").rstrip("/")
        if not base_url:
            raise ValueError("配置缺少 base_url")
        # 尝试 GET base_url 或 base_url/health 等
        test_urls = [f"{base_url}/", base_url, f"{base_url}/health", f"{base_url}/api/health"]
        auth = None
        username = config.get("username") or config.get("user")
        password = config.get("password")
        if username and password:
            auth = httpx.BasicAuth(username, password)
        headers = {}
        if config.get("api_key"):
            headers["Authorization"] = f"Bearer {config.get('api_key')}"
        elif config.get("token"):
            headers["Authorization"] = f"Bearer {config.get('token')}"
        client = get_http_client()
        for u in test_urls:
            try:
                resp = await client.get(u, auth=auth, headers=headers or None, timeout=10.0)
                if resp.status_code < 500:
                    return {"message": "连接成功", "status_code": resp.status_code}
            except Exception:
                continue
        raise ValueError("无法连接到配置的 API 地址，请检查 base_url 和认证信息")
