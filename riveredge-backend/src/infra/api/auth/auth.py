"""
用户认证 API 路由

提供用户登录、注册、Token 刷新等认证相关的 RESTful API 接口
"""

from fastapi import APIRouter, Depends, HTTPException, status
from starlette.requests import Request

from infra.schemas.auth import LoginRequest, LoginResponse, UserRegisterRequest
from infra.services.auth_service import AuthService

# 创建路由
router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    data: LoginRequest,
    request: Request
):
    """
    用户登录接口
    
    验证用户凭据并返回 JWT Token（包含 tenant_id）。
    
    Args:
        data: 登录请求数据（username, password, tenant_id 可选）
        request: 请求对象（用于获取 IP、User-Agent 等信息）
        
    Returns:
        LoginResponse: 登录成功的响应数据（包含 access_token 和用户信息）
        
    Raises:
        HTTPException: 当用户名或密码错误时抛出
        
    Example:
        ```json
        {
            "username": "testuser",
            "password": "password123",
            "tenant_id": 1
        }
        ```
    """
    service = AuthService()
    result = await service.login(data, request)
    return LoginResponse(**result)


@router.post("/register", response_model=dict)
async def register(data: UserRegisterRequest):
    """
    用户注册接口
    
    在已有组织中创建新用户。
    
    Args:
        data: 用户注册请求数据
        
    Returns:
        dict: 注册成功的响应数据
        
    Raises:
        HTTPException: 当组织不存在或用户名已存在时抛出
    """
    service = AuthService()
    user = await service.register(data)
    return {
        "message": "注册成功",
        "user_id": user.id,
        "username": user.username,
    }


@router.post("/refresh", response_model=dict)
async def refresh_token(token: str):
    """
    刷新 Token 接口
    
    验证当前 Token 并生成新的 Token。
    
    Args:
        token: 当前 JWT Token
        
    Returns:
        dict: 包含新的 access_token 的响应数据
        
    Raises:
        HTTPException: 当 Token 无效时抛出
    """
    service = AuthService()
    result = await service.refresh_token(token)
    return result


@router.post("/guest-login", response_model=LoginResponse)
async def guest_login():
    """
    免注册体验登录接口
    
    获取或创建默认组织和预设的体验账户，直接返回登录响应。
    体验账户只有浏览权限（只读权限），无新建、编辑、删除权限。
    
    Returns:
        LoginResponse: 登录成功的响应数据
        
    Raises:
        HTTPException: 当创建体验账户失败时抛出
    """
    service = AuthService()
    result = await service.guest_login()
    return LoginResponse(**result)


@router.post("/logout")
async def logout():
    """
    用户登出接口
    
    登出当前用户（客户端需要清除 Token）。
    
    Returns:
        dict: 登出成功的响应数据
    """
    return {
        "message": "登出成功"
    }

