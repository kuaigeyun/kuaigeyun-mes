"""
平台超级管理员认证服务模块

提供平台超级管理员认证相关的业务逻辑处理。
平台超级管理员是平台唯一的，独立于租户系统。
"""

from typing import Dict, Any

from fastapi import HTTPException, status
from loguru import logger

from soil.schemas.platform_superadmin import PlatformSuperAdminLoginRequest
from soil.services.platform_superadmin_service import PlatformSuperAdminService
from soil.core.security.platform_superadmin_security import (
    create_token_for_platform_superadmin
)


class PlatformSuperAdminAuthService:
    """
    平台超级管理员认证服务类
    
    提供平台超级管理员认证相关的业务逻辑处理。
    平台超级管理员是平台唯一的，独立于租户系统。
    """
    
    async def login(
        self,
        data: PlatformSuperAdminLoginRequest
    ) -> Dict[str, Any]:
        """
        平台超级管理员登录
        
        验证平台超级管理员凭据并返回 JWT Token（不包含 tenant_id）。
        
        Args:
            data: 登录请求数据
            
        Returns:
            Dict[str, Any]: 包含 access_token、token_type、expires_in、user 的字典
            
        Raises:
            HTTPException: 当用户名或密码错误时抛出
            
        Example:
            >>> service = PlatformSuperAdminAuthService()
            >>> result = await service.login(
            ...     PlatformSuperAdminLoginRequest(
            ...         username="platform_admin",
            ...         password="password123"
            ...     )
            ... )
            >>> "access_token" in result
            True
        """
        # 验证平台超级管理员凭据
        logger.info(f"平台超级管理员登录尝试: username={data.username}")
        service = PlatformSuperAdminService()
        admin = await service.verify_platform_superadmin_credentials(
            data.username,
            data.password
        )
        
        if not admin:
            logger.warning(f"平台超级管理员登录失败: username={data.username}, 原因: 用户名或密码错误")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 生成 Token（不包含 tenant_id）⭐ 关键
        token_info = create_token_for_platform_superadmin(admin)
        
        # 获取默认租户 ID（domain="default"）
        default_tenant_id = None
        try:
            from soil.services.tenant_service import TenantService
            tenant_service = TenantService()
            default_tenant = await tenant_service.get_tenant_by_domain(
                "default",
                skip_tenant_filter=True
            )
            if default_tenant:
                default_tenant_id = default_tenant.id
                logger.info(f"平台超级管理员登录成功: {admin.username} (ID: {admin.id}), 默认租户 ID: {default_tenant_id}")
            else:
                logger.warning(f"平台超级管理员登录成功: {admin.username} (ID: {admin.id}), 但未找到默认租户（domain='default'）")
        except Exception as e:
            logger.warning(f"获取默认租户失败: {e}")
        
        from soil.schemas.platform_superadmin import PlatformSuperAdminResponse
        
        return {
            **token_info,
            "user": PlatformSuperAdminResponse.model_validate(admin).model_dump(),
            "default_tenant_id": default_tenant_id,  # 添加默认租户 ID
        }

