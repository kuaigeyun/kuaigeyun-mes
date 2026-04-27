"""
用户认证 API 路由

提供用户登录、注册、Token 刷新等认证相关的 RESTful API 接口。

Author: Luigi Lu
Date: 2025-12-27
"""

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import AliasChoices, BaseModel, Field
from starlette.requests import Request
from loguru import logger
from typing import Any, Optional

from infra.schemas.auth import (
    LoginRequest, 
    LoginResponse, 
    UserRegisterRequest, 
    PersonalRegisterRequest, 
    OrganizationRegisterRequest, 
    RegisterResponse, 
    CurrentUserResponse, 
    SendVerificationCodeRequest, 
    SendVerificationCodeResponse, 
    BatchAccessCheckRequest, 
    AccessCheckResult,
    WebAuthnRegisterOptionsRequest,
    WebAuthnRegisterFinalizeRequest,
    WebAuthnLoginOptionsRequest,
    WebAuthnLoginFinalizeRequest
)
from infra.services.auth_service import AuthService
from infra.api.deps.deps import get_current_user
from core.api.deps.deps import get_current_tenant
from infra.api.deps.services import get_auth_service_with_fallback, get_biometric_service
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, AuthenticationError


class RefreshTokenBody(BaseModel):
    """Token 刷新请求体，兼容 `token` 与 `refresh_token` 两种字段名。"""

    token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("token", "refresh_token"),
        description="当前 JWT，可通过 token 或 refresh_token 字段传入",
    )


# 创建路由
router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    data: LoginRequest,
    request: Request,
    auth_service: Any = Depends(get_auth_service_with_fallback)  # ⚠️ 第三阶段改进：依赖注入
):
    """
    用户登录接口
    
    验证用户凭据并返回 JWT Token（包含 tenant_id）。
    """
    # ⚠️ 第三阶段改进：使用依赖注入的服务
    result = await auth_service.login(data, request)
    return LoginResponse(**result)


@router.post("/register", response_model=dict)
async def register(
    data: UserRegisterRequest,
    auth_service: Any = Depends(get_auth_service_with_fallback)  # ⚠️ 第三阶段改进：依赖注入
):
    """
    用户注册接口
    """
    # ⚠️ 第三阶段改进：使用依赖注入的服务
    user = await auth_service.register(data)
    return {
        "message": "注册成功",
        "user_id": user.id,
        "username": user.username,
    }


@router.post("/refresh", response_model=dict)
async def refresh_token(
    token: str | None = Query(None, description="当前 JWT（Query，兼容旧客户端）"),
    body: RefreshTokenBody | None = Body(None),
):
    """
    刷新 Token 接口。
    """
    raw = (token or (body.token if body else None) or "").strip()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="token required",
        )
    service = AuthService()
    return await service.refresh_token(raw)


@router.post("/guest-login", response_model=LoginResponse)
async def guest_login(
    request: Request,
    auth_service: Any = Depends(get_auth_service_with_fallback)  # ⚠️ 第三阶段改进：依赖注入
):
    """
    免注册体验登录接口
    """
    result = await auth_service.guest_login(request)
    return LoginResponse(**result)


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    获取当前用户信息接口
    """
    from infra.services.user_service import UserService
    
    service = UserService()
    user_info = await service.get_user_with_tenant_info(current_user.id, current_user.tenant_id)
    
    if not user_info:
        raise NotFoundError("用户", str(current_user.id))
    
    return CurrentUserResponse(**user_info)


@router.post("/check-access", response_model=list[AccessCheckResult])
async def check_access(
    data: BatchAccessCheckRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量权限检查接口。
    """
    from core.services.authorization.access_control_service import AccessControlService

    results: list[AccessCheckResult] = []
    for item in data.checks:
        decision = await AccessControlService.check_access(
            user_id=current_user.id,
            tenant_id=tenant_id,
            resource=item.resource,
            action=item.action,
            is_infra_admin=bool(getattr(current_user, "is_infra_admin", False) or getattr(current_user, "_is_infra_superadmin", False)),
            is_tenant_admin=bool(getattr(current_user, "is_tenant_admin", False)),
            check_abac=data.check_abac,
        )
        results.append(
            AccessCheckResult(
                resource=item.resource,
                action=item.action,
                allowed=decision.allowed,
                reason=decision.reason,
            )
        )
    return results


@router.post("/logout")
async def logout():
    """
    用户登出接口
    """
    return {
        "message": "登出成功"
    }


@router.post("/register/personal")
async def register_personal(
    data: PersonalRegisterRequest,
    auth_service: Any = Depends(get_auth_service_with_fallback)  # ⚠️ 第三阶段改进：依赖注入
):
    """
    个人注册接口
    """
    result = await auth_service.register_personal(data)
    return {
        "success": result["success"],
        "message": result["message"],
        "user_id": result["user_id"]
    }


@router.post("/register/organization")
async def register_organization(
    data: OrganizationRegisterRequest,
    auth_service: Any = Depends(get_auth_service_with_fallback)  # ⚠️ 第三阶段改进：依赖注入
):
    """
    组织注册接口
    """
    result = await auth_service.register_organization(data)
    
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
            code = service.generate_verification_code()
            success = await service.send_sms_verification_code(data.phone, code)
            if success:
                logger.info(f"短信验证码已生成并发送: {data.phone} -> {code}")
                message = "短信验证码发送成功"
        elif data.email:
            code = service.generate_verification_code()
            success = await service.send_email_verification_code(data.email, code)
            if success:
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


# --- Biometric Authentication Endpoints ---

@router.get("/biometric/register-options")
async def get_registration_options(
    current_user: User = Depends(get_current_user),
    biometric_service: Any = Depends(get_biometric_service)
):
    """
    获取生物识别注册选项（Challenge）
    """
    return await biometric_service.generate_registration_options(current_user)


@router.post("/biometric/register-finalize")
async def finalize_registration(
    data: WebAuthnRegisterFinalizeRequest,
    current_user: User = Depends(get_current_user),
    biometric_service: Any = Depends(get_biometric_service)
):
    """
    完成生物识别注册
    """
    return await biometric_service.verify_registration(current_user, data)


@router.post("/biometric/login-options")
async def get_login_options(
    data: WebAuthnLoginOptionsRequest,
    biometric_service: Any = Depends(get_biometric_service)
):
    """
    获取生物识别登录选项（Challenge）
    """
    return await biometric_service.generate_authentication_options(data.username)


@router.post("/biometric/login-finalize")
async def finalize_login(
    data: WebAuthnLoginFinalizeRequest,
    request: Request,
    biometric_service: Any = Depends(get_biometric_service),
    auth_service: Any = Depends(get_auth_service_with_fallback)
):
    """
    完成生物识别登录并返回 JWT
    """
    user = await biometric_service.verify_authentication(data)
    
    # 因为 WebAuthn 登录不需要密码验证，我们已经验证过了
    result = await auth_service.generate_login_result(user, request)
    return LoginResponse(**result)
