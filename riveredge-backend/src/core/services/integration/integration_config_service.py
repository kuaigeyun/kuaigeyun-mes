"""
集成配置管理服务模块

提供集成配置的 CRUD 操作和连接测试功能。
"""

from typing import Optional, List, Dict, Any  # noqa: F401
from uuid import UUID
from tortoise.exceptions import IntegrityError
import httpx

from core.models.integration_config import IntegrationConfig
from core.schemas.integration_config import IntegrationConfigCreate, IntegrationConfigUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError


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
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[IntegrationConfig]:
        """
        获取集成配置列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 集成类型（可选）
            is_active: 是否启用（可选）
            
        Returns:
            List[IntegrationConfig]: 集成配置列表
        """
        query = IntegrationConfig.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.offset(skip).limit(limit).order_by("-created_at", "id")
    
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
        
        update_data = data.model_dump(exclude_unset=True)
        
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
            elif integration.type in ("oracle", "sqlserver", "redis", "clickhouse", "influxdb", "doris", "starrocks", "elasticsearch"):
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
            
            # 更新连接状态（成功）
            integration.update_connection_status(True)
            await integration.save()
            
            return {
                "success": True,
                "message": "连接成功",
                "data": result
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
        
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                url,
                headers=headers,
                timeout=timeout
            )
            return {
                "status_code": response.status_code,
                "response": response.text[:200] if response.text else ""  # 限制响应长度
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
        
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                url,
                headers=headers,
                json=test_payload,
                timeout=timeout
            )
            return {
                "status_code": response.status_code,
                "message": "Webhook 测试请求发送成功"
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
            elif temp.type in ("oracle", "sqlserver", "redis", "clickhouse", "influxdb", "doris", "starrocks", "elasticsearch"):
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
            return {
                "success": True,
                "message": result.get("message", "连接成功"),
                "data": result,
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
        """测试 PostgreSQL 连接（config: host, port, database, user/username, password）"""
        config = integration.get_config()
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
        async with httpx.AsyncClient() as client:
            resp = await client.post(
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
        async with httpx.AsyncClient() as client:
            resp = await client.get(
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
        async with httpx.AsyncClient() as client:
            resp = await client.get(
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
        async with httpx.AsyncClient() as client:
            for u in test_urls:
                try:
                    resp = await client.get(u, auth=auth, headers=headers or None, timeout=10.0)
                    if resp.status_code < 500:
                        return {"message": "连接成功", "status_code": resp.status_code}
                except Exception:
                    continue
        raise ValueError("无法连接到配置的 API 地址，请检查 base_url 和认证信息")
