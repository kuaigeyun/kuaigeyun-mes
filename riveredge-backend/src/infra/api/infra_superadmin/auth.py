"""
平台超级管理员认证 API 模块

提供平台超级管理员认证相关的 RESTful API 接口
"""

from fastapi import APIRouter, Depends, HTTPException, status

from infra.schemas.infra_superadmin import (
    InfraSuperAdminLoginRequest,
    InfraSuperAdminLoginResponse
)
from infra.services.infra_superadmin_auth_service import InfraSuperAdminAuthService
from infra.api.deps.deps import get_current_infra_superadmin
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.schemas.infra_superadmin import InfraSuperAdminResponse

# 创建路由
router = APIRouter(prefix="/auth", tags=["Infra Admin Auth"])


@router.post("/login", response_model=InfraSuperAdminLoginResponse)
async def infra_superadmin_login(data: InfraSuperAdminLoginRequest):
    """
    平台超级管理员登录接口
    
    验证平台超级管理员凭据并返回 JWT Token（不包含 tenant_id）。
    平台超级管理员是平台唯一的，独立于租户系统。
    
    Args:
        data: 平台超级管理员登录请求数据（username, password）
        
    Returns:
        InfraSuperAdminLoginResponse: 登录成功的响应数据（包含 access_token 和用户信息）
        
    Raises:
        HTTPException: 当用户名或密码错误时抛出
        
    Example:
        ```json
        {
            "username": "infra_admin",
            "password": "password123"
        }
        ```
    """
    from loguru import logger
    
    # 记录接收到的登录请求（不输出密码明文，只输出长度）
    logger.info(f"收到登录请求: username={data.username}, password_length={len(data.password) if data.password else 0}")
    
    service = InfraSuperAdminAuthService()
    result = await service.login(data)
    
    return InfraSuperAdminLoginResponse(**result)


@router.get("/me", response_model=InfraSuperAdminResponse)
async def get_current_infra_superadmin_info(
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    获取当前平台超级管理员信息
    
    返回当前登录的平台超级管理员信息。
    
    Args:
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        InfraSuperAdminResponse: 平台超级管理员信息
    """
    return InfraSuperAdminResponse.model_validate(current_admin)

