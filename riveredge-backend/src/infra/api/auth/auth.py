"""
用户认证 API 路由

提供用户登录、注册、Token 刷新等认证相关的 RESTful API 接口。

Author: Luigi Lu
Date: 2025-12-27
"""

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
import re

from pydantic import AliasChoices, BaseModel, Field, field_validator
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
from core.services.integration.gitee_oauth_service import (
    bind_gitee_for_current_user,
    bind_gitee_id_to_user,
    build_gitee_oauth_authorize_url,
    build_gitee_profile_preview,
    check_user_starred_official_repo,
    decode_gitee_link_ticket,
    decode_gitee_oauth_state,
    encode_gitee_link_ticket,
    encode_gitee_oauth_state,
    exchange_gitee_code_for_access_token,
    fetch_gitee_user,
    find_user_by_gitee_id,
    get_gitee_oauth_credentials,
    provision_user_for_gitee_first_login,
    resolve_user_for_gitee_login,
    star_official_repo,
    unbind_gitee_for_current_user,
)
from core.services.integration.dingtalk_oauth_service import (
    bind_dingtalk_for_current_user,
    build_dingtalk_oauth_authorize_url,
    decode_dingtalk_oauth_state,
    encode_dingtalk_oauth_state,
    resolve_dingtalk_user_from_code,
    resolve_user_for_dingtalk_login,
    unbind_dingtalk_for_current_user,
)
from core.services.integration.feishu_oauth_service import (
    bind_feishu_for_current_user,
    build_feishu_oauth_authorize_url,
    decode_feishu_oauth_state,
    encode_feishu_oauth_state,
    resolve_feishu_user_from_code,
    resolve_user_for_feishu_login,
    unbind_feishu_for_current_user,
)


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


class WeComBootstrapTenantResponse(BaseModel):
    """企微 H5 无 tenant_id 时的组织发现结果。"""

    tenant_id: int | None = Field(
        None,
        description="唯一启用企微连接器时的组织 ID；多组织时为 null",
    )
    candidates_count: int = Field(
        0,
        description="启用企微连接器且凭证完整的组织数量",
    )


class GiteeAuthorizeUrlResponse(BaseModel):
    authorize_url: str
    state: str


class GiteeCallbackRequest(BaseModel):
    """Gitee OAuth 回调。"""

    code: str = Field(..., min_length=1, description="Gitee OAuth code")
    state: str | None = Field(None, description="OAuth state（含 tenant_id / redirect_uri）")
    tenant_id: int | None = Field(None, description="组织 ID（state 缺失时必填）")
    redirect_uri: str | None = Field(
        None, description="与授权时一致的回调地址（state 缺失时必填）"
    )


class GiteeBindResponse(BaseModel):
    gitee_id: str
    message: str = "Gitee 账号绑定成功"


class GiteeUnbindResponse(BaseModel):
    message: str = "Gitee 账号已解绑"


class GiteeProfilePreview(BaseModel):
    id: str
    login: str | None = None
    email: str | None = None
    name: str | None = None
    avatar_url: str | None = None
    starred_official_repo: bool = False


class GiteeLoginCallbackResponse(BaseModel):
    """已绑定直接登录；未绑定返回 needs_link 供前端弹出信息补全窗。"""

    status: str = Field("ok", description="ok | needs_link")
    access_token: str | None = None
    token_type: str = "bearer"
    expires_in: int = 0
    user: dict | None = None
    tenants: list | None = None
    default_tenant_id: int | None = None
    requires_tenant_selection: bool = False
    requires_phone_verification: bool = False
    ticket: str | None = None
    gitee: GiteeProfilePreview | None = None
    starred_official_repo: bool | None = None


class GiteeLinkLoginRequest(BaseModel):
    ticket: str = Field(..., min_length=1, description="Gitee 关联凭证")
    username: str = Field(..., min_length=1, description="系统账号或手机号")
    password: str = Field(..., min_length=1, description="系统密码")


