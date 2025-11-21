"""
认证 API 模块

提供用户认证相关的 RESTful API 接口
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from schemas.auth import (
    LoginRequest,
    LoginResponse,
    UserRegisterRequest,
    RegisterResponse,
    TokenRefreshRequest,
    TokenRefreshResponse,
    CurrentUserResponse,
)
from schemas.user import UserResponse
from services.auth_service import AuthService
from api.deps import get_current_user
from models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# OAuth2 密码流（用于 Swagger UI 测试）
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserRegisterRequest
):
    """
    用户注册接口
    
    在已有组织中创建新用户并自动设置组织 ID。
    
    Args:
        data: 用户注册请求数据（包含 username, email（可选）, password, tenant_id）
        
    Returns:
        RegisterResponse: 注册成功的响应数据
        
    Raises:
        HTTPException: 当组织不存在或用户名已存在时抛出
        
    Example:
        ```json
        {
            "username": "testuser",
            "email": "test@example.com",  // 可选
            "password": "password123",
            "tenant_id": 1,
            "full_name": "测试用户"  // 可选
        }
        ```
    """
    service = AuthService()
    user = await service.register(data)
    
    return RegisterResponse(
        id=user.id,
        username=user.username,
        email=user.email if user.email else None,
        message="注册成功"
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    data: LoginRequest
):
    """
    用户登录接口

    验证用户凭据并返回 JWT Token（包含 tenant_id）。
    登录成功后自动设置组织上下文。
    如果用户属于多个组织，返回组织列表供用户选择。

    Args:
        data: 登录请求数据（username, password, tenant_id 可选）

    Returns:
        LoginResponse: 登录成功的响应数据（包含 access_token、tenants 列表等）

    Raises:
        HTTPException: 当用户名/密码错误或用户未激活时抛出

    Example:
        ```json
        {
            "username": "testuser",
            "password": "password123",
            "tenant_id": 1
        }
        ```
    """
    try:
        service = AuthService()
        result = await service.login(data)
        
        return LoginResponse(**result)
        
    except HTTPException:
        # 重新抛出 HTTP 异常（如 401 未授权）
        raise
    except Exception as e:
        # 记录内部错误并抛出统一异常
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"用户登录失败: {e}")
        logger.error(f"错误堆栈:\n{error_trace}")
        
        # 始终返回详细错误信息（便于调试）
        # 在生产环境中可以改为只返回通用错误信息
        error_detail = f"服务器内部错误: {str(e)}"
        logger.error(f"登录API错误详情: {error_detail}")
        raise HTTPException(
            status_code=500,
            detail=error_detail
        )


@router.post("/login/form", response_model=LoginResponse)
async def login_form(
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    用户登录接口（OAuth2 表单格式）
    
    用于 Swagger UI 的 OAuth2 认证测试。
    支持用户名或邮箱登录。
    
    Args:
        form_data: OAuth2 表单数据（username, password）
        
    Returns:
        LoginResponse: 登录成功的响应数据
    """
    service = AuthService()
    result = await service.login(
        LoginRequest(
            username=form_data.username,
            password=form_data.password,
            tenant_id=None  # 表单登录不指定组织，使用用户的默认组织
        )
    )
    
    return LoginResponse(**result)


@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_token(
    data: TokenRefreshRequest
):
    """
    Token 刷新接口
    
    验证当前 Token 并生成新的 Token。
    
    Args:
        data: Token 刷新请求数据（refresh_token 可选）
        
    Returns:
        TokenRefreshResponse: 新的 Token 信息
        
    Raises:
        HTTPException: 当 Token 无效时抛出
    """
    service = AuthService()
    
    # 如果提供了 refresh_token，使用它；否则从请求头获取
    token = data.refresh_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请提供 refresh_token"
        )
    
    result = await service.refresh_token(token)
    
    return TokenRefreshResponse(**result)


@router.post("/guest-login", response_model=LoginResponse)
async def guest_login():
    """
    免注册体验登录接口
    
    获取或创建默认组织和预设的体验账户，直接返回登录响应。
    体验账户只有浏览权限（只读权限），无新建、编辑、删除权限。
    
    Returns:
        LoginResponse: 登录成功的响应数据（包含 access_token）
        
    Raises:
        HTTPException: 当创建体验账户失败时抛出
        
    Example:
        ```json
        {
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "token_type": "bearer",
            "expires_in": 3600,
            "user": {
                "id": 1,
                "username": "guest",
                "tenant_id": 1
            }
        }
        ```
    """
    try:
        service = AuthService()
        result = await service.guest_login()
        
        return LoginResponse(**result)
        
    except HTTPException:
        # 重新抛出 HTTP 异常
        raise
    except Exception as e:
        # 记录内部错误并抛出统一异常
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"免注册体验登录失败: {e}")
        logger.error(f"错误堆栈:\n{error_trace}")
        
        error_detail = f"服务器内部错误: {str(e)}"
        logger.error(f"免注册体验登录API错误详情: {error_detail}")
        raise HTTPException(
            status_code=500,
            detail=error_detail
        )


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户信息接口
    
    返回当前登录用户的详细信息。
    自动从 Token 中解析用户信息和组织信息。
    
    Args:
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        CurrentUserResponse: 当前用户信息
        
    Raises:
        HTTPException: 当 Token 无效或用户不存在时抛出
    """
    return CurrentUserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        tenant_id=current_user.tenant_id,
        is_active=current_user.is_active,
        is_platform_admin=current_user.is_platform_admin,
        is_tenant_admin=current_user.is_tenant_admin,
    )

