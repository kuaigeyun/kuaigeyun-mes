"""
用户认证 API 路由

提供用户登录、注册、Token 刷新等认证相关的 RESTful API 接口。

Author: Luigi Lu
Date: 2025-12-27
"""

from fastapi import APIRouter, Depends, HTTPException, status
from starlette.requests import Request
from loguru import logger

from infra.schemas.auth import LoginRequest, LoginResponse, UserRegisterRequest, PersonalRegisterRequest, OrganizationRegisterRequest, RegisterResponse, CurrentUserResponse, SendVerificationCodeRequest, SendVerificationCodeResponse
from infra.services.auth_service import AuthService
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, AuthenticationError

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
    # ⚠️ 第三阶段改进：统一错误处理
    # 异常由全局异常处理中间件统一处理
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
    try:
        service = AuthService()
        result = await service.guest_login()
        return LoginResponse(**result)
    except Exception as e:
        logger.error(f"体验登录失败: {e}")
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"体验登录失败: {str(e)}"
        )


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户信息接口
    
    返回当前登录用户的详细信息，包括组织信息。
    
    ⚠️ 第三阶段改进：使用服务层方法获取用户信息，避免API层直接查询数据库
    
    Args:
        current_user: 当前用户对象（通过依赖注入获取）
        
    Returns:
        CurrentUserResponse: 当前用户信息响应数据
    """
    from infra.services.user_service import UserService
    
    # ⚠️ 第三阶段改进：使用服务层方法获取用户信息
    service = UserService()
    user_info = await service.get_user_with_tenant_info(current_user.id, current_user.tenant_id)
    
    if not user_info:
        # ⚠️ 第三阶段改进：使用统一的异常类
        raise NotFoundError("用户", str(current_user.id))
    
    return CurrentUserResponse(**user_info)


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


@router.post("/register/personal")
async def register_personal(data: PersonalRegisterRequest):
    """
    个人注册接口
    
    个人用户注册。如果提供了 tenant_id，则在指定组织中创建用户；
    否则在默认组织中创建用户。如果提供了 invite_code，则验证邀请码并直接注册成功（免审核）。
    
    Args:
        data: 个人注册请求数据
        
    Returns:
        RegisterResponse: 注册成功的响应数据
        
    Raises:
        HTTPException: 当组织不存在、用户名已存在或邀请码无效时抛出
    """
    service = AuthService()
    result = await service.register_personal(data)
    # 返回格式与前端期望一致：{ success, message, user_id }
    return {
        "success": result["success"],
        "message": result["message"],
        "user_id": result["user_id"]
    }


@router.post("/register/organization")
async def register_organization(data: OrganizationRegisterRequest):
    """
    组织注册接口
    
    创建新组织并注册管理员用户。
    如果未提供 tenant_domain，则自动生成8位随机域名。
    新注册的组织状态为 INACTIVE，需要平台管理员审核。
    
    Args:
        data: 组织注册请求数据
        
    Returns:
        RegisterResponse: 注册成功的响应数据（包含 tenant_domain）
        
    Raises:
        HTTPException: 当域名已存在或用户名已存在时抛出
    """
    service = AuthService()
    result = await service.register_organization(data)
    
    # 返回格式与前端期望一致：{ success, message, tenant_id, user_id }
    return {
        "success": result["success"],
        "message": result["message"],
        "tenant_id": result["tenant_id"],
        "user_id": result["user_id"]
    }


@router.post("/send-verification-code", response_model=SendVerificationCodeResponse)
async def send_verification_code(data: SendVerificationCodeRequest):
    """
    发送验证码接口

    发送短信或邮箱验证码，用于注册验证。

    Args:
        data: 发送验证码请求数据（phone或email必填其一）

    Returns:
        SendVerificationCodeResponse: 发送结果响应

    Raises:
        HTTPException: 当参数无效或发送失败时抛出
    """
    if not data.phone and not data.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号和邮箱至少提供一个"
        )

    service = AuthService()

    try:
        success = False
        message = "验证码发送失败"

        if data.phone:
            # 发送短信验证码
            code = service.generate_verification_code()
            success = await service.send_sms_verification_code(data.phone, code)
            if success:
                # 这里应该将验证码存储到Redis或缓存中，设置过期时间
                # 暂时使用logger记录，实际项目中需要实现缓存存储
                logger.info(f"短信验证码已生成并发送: {data.phone} -> {code}")
                message = "短信验证码发送成功"
        elif data.email:
            # 发送邮箱验证码
            code = service.generate_verification_code()
            success = await service.send_email_verification_code(data.email, code)
            if success:
                # 这里应该将验证码存储到Redis或缓存中，设置过期时间
                # 暂时使用logger记录，实际项目中需要实现缓存存储
                logger.info(f"邮箱验证码已生成并发送: {data.email} -> {code}")
                message = "邮箱验证码发送成功"

        return {
            "success": success,
            "message": message
        }

    except Exception as e:
        logger.error(f"发送验证码异常: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="验证码发送失败，请稍后重试"
        )