class GiteeFirstLoginRequest(BaseModel):
    ticket: str = Field(..., min_length=1, description="Gitee 关联凭证")
    username: str = Field(..., min_length=2, max_length=50, description="登录用户名（默认可与 Gitee 账号一致）")
    password: str = Field(..., min_length=8, description="登录密码（至少 8 位）")
    phone: str | None = Field(None, description="手机号（选填）")
    email: str | None = Field(None, description="邮箱（选填）")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        from infra.domain.security.reserved_username import assert_tenant_user_username_allowed

        return assert_tenant_user_username_allowed(v.strip())

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if not re.match(r"^1[3-9]\d{9}$", str(v).strip()):
            raise ValueError("手机号格式不正确，须为11位中国大陆手机号")
        return str(v).strip()

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if "@" not in v:
            raise ValueError("邮箱格式不正确，必须包含@符号")
        return v.strip()


class GiteeStarOfficialRequest(BaseModel):
    ticket: str = Field(..., min_length=1, description="Gitee 关联凭证（含短时 access_token）")


class GiteeStarOfficialResponse(BaseModel):
    starred: bool = True
    message: str = "已 Star 官方仓库"


class DingTalkAuthorizeUrlResponse(BaseModel):
    authorize_url: str
    state: str


class DingTalkCallbackRequest(BaseModel):
    code: str = Field(..., min_length=1, description="钉钉 OAuth code / authCode")
    state: str | None = Field(None, description="OAuth state（含 tenant_id / redirect_uri）")
    tenant_id: int | None = Field(None, description="组织 ID（state 缺失时必填）")


class DingTalkBindResponse(BaseModel):
    unionid: str | None = None
    openid: str | None = None
    message: str = "钉钉账号绑定成功"


class DingTalkUnbindResponse(BaseModel):
    message: str = "钉钉账号已解绑"


class FeishuAuthorizeUrlResponse(BaseModel):
    authorize_url: str
    state: str


class FeishuCallbackRequest(BaseModel):
    code: str = Field(..., min_length=1, description="飞书 OAuth code")
    state: str | None = Field(None, description="OAuth state（含 tenant_id / redirect_uri）")
    tenant_id: int | None = Field(None, description="组织 ID（state 缺失时必填）")
    redirect_uri: str | None = Field(None, description="与授权时一致的回调地址")


class FeishuBindResponse(BaseModel):
    open_id: str | None = None
    union_id: str | None = None
    message: str = "飞书账号绑定成功"


class FeishuUnbindResponse(BaseModel):
    message: str = "飞书账号已解绑"


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


@router.get("/wecom/bootstrap-tenant", response_model=WeComBootstrapTenantResponse)
async def wecom_bootstrap_tenant():
    """
    企微移动端 H5 打开且 URL 无 tenant_id 时：若全站仅有一个启用且凭证完整的企微组织，返回该组织 ID，供静默 OAuth。
    多组织时不猜测，由前端依赖本地记忆或 URL 参数。
    """
    from core.models.integration_config import IntegrationConfig

    rows = await IntegrationConfig.filter(
        type="wecom",
        is_active=True,
        deleted_at__isnull=True,
    )
    tenant_ids: list[int] = []
    seen: set[int] = set()
    for row in rows:
        tid = int(row.tenant_id)
        if tid in seen:
            continue
        creds = await get_wecom_credentials(tid)
        if not creds:
            continue
        seen.add(tid)
        tenant_ids.append(tid)

    if len(tenant_ids) == 1:
        return WeComBootstrapTenantResponse(tenant_id=tenant_ids[0], candidates_count=1)
    return WeComBootstrapTenantResponse(
        tenant_id=None,
        candidates_count=len(tenant_ids),
    )


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


@router.get("/gitee/authorize-url", response_model=GiteeAuthorizeUrlResponse)
async def gitee_authorize_url(
    redirect_uri: str = Query(..., min_length=1, description="OAuth 回调地址（前端页面 URL）"),
    tenant_id: int = Query(..., ge=1, description="组织 ID"),
    redirect: str | None = Query(None, description="登录成功后前端跳转路径"),
):
    """
    获取 Gitee OAuth 授权地址（依赖平台设置中的 Client ID / Secret）。
    """
    redirect_uri_clean = redirect_uri.strip()
    state = encode_gitee_oauth_state(
        tenant_id=tenant_id,
        redirect_uri=redirect_uri_clean,
        redirect=(redirect or "").strip(),
    )
    authorize_url = await build_gitee_oauth_authorize_url(
        redirect_uri=redirect_uri_clean,
        state=state,
    )
    return GiteeAuthorizeUrlResponse(authorize_url=authorize_url, state=state)


