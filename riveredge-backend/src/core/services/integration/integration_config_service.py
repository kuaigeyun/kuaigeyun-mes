"""
集成配置管理服务模块

提供集成配置的 CRUD 操作和连接测试功能。
"""

from typing import Optional, List, Dict, Any
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
            if integration.type == "API":
                result = await IntegrationConfigService._test_api_connection(integration)
            elif integration.type == "OAuth":
                result = await IntegrationConfigService._test_oauth_connection(integration)
            elif integration.type == "Webhook":
                result = await IntegrationConfigService._test_webhook_connection(integration)
            elif integration.type == "Database":
                result = await IntegrationConfigService._test_database_connection(integration)
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
        url = config.get("url")
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

