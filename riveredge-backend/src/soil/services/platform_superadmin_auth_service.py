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
        service = PlatformSuperAdminService()
        admin = await service.verify_platform_superadmin_credentials(
            data.username,
            data.password
        )
        
        if not admin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 生成 Token（不包含 tenant_id）⭐ 关键
        token_info = create_token_for_platform_superadmin(admin)
        
        logger.info(f"平台超级管理员登录成功: {admin.username} (ID: {admin.id})")
        
        from soil.schemas.platform_superadmin import PlatformSuperAdminResponse
        
        return {
            **token_info,
            "user": PlatformSuperAdminResponse.model_validate(admin).model_dump()
        }