@router.post("/gitee/callback", response_model=GiteeLoginCallbackResponse)
async def gitee_callback(
    data: GiteeCallbackRequest,
    request: Request,
    auth_service: Any = Depends(get_auth_service_with_fallback),
):
    """
    Gitee OAuth 回调：已绑定则签发 JWT；未绑定不自动关联，返回 needs_link 供补全窗绑定。
    """
    tenant_id = data.tenant_id
    redirect_uri = (data.redirect_uri or "").strip()
    if data.state:
        decoded = decode_gitee_oauth_state(data.state)
        tenant_id = decoded["tenant_id"]
        redirect_uri = decoded["redirect_uri"]
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少组织 ID，请重新发起 Gitee 登录",
        )
    if not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少回调地址，请重新发起 Gitee 登录",
        )

    access_token = await exchange_gitee_code_for_access_token(
        code=data.code, redirect_uri=redirect_uri
    )
    gitee_user = await fetch_gitee_user(access_token=access_token)
    starred = await check_user_starred_official_repo(access_token=access_token)
    user = await resolve_user_for_gitee_login(tenant_id=tenant_id, gitee_user=gitee_user)
    if user is not None:
        result = await auth_service.generate_login_result(user, request, tenant_id)
        return GiteeLoginCallbackResponse(
            status="ok",
            starred_official_repo=starred,
            **result,
        )

    creds = await get_gitee_oauth_credentials()
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置 Gitee OAuth（平台设置中填写 Client ID 与 Client Secret）",
        )
    preview = build_gitee_profile_preview(gitee_user)
    if not preview.get("id"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未能获取 Gitee 用户标识")
    preview["starred_official_repo"] = starred
    ticket = encode_gitee_link_ticket(
        secret=creds.client_secret,
        tenant_id=tenant_id,
        gitee_id=str(preview["id"]),
        login=preview.get("login"),
        email=preview.get("email"),
        name=preview.get("name"),
        avatar_url=preview.get("avatar_url"),
        access_token=access_token,
    )
    return GiteeLoginCallbackResponse(
        status="needs_link",
        ticket=ticket,
        gitee=GiteeProfilePreview(**preview),
        starred_official_repo=starred,
    )


@router.post("/gitee/star-official", response_model=GiteeStarOfficialResponse)
async def gitee_star_official(data: GiteeStarOfficialRequest):
    """关联弹窗内一键 Star 官方仓库（使用 ticket 内短时 access_token）。"""
    creds = await get_gitee_oauth_credentials()
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置 Gitee OAuth（平台设置中填写 Client ID 与 Client Secret）",
        )
    ticket_data = decode_gitee_link_ticket(secret=creds.client_secret, ticket=data.ticket.strip())
    access_token = ticket_data.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="关联凭证缺少授权信息，请关闭窗口后重新使用 Gitee 登录",
        )
    await star_official_repo(access_token=str(access_token))
    return GiteeStarOfficialResponse()


@router.post("/gitee/first-login", response_model=LoginResponse)
async def gitee_first_login(
    data: GiteeFirstLoginRequest,
    request: Request,
):
    """Gitee 首次登录：按用户确认的用户名/密码在当前组织建号、绑定并签发会话。"""
    creds = await get_gitee_oauth_credentials()
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置 Gitee OAuth（平台设置中填写 Client ID 与 Client Secret）",
        )
    ticket_data = decode_gitee_link_ticket(secret=creds.client_secret, ticket=data.ticket.strip())
    tenant_id = int(ticket_data["tenant_id"])
    user = await provision_user_for_gitee_first_login(
        tenant_id=tenant_id,
        gitee_id=str(ticket_data["gitee_id"]),
        login=ticket_data.get("login"),
        email=ticket_data.get("email"),
        name=ticket_data.get("name"),
        username=data.username.strip(),
        password=data.password,
        phone=data.phone,
        user_email=data.email,
    )
    result = await AuthService().generate_login_result(user, request, tenant_id)
    return LoginResponse(**result)


