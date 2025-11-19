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
    
    在已有租户中创建新用户并自动设置租户 ID。
    
    Args:
        data: 用户注册请求数据（包含 username, email（可选）, password, tenant_id）
        
    Returns:
        RegisterResponse: 注册成功的响应数据
        
    Raises:
        HTTPException: 当租户不存在或用户名已存在时抛出
        
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
    登录成功后自动设置租户上下文。

    Args:
        data: 登录请求数据（username, password, tenant_id 可选）

    Returns:
        LoginResponse: 登录成功的响应数据（包含 access_token）

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
        # 使用 Tortoise ORM 验证用户身份
        # 注意：使用 register_tortoise 后，连接池会自动管理，不需要手动检查
        logger.info(f"开始验证用户: {data.username}")
        from models.user import User
        from core.security import verify_password

        # 查询用户（Tortoise ORM 会自动管理连接池）
        if data.username == "superadmin":
            # 超级管理员
            logger.info("查询超级管理员用户...")
            user = await User.get_or_none(
                username=data.username,
                is_superuser=True,
                tenant_id__isnull=True
            )
            logger.info(f"超级管理员查询结果: {user}")
        else:
            # 普通用户
            logger.info(f"查询普通用户，租户ID: {data.tenant_id or 1}")
            user = await User.get_or_none(
                username=data.username,
                tenant_id=data.tenant_id or 1
            )
            logger.info(f"普通用户查询结果: {user}")

        if user and user.is_active:
            # 验证密码
            logger.info(f"验证密码: {user.password_hash[:20]}...")
            password_valid = verify_password(data.password, user.password_hash)
            logger.info(f"密码验证结果: {password_valid}")

            if password_valid:
                # 登录成功，创建 JWT Token
                from core.security import create_token_for_user

                # 生成访问令牌
                access_token = create_token_for_user(
                    user_id=user.id,
                    username=user.username,
                    tenant_id=user.tenant_id,
                    is_superuser=user.is_superuser,
                    is_tenant_admin=user.is_tenant_admin
                )

                return LoginResponse(
                    access_token=access_token,
                    token_type="bearer",
                    expires_in=1800,  # 30分钟
                    user={
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "full_name": "超级管理员" if user.is_superuser else "普通用户",
                        "tenant_id": user.tenant_id,
                        "is_superuser": user.is_superuser,
                        "is_tenant_admin": user.is_tenant_admin,
                    }
                )

        # 用户不存在或密码错误
        logger.info("用户不存在或密码错误")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )

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
            tenant_id=None  # 表单登录不指定租户，使用用户的默认租户
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


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户信息接口
    
    返回当前登录用户的详细信息。
    自动从 Token 中解析用户信息和租户信息。
    
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
        is_superuser=current_user.is_superuser,
        is_tenant_admin=current_user.is_tenant_admin,
    )

