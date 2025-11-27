"""
系统级超级管理员认证服务模块

提供系统级超级管理员认证相关的业务逻辑，包括登录、Token 刷新等功能
注意：平台管理员使用 User 模型（is_platform_admin=True 且 tenant_id=None）
"""

from typing import Optional, Dict, Any

from fastapi import HTTPException, status
from loguru import logger

from models.user import User
from schemas.superadmin import SuperAdminLoginRequest
from services.superadmin_service import SuperAdminService
from core.superadmin_security import create_token_for_superadmin


class SuperAdminAuthService:
    """
    系统级超级管理员认证服务类
    
    提供系统级超级管理员认证相关的业务逻辑处理。
    注意：平台管理员使用 User 模型（is_platform_admin=True 且 tenant_id=None）。
    """
    
    async def login(
        self,
        data: SuperAdminLoginRequest
    ) -> Dict[str, Any]:
        """
        超级管理员登录
        
        验证超级管理员凭据并返回 JWT Token（不包含 tenant_id）。
        
        Args:
            data: 登录请求数据
            
        Returns:
            Dict[str, Any]: 包含 token、token_type、expires_in、user 的字典
            
        Raises:
            HTTPException: 当用户名或密码错误时抛出
            
        Example:
            >>> service = SuperAdminAuthService()
            >>> result = await service.login(
            ...     SuperAdminLoginRequest(
            ...         username="superadmin",
            ...         password="password123"
            ...     )
            ... )
            >>> "token" in result
            True
        """
        # 验证超级管理员凭据
        service = SuperAdminService()
        admin = await service.verify_superadmin_credentials(
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
        token_info = create_token_for_superadmin(admin)
        
        logger.info(f"系统级超级管理员登录成功: {admin.username} (ID: {admin.id})")
        
        from schemas.superadmin import SuperAdminResponse
        
        return {
            **token_info,
            "user": SuperAdminResponse.model_validate(admin).model_dump()
        }
    
    async def get_current_superadmin_from_token(
        self,
        token: str
    ) -> Optional[User]:
        """
        从 Token 获取当前系统级超级管理员
        
        验证 Token 并返回对应的系统级超级管理员用户对象。
        
        Args:
            token: JWT Token 字符串
            
        Returns:
            Optional[User]: 系统级超级管理员用户对象，如果验证失败则返回 None
        """
        from core.superadmin_security import get_superadmin_token_payload
        
        payload = get_superadmin_token_payload(token)
        if not payload:
            return None
        
        user_id = int(payload.get("sub"))
        user = await User.get_or_none(
            id=user_id,
            is_platform_admin=True,
            tenant_id__isnull=True
        )
        
        if not user or not user.is_active:
            return None
        
        return user