@router.post("/gitee/link-login", response_model=LoginResponse)
async def gitee_link_login(
    data: GiteeLinkLoginRequest,
    request: Request,
):
    """绑定已有系统账号：校验密码后写入 Gitee 绑定并登录。"""
    creds = await get_gitee_oauth_credentials()
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置 Gitee OAuth（平台设置中填写 Client ID 与 Client Secret）",
        )
    ticket_data = decode_gitee_link_ticket(secret=creds.client_secret, ticket=data.ticket.strip())
    tenant_id = int(ticket_data["tenant_id"])
    gitee_id = str(ticket_data["gitee_id"])
    occupied = await find_user_by_gitee_id(tenant_id=tenant_id, gitee_id=gitee_id)
    if occupied:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该 Gitee 账号已绑定其他用户，请直接使用 Gitee 登录",
        )
    # AuthServiceImpl 门面无验密私有方法；与 refresh_token 等路径一致，直接用 AuthService
    auth_service = AuthService()
    try:
        user, password_matched_users = await auth_service._resolve_login_user(
            data.username.strip(),
            data.password,
            tenant_id,
        )
    except HTTPException:
        raise
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    if user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="请使用当前组织下的系统账号完成绑定",
        )
    await bind_gitee_id_to_user(
        user=user,
        gitee_id=gitee_id,
        gitee_login=ticket_data.get("login"),
    )
    result = await auth_service.generate_login_result(
        user,
        request,
        tenant_id,
        password_matched_users=password_matched_users,
    )
    return LoginResponse(**result)


@router.post("/gitee/bind", response_model=GiteeBindResponse)
async def gitee_bind(
    data: GiteeCallbackRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    已登录用户绑定 Gitee（写入 contact_info.gitee_id）。
    """
    redirect_uri = (data.redirect_uri or "").strip()
    if data.state:
        decoded = decode_gitee_oauth_state(data.state)
        redirect_uri = decoded["redirect_uri"]
    if not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少回调地址，请重新发起 Gitee 绑定",
        )
    access_token = await exchange_gitee_code_for_access_token(
        code=data.code, redirect_uri=redirect_uri
    )
    gitee_user = await fetch_gitee_user(access_token=access_token)
    await bind_gitee_for_current_user(
        tenant_id=tenant_id,
        user=current_user,
        gitee_user=gitee_user,
    )
    gitee_id = str(gitee_user.get("id") or "").strip()
    return GiteeBindResponse(gitee_id=gitee_id)


@router.post("/gitee/unbind", response_model=GiteeUnbindResponse)
async def gitee_unbind(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已登录用户解绑 Gitee。"""
    await unbind_gitee_for_current_user(tenant_id=tenant_id, user=current_user)
    return GiteeUnbindResponse()


@router.get("/dingtalk/authorize-url", response_model=DingTalkAuthorizeUrlResponse)
async def dingtalk_authorize_url(
    redirect_uri: str = Query(..., min_length=1, description="OAuth 回调地址（前端页面 URL）"),
    tenant_id: int = Query(..., ge=1, description="组织 ID"),
    redirect: str | None = Query(None, description="登录成功后前端跳转路径"),
):
    """获取钉钉 OAuth 授权地址（依赖租户钉钉应用连接器）。"""
    redirect_uri_clean = redirect_uri.strip()
    state = encode_dingtalk_oauth_state(
        tenant_id=tenant_id,
        redirect_uri=redirect_uri_clean,
        redirect=(redirect or "").strip(),
    )
    authorize_url = await build_dingtalk_oauth_authorize_url(
        tenant_id=tenant_id,
        redirect_uri=redirect_uri_clean,
        state=state,
    )
    return DingTalkAuthorizeUrlResponse(authorize_url=authorize_url, state=state)


@router.post("/dingtalk/callback", response_model=LoginResponse)
async def dingtalk_callback(
    data: DingTalkCallbackRequest,
    request: Request,
    auth_service: Any = Depends(get_auth_service_with_fallback),
):
    """钉钉 OAuth 回调：换票取用户信息，匹配本地用户并签发 JWT。"""
    tenant_id = data.tenant_id
    if data.state:
        decoded = decode_dingtalk_oauth_state(data.state)
        tenant_id = decoded["tenant_id"]
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少组织 ID，请重新发起钉钉登录",
        )
    dingtalk_user = await resolve_dingtalk_user_from_code(tenant_id=tenant_id, code=data.code)
    user = await resolve_user_for_dingtalk_login(tenant_id=tenant_id, dingtalk_user=dingtalk_user)
    result = await auth_service.generate_login_result(user, request, tenant_id)
    return LoginResponse(**result)


