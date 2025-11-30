"""
超级管理员认证 API 模块

提供超级管理员认证相关的 RESTful API 接口
"""

from fastapi import APIRouter, Depends, HTTPException, status

from soil.schemas.superadmin import SuperAdminLoginRequest, SuperAdminLoginResponse
from soil.services.superadmin_auth_service import SuperAdminAuthService
from soil.api.deps.deps import get_current_superadmin
from soil.models.user import User
from soil.schemas.superadmin import SuperAdminResponse

# 创建路由
router = APIRouter(prefix="/auth", tags=["SuperAdmin Auth"])


@router.post("/login", response_model=SuperAdminLoginResponse)
async def superadmin_login(data: SuperAdminLoginRequest):
    """
    超级管理员登录接口
    
    验证超级管理员凭据并返回 JWT Token（不包含 tenant_id）。
    
    Args:
        data: 超级管理员登录请求数据（username, password）
        
    Returns:
        SuperAdminLoginResponse: 登录成功的响应数据（包含 token 和用户信息）
        
    Raises:
        HTTPException: 当用户名或密码错误时抛出
        
    Example:
        ```json
        {
            "username": "superadmin",
            "password": "password123"
        }
        ```
    """
    service = SuperAdminAuthService()
    result = await service.login(data)
    
    return SuperAdminLoginResponse(**result)


@router.get("/me", response_model=SuperAdminResponse)
async def get_current_superadmin_info(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取当前超级管理员信息接口
    
    从 Token 中解析并返回当前超级管理员信息。
    
    Args:
        current_admin: 当前超级管理员（依赖注入，自动从 Token 解析）
        
    Returns:
        SuperAdminResponse: 当前超级管理员信息
    """
    return current_admin

