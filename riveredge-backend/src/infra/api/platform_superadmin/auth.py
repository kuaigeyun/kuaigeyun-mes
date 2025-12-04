"""
平台超级管理员认证 API 模块

提供平台超级管理员认证相关的 RESTful API 接口
"""

from fastapi import APIRouter, Depends, HTTPException, status

from infra.schemas.platform_superadmin import (
    PlatformSuperAdminLoginRequest,
    PlatformSuperAdminLoginResponse
)
from infra.services.platform_superadmin_auth_service import PlatformSuperAdminAuthService
from infra.api.deps.deps import get_current_platform_superadmin
from infra.models.platform_superadmin import PlatformSuperAdmin
from infra.schemas.platform_superadmin import PlatformSuperAdminResponse

# 创建路由
router = APIRouter(prefix="/auth", tags=["Platform Admin Auth"])


@router.post("/login", response_model=PlatformSuperAdminLoginResponse)
async def platform_superadmin_login(data: PlatformSuperAdminLoginRequest):
    """
    平台超级管理员登录接口
    
    验证平台超级管理员凭据并返回 JWT Token（不包含 tenant_id）。
    平台超级管理员是平台唯一的，独立于租户系统。
    
    Args:
        data: 平台超级管理员登录请求数据（username, password）
        
    Returns:
        PlatformSuperAdminLoginResponse: 登录成功的响应数据（包含 access_token 和用户信息）
        
    Raises:
        HTTPException: 当用户名或密码错误时抛出
        
    Example:
        ```json
        {
            "username": "platform_admin",
            "password": "password123"
        }
        ```
    """
    from loguru import logger
    
    # 记录接收到的登录请求（不输出密码明文，只输出长度）
    logger.info(f"收到登录请求: username={data.username}, password_length={len(data.password) if data.password else 0}")
    
    service = PlatformSuperAdminAuthService()
    result = await service.login(data)
    
    return PlatformSuperAdminLoginResponse(**result)


@router.get("/me", response_model=PlatformSuperAdminResponse)
async def get_current_platform_superadmin_info(
    current_admin: PlatformSuperAdmin = Depends(get_current_platform_superadmin)
):
    """
    获取当前平台超级管理员信息
    
    返回当前登录的平台超级管理员信息。
    
    Args:
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        PlatformSuperAdminResponse: 平台超级管理员信息
    """
    return PlatformSuperAdminResponse.model_validate(current_admin)