@router.post("/dingtalk/bind", response_model=DingTalkBindResponse)
async def dingtalk_bind(
    data: DingTalkCallbackRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已登录用户绑定钉钉。"""
    dingtalk_user = await resolve_dingtalk_user_from_code(tenant_id=tenant_id, code=data.code)
    await bind_dingtalk_for_current_user(
        tenant_id=tenant_id,
        user=current_user,
        dingtalk_user=dingtalk_user,
    )
    unionid = dingtalk_user.get("unionId") if isinstance(dingtalk_user.get("unionId"), str) else None
    openid = dingtalk_user.get("openId") if isinstance(dingtalk_user.get("openId"), str) else None
    return DingTalkBindResponse(unionid=unionid, openid=openid)


@router.post("/dingtalk/unbind", response_model=DingTalkUnbindResponse)
async def dingtalk_unbind(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已登录用户解绑钉钉。"""
    await unbind_dingtalk_for_current_user(tenant_id=tenant_id, user=current_user)
    return DingTalkUnbindResponse()


@router.get("/feishu/authorize-url", response_model=FeishuAuthorizeUrlResponse)
async def feishu_authorize_url(
    redirect_uri: str = Query(..., min_length=1, description="OAuth 回调地址（前端页面 URL）"),
    tenant_id: int = Query(..., ge=1, description="组织 ID"),
    redirect: str | None = Query(None, description="登录成功后前端跳转路径"),
):
    """获取飞书 OAuth 授权地址（依赖租户飞书应用连接器）。"""
    redirect_uri_clean = redirect_uri.strip()
    state = encode_feishu_oauth_state(
        tenant_id=tenant_id,
        redirect_uri=redirect_uri_clean,
        redirect=(redirect or "").strip(),
    )
    authorize_url = await build_feishu_oauth_authorize_url(
        tenant_id=tenant_id,
        redirect_uri=redirect_uri_clean,
        state=state,
    )
    return FeishuAuthorizeUrlResponse(authorize_url=authorize_url, state=state)


@router.post("/feishu/callback", response_model=LoginResponse)
async def feishu_callback(
    data: FeishuCallbackRequest,
    request: Request,
    auth_service: Any = Depends(get_auth_service_with_fallback),
):
    """飞书 OAuth 回调：换票取用户信息，匹配本地用户并签发 JWT。"""
    tenant_id = data.tenant_id
    redirect_uri = (data.redirect_uri or "").strip()
    if data.state:
        decoded = decode_feishu_oauth_state(data.state)
        tenant_id = decoded["tenant_id"]
        redirect_uri = decoded["redirect_uri"]
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少组织 ID，请重新发起飞书登录",
        )
    if not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少回调地址，请重新发起飞书登录",
        )
    feishu_user = await resolve_feishu_user_from_code(
        tenant_id=tenant_id, code=data.code, redirect_uri=redirect_uri
    )
    user = await resolve_user_for_feishu_login(tenant_id=tenant_id, feishu_user=feishu_user)
    result = await auth_service.generate_login_result(user, request, tenant_id)
    return LoginResponse(**result)


@router.post("/feishu/bind", response_model=FeishuBindResponse)
async def feishu_bind(
    data: FeishuCallbackRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已登录用户绑定飞书。"""
    redirect_uri = (data.redirect_uri or "").strip()
    if data.state:
        decoded = decode_feishu_oauth_state(data.state)
        redirect_uri = decoded["redirect_uri"]
    if not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少回调地址，请重新发起飞书绑定",
        )
    feishu_user = await resolve_feishu_user_from_code(
        tenant_id=tenant_id, code=data.code, redirect_uri=redirect_uri
    )
    await bind_feishu_for_current_user(
        tenant_id=tenant_id,
        user=current_user,
        feishu_user=feishu_user,
    )
    open_id = feishu_user.get("open_id") if isinstance(feishu_user.get("open_id"), str) else None
    union_id = feishu_user.get("union_id") if isinstance(feishu_user.get("union_id"), str) else None
    return FeishuBindResponse(open_id=open_id, union_id=union_id)


@router.post("/feishu/unbind", response_model=FeishuUnbindResponse)
async def feishu_unbind(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已登录用户解绑飞书。"""
    await unbind_feishu_for_current_user(tenant_id=tenant_id, user=current_user)
    return FeishuUnbindResponse()


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
