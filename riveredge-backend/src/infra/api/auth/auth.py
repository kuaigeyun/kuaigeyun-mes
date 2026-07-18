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
    TenantInfo,
    SwitchTenantRequest,
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
from core.services.integration.wecom_oauth_service import (
    bind_wecom_user_for_current_user,
    unbind_wecom_user_for_current_user,
    build_wecom_oauth_authorize_url,
    decode_wecom_oauth_state,
    encode_wecom_oauth_state,
    resolve_user_for_wecom_login,
    resolve_wecom_user_id_from_code,
)
from core.services.integration.wecom_integration import get_wecom_credentials


class RefreshTokenBody(BaseModel):
    """Token 刷新请求体，兼容 `token` 与 `refresh_token` 两种字段名。"""

    token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("token", "refresh_token"),
        description="当前 JWT，可通过 token 或 refresh_token 字段传入",
    )


class WeComCallbackRequest(BaseModel):
    """企业微信 OAuth 回调。"""

    code: str = Field(..., min_length=1, description="企业微信 OAuth code")
    state: str | None = Field(None, description="OAuth state（含 tenant_id / redirect）")
    tenant_id: int | None = Field(None, description="组织 ID（state 缺失时必填）")


class WeComAuthorizeUrlResponse(BaseModel):
    authorize_url: str
    state: str


class WeComWWLoginConfigResponse(BaseModel):
    corp_id: str
    agent_id: int
    redirect_uri: str
    state: str


class WeComBindResponse(BaseModel):
    wecom_userid: str
    message: str = "企业微信账号绑定成功"


class WeComUnbindResponse(BaseModel):
    message: str = "企业微信账号已解绑"


# 创建路由
router = APIRouter(prefix="/auth", tags=["Platform - Auth"])


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


@router.get("/wecom/authorize-url", response_model=WeComAuthorizeUrlResponse)
async def wecom_authorize_url(
    redirect_uri: str = Query(..., min_length=1, description="OAuth 回调地址（前端页面 URL）"),
    tenant_id: int = Query(..., ge=1, description="组织 ID"),
    redirect: str | None = Query(None, description="登录成功后前端跳转路径"),
):
    """
    获取企业微信 OAuth 授权地址（依赖租户已配置 type=wecom 应用连接器）。
    """
    post_login_redirect = (redirect or "").strip()
    state = encode_wecom_oauth_state(tenant_id=tenant_id, redirect=post_login_redirect)
    authorize_url = await build_wecom_oauth_authorize_url(
        tenant_id=tenant_id,
        redirect_uri=redirect_uri.strip(),
        state=state,
    )
    return WeComAuthorizeUrlResponse(authorize_url=authorize_url, state=state)


@router.get("/wecom/wwlogin-config", response_model=WeComWWLoginConfigResponse)
async def wecom_wwlogin_config(
    redirect_uri: str = Query(..., min_length=1, description="WWLogin 回调地址（前端页面 URL）"),
    tenant_id: int = Query(..., ge=1, description="组织 ID"),
    redirect: str | None = Query(None, description="登录成功后前端跳转路径"),
):
    """
    获取企业微信 PC 端 WWLogin 扫码登录配置（不返回 corp_secret）。
    """
    creds = await get_wecom_credentials(tenant_id)
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置启用的企业微信连接器，无法发起扫码登录",
        )
    state = encode_wecom_oauth_state(
        tenant_id=tenant_id,
        redirect=(redirect or "").strip(),
    )
    return WeComWWLoginConfigResponse(
        corp_id=creds.corp_id,
        agent_id=creds.agent_id,
        redirect_uri=redirect_uri.strip(),
        state=state,
    )


@router.post("/wecom/callback", response_model=LoginResponse)
async def wecom_callback(
    data: WeComCallbackRequest,
    request: Request,
    auth_service: Any = Depends(get_auth_service_with_fallback),
):
    """
    企业微信 OAuth 回调：用 code 换取 userid，匹配本地用户并签发 JWT。
    """
    tenant_id = data.tenant_id
    if data.state:
        decoded = decode_wecom_oauth_state(data.state)
        tenant_id = decoded["tenant_id"]
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少组织 ID，请重新发起企业微信登录",
        )

    wecom_userid = await resolve_wecom_user_id_from_code(tenant_id=tenant_id, code=data.code)
    user = await resolve_user_for_wecom_login(tenant_id=tenant_id, wecom_userid=wecom_userid)

    result = await auth_service.generate_login_result(user, request, tenant_id)
    return LoginResponse(**result)


@router.post("/wecom/bind", response_model=WeComBindResponse)
async def wecom_bind(
    data: WeComCallbackRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    已登录用户在个人资料中扫码绑定企业微信（写入 contact_info.wecom_userid）。
    """
    wecom_userid = await resolve_wecom_user_id_from_code(tenant_id=tenant_id, code=data.code)
    await bind_wecom_user_for_current_user(
        tenant_id=tenant_id,
        user=current_user,
        wecom_userid=wecom_userid,
    )
    return WeComBindResponse(wecom_userid=wecom_userid)


@router.post("/wecom/unbind", response_model=WeComUnbindResponse)
async def wecom_unbind(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    已登录用户在个人资料中解绑企业微信（清除 contact_info 中的企微 UserID）。
    """
    await unbind_wecom_user_for_current_user(tenant_id=tenant_id, user=current_user)
    return WeComUnbindResponse()


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_info(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    获取当前用户信息接口
    """
    # 平台超级管理员无租户上下文，直接返回管理员信息
    if getattr(current_user, "_is_infra_superadmin", False):
        from infra.models.infra_superadmin import InfraSuperAdmin

        admin_id = getattr(current_user, "_infra_superadmin_id", current_user.id)
        admin = await InfraSuperAdmin.get_or_none(id=admin_id)
        if not admin:
            raise NotFoundError("用户", str(admin_id))
        return CurrentUserResponse(
            id=admin.id,
            uuid=str(admin.uuid),
            username=admin.username,
            email=admin.email,
            full_name=admin.full_name,
            avatar=admin.avatar,
            tenant_id=None,
            tenant_name=None,
            is_active=admin.is_active,
            is_infra_admin=True,
            is_tenant_admin=False,
            permissions=[],
            permission_version=1,
        )

    from infra.services.user_service import UserService

    # 会话组织以 JWT 为准（get_current_user 已写入 request.state.tenant_id）
    jwt_tenant_id = getattr(request.state, "tenant_id", None)

    service = UserService()
    user_info = await service.get_user_with_tenant_info(
        current_user.id,
        jwt_tenant_id,
    )

    if not user_info:
        raise NotFoundError("用户", str(current_user.id))

    return CurrentUserResponse(**user_info)


@router.get("/my-tenants", response_model=list[TenantInfo])
async def get_my_tenants(
    current_user: User = Depends(get_current_user),
    auth_service: Any = Depends(get_auth_service_with_fallback),
):
    """
    获取当前登录账号可切换的组织列表。
    """
    return await auth_service.get_accessible_tenants(current_user)


@router.post("/switch-tenant", response_model=LoginResponse)
async def switch_tenant(
    data: SwitchTenantRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    auth_service: Any = Depends(get_auth_service_with_fallback),
):
    """
    在当前账号可访问的组织间切换，并签发新的会话 Token。
    """
    result = await auth_service.switch_tenant(
        current_user=current_user,
        target_tenant_id=data.tenant_id,
        request=request,
    )
    return LoginResponse(**result)


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
    return await biometric_service.get_registration_options(current_user)


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
    return await biometric_service.get_authentication_options(data.username)


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
