"""
站点设置管理 API 路由

提供站点设置的获取和更新操作。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from core.schemas.site_setting import SiteSettingUpdate, SiteSettingResponse
from core.services.system.site_setting_service import SiteSettingService
from core.utils.integration_settings import (
    build_deepseek_public_status_for_tenant,
    mask_integrations_for_response,
    merge_integrations_update,
)
from core.utils.site_setting_response import mask_company_seal_for_response
from core.services.authorization.user_permission_service import UserPermissionService
from core.api.deps.access import AuthContext, get_auth_context, require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from core.ai.deps import AiAuth, get_ai_auth
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User
from infra.models.tenant import Tenant
from infra.schemas.tenant import (
    TenantResponse,
    TenantListResponse,
    TenantAdminAccountCreate,
    TenantCreate,
    TenantUpdate,
)
from infra.models.tenant import TenantStatus
from infra.services.tenant_service import TenantService, schedule_initialize_tenant_data
from infra.services.package_service import PackageService

router = APIRouter(prefix="/site-settings", tags=["Core - Site Settings"])


async def _include_company_seal_in_response(auth: AuthContext) -> bool:
    if auth.is_infra_admin or auth.is_tenant_admin:
        return True
    if auth.tenant_id is None:
        return False
    return await UserPermissionService.has_permission(
        auth.user_id,
        auth.tenant_id,
        "system:print-template:read",
    )


class DeepSeekIntegrationStatusResponse(BaseModel):
    configured: bool
    enabled: bool
    model: str


class DeepSeekChatCompletionRequest(BaseModel):
    messages: List[Dict[str, Any]] = Field(..., min_length=1)
    model: Optional[str] = None
    stream: bool = False
    temperature: Optional[float] = Field(default=0.7, ge=0, le=2)
    context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="KU-AI 业务上下文（screen / resource_key / record_id 等）",
    )


def _deepseek_validation_http_exception(exc: ValidationError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


class SubtenantCapabilityResponse(BaseModel):
    tenant_id: int
    is_subtenant: bool
    can_create_subtenant: bool


class SubtenantCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    domain: str = Field(..., min_length=1, max_length=100)
    admin_account: Optional[TenantAdminAccountCreate] = None


class BranchOrganizationCapabilityResponse(BaseModel):
    tenant_id: int
    is_branch_organization: bool
    can_create_branch_organization: bool


class BranchOrganizationUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    domain: Optional[str] = Field(None, min_length=1, max_length=100)
    status: Optional[TenantStatus] = None


class TenantDomainAvailabilityResponse(BaseModel):
    domain: str
    available: bool
    message: str


from infra.domain.tenant.reserved_tenant_domain import normalize_tenant_domain

_LOGIN_PAGE_SETTING_KEYS = {
    "platform_name",
    "platform_name_en",
    "login_logo",
    "login_title",
    "login_title_en",
    "login_content",
    "login_content_en",
    "login_decoration_image",
    "login_background_image",
    "login_decoration_enabled",
    "login_background_enabled",
    "icp_license",
    "icp_license_en",
    "login_theme_color",
    "login_guest_enabled",
    "login_client_win_enabled",
    "login_client_android_enabled",
    "login_quick_enabled",
}


async def _rollback_created_tenant(tenant_id: int) -> None:
    """创建流程失败时清理已写入的组织记录。"""
    from infra.models.tenant import Tenant as TenantModel
    from infra.models.tenant_activity_log import TenantActivityLog

    await TenantActivityLog.filter(tenant_id=tenant_id).delete()
    await TenantModel.filter(id=tenant_id).delete()


@router.get(
    "/integrations/deepseek/status",
    response_model=DeepSeekIntegrationStatusResponse,
    dependencies=[Depends(require_permission_codes("kuaiai:entry:read"))],
)
async def get_deepseek_integration_status(
    tenant_id: int = Depends(get_current_tenant),
):
    """查询当前租户 AI 连接是否可用于 KU-AI 对话（核心路由，不依赖 KU-AI 应用挂载）。"""
    return await build_deepseek_public_status_for_tenant(tenant_id)


@router.post(
    "/integrations/deepseek/completions",
    dependencies=[Depends(require_permission_codes("kuaiai:entry:read"))],
)
async def create_deepseek_chat_completion(
    body: DeepSeekChatCompletionRequest,
    ai_auth: AiAuth = Depends(get_ai_auth),
):
    """代理 DeepSeek Chat Completions（薄转发至 RiverEdge AI Runtime）。"""
    from loguru import logger

    from core.ai.chat_handler import create_chat_completion

    try:
        return await create_chat_completion(
            ai_auth,
            body.messages,
            model=body.model,
            temperature=body.temperature,
            stream=body.stream,
            context=body.context,
        )
    except ValidationError as exc:
        raise _deepseek_validation_http_exception(exc) from exc
    except Exception as exc:
        logger.error("KU-AI 对话失败 tenant_id={} error={}", ai_auth.tenant_id, exc)
        raise _deepseek_validation_http_exception(ValidationError("对话请求失败，请稍后重试")) from exc


@router.get("", response_model=SiteSettingResponse)
async def get_settings(
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    获取站点设置
    
    获取当前组织的站点设置，如果不存在则自动创建。
    新租户未设置 site_name、site_logo 时，自动回退到平台级设置。
    
    Args:
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        SiteSettingResponse: 站点设置对象（含平台回退后的设置）
    """
    site_settings = await SiteSettingService.get_settings(tenant_id)
    merged_settings = await SiteSettingService.get_settings_with_platform_fallback(tenant_id)
    tenant = await Tenant.get_or_none(id=tenant_id)
    if tenant:
        merged_settings["tenant_domain"] = tenant.domain
    merged_settings = mask_integrations_for_response(merged_settings)
    merged_settings = mask_company_seal_for_response(
        merged_settings,
        include_seal_value=await _include_company_seal_in_response(auth),
    )
    return SiteSettingResponse(
        uuid=site_settings.uuid,
        tenant_id=site_settings.tenant_id,
        settings=merged_settings,
        created_at=site_settings.created_at,
        updated_at=site_settings.updated_at,
    )


@router.put("", response_model=SiteSettingResponse)
async def update_settings(
    data: SiteSettingUpdate,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    更新站点设置
    
    更新当前组织的站点设置。
    
    Args:
        data: 站点设置更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        SiteSettingResponse: 更新后的站点设置对象
    """
    settings_payload = dict(data.settings or {})
    tenant_domain = settings_payload.pop("tenant_domain", None)
    current_tenant = await Tenant.get_or_none(id=tenant_id)
    if not current_tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="当前组织不存在")

    if bool(current_tenant.is_subtenant):
        touched_login_keys = [k for k in settings_payload.keys() if k in _LOGIN_PAGE_SETTING_KEYS]
        if touched_login_keys:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="分支组织不允许单独设置登录页配置",
            )

    if _LOGIN_PAGE_SETTING_KEYS & settings_payload.keys():
        from core.utils.login_page_settings import resolve_login_visual_layers, validate_login_visual_layers

        merged_current = await SiteSettingService.get_settings_with_platform_fallback(tenant_id)
        merged_preview = {**merged_current, **settings_payload}
        decoration_enabled, background_enabled = resolve_login_visual_layers(merged_preview)
        try:
            validate_login_visual_layers(decoration_enabled, background_enabled)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if tenant_domain is not None:
        normalized_domain = normalize_tenant_domain(str(tenant_domain))
        exists = await Tenant.filter(domain=normalized_domain).exclude(id=tenant_id).exists()
        if exists:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"组织域名 {normalized_domain} 已被占用")
        if current_tenant.domain != normalized_domain:
            current_tenant.domain = normalized_domain
            await current_tenant.save(update_fields=["domain", "updated_at"])

    if "integrations" in settings_payload:
        current_site_settings = await SiteSettingService.get_settings(tenant_id)
        current_settings = dict(current_site_settings.settings or {})
        settings_payload["integrations"] = merge_integrations_update(
            current_settings.get("integrations"),
            settings_payload.get("integrations"),
        )

    settings = await SiteSettingService.update_settings(
        tenant_id,
        SiteSettingUpdate(settings=settings_payload),
    )
    merged_settings = await SiteSettingService.get_settings_with_platform_fallback(tenant_id)
    tenant = await Tenant.get_or_none(id=tenant_id)
    if tenant:
        merged_settings["tenant_domain"] = tenant.domain
    merged_settings = mask_integrations_for_response(merged_settings)
    merged_settings = mask_company_seal_for_response(
        merged_settings,
        include_seal_value=await _include_company_seal_in_response(auth),
    )
    return SiteSettingResponse(
        uuid=settings.uuid,
        tenant_id=settings.tenant_id,
        settings=merged_settings,
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


@router.get("/domain-availability", response_model=TenantDomainAvailabilityResponse)
async def check_tenant_domain_availability(
    domain: str = Query(..., min_length=1, description="待检查组织域名"),
    tenant_id: int = Depends(get_current_tenant),
):
    normalized_domain = normalize_tenant_domain(domain)
    exists = await Tenant.filter(domain=normalized_domain).exclude(id=tenant_id).exists()
    if exists:
        return TenantDomainAvailabilityResponse(
            domain=normalized_domain,
            available=False,
            message=f"组织域名 {normalized_domain} 已被占用",
        )
    return TenantDomainAvailabilityResponse(
        domain=normalized_domain,
        available=True,
        message="组织域名可用",
    )


@router.get("/subtenants/capability", response_model=SubtenantCapabilityResponse)
async def get_subtenant_capability(
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    tenant = await Tenant.get_or_none(id=tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="组织不存在")
    can_create = bool(getattr(current_user, "is_tenant_admin", False)) and not bool(tenant.is_subtenant)
    return SubtenantCapabilityResponse(
        tenant_id=tenant.id,
        is_subtenant=bool(tenant.is_subtenant),
        can_create_subtenant=can_create,
    )


@router.get("/branch-organizations/capability", response_model=BranchOrganizationCapabilityResponse)
async def get_branch_organization_capability(
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    tenant = await Tenant.get_or_none(id=tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="组织不存在")
    can_create = bool(getattr(current_user, "is_tenant_admin", False)) and not bool(tenant.is_subtenant)
    return BranchOrganizationCapabilityResponse(
        tenant_id=tenant.id,
        is_branch_organization=bool(tenant.is_subtenant),
        can_create_branch_organization=can_create,
    )


@router.get("/branch-organizations", response_model=TenantListResponse)
async def list_branch_organizations(
    page: int = 1,
    page_size: int = 20,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    if not bool(getattr(current_user, "is_tenant_admin", False)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅组织管理员可查看分支组织")

    current_tenant = await Tenant.get_or_none(id=tenant_id)
    if not current_tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="当前组织不存在")
    if bool(current_tenant.is_subtenant):
        return TenantListResponse(items=[], total=0, page=page, page_size=page_size)

    tenant_service = TenantService()
    result = await tenant_service.list_tenants(
        page=page,
        page_size=page_size,
        parent_tenant_id=current_tenant.id,
        is_subtenant=True,
        skip_tenant_filter=True,
        sort="created_at",
        order="desc",
    )
    return TenantListResponse(**result)


@router.post("/subtenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_subtenant_from_site_settings(
    data: SubtenantCreateRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    if not bool(getattr(current_user, "is_tenant_admin", False)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅组织管理员可创建分支组织")

    current_tenant = await Tenant.get_or_none(id=tenant_id)
    if not current_tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="当前组织不存在")
    if bool(current_tenant.is_subtenant):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="分支组织不允许再创建下级组织")

    package_config = await PackageService().get_effective_package_config_for_plan(current_tenant.plan)
    max_branch_organizations = package_config.get("max_branch_organizations")
    if max_branch_organizations is not None:
        current_branch_count = await Tenant.filter(
            parent_tenant_id=current_tenant.id,
            is_subtenant=True,
        ).count()
        if current_branch_count >= int(max_branch_organizations):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"当前套餐最多允许创建 {max_branch_organizations} 个分支组织，请升级套餐后重试",
            )

    tenant_service = TenantService()
    tenant = await tenant_service.create_tenant(
        TenantCreate(
            name=data.name,
            domain=data.domain,
            status=current_tenant.status,
            plan=current_tenant.plan,
            settings={"description": f"由主组织 {current_tenant.name} 在站点管理创建"},
            max_users=None,
            max_storage=None,
            expires_at=current_tenant.expires_at,
            parent_tenant_id=current_tenant.id,
            admin_account=data.admin_account,
        )
    )

    from infra.schemas.user import UserCreate
    from infra.services.user_service import UserService

    user_service = UserService()
    try:
        if data.admin_account is not None:
            admin = data.admin_account
            await user_service.create_user(
                UserCreate(
                    username=admin.username,
                    phone=admin.phone,
                    password=admin.password,
                    full_name=admin.full_name,
                    tenant_id=tenant.id,
                    is_active=True,
                    is_infra_admin=False,
                    is_tenant_admin=True,
                ),
                tenant_id=tenant.id,
            )
        else:
            creator = await User.get_or_none(
                id=current_user.id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not creator or not creator.password_hash:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="当前管理员账号异常，无法沿用当前账号创建分支组织管理员",
                )
            await tenant_service.assert_shared_user_quota_capacity(tenant.id, increment=1)
            await User.create(
                tenant_id=tenant.id,
                username=creator.username,
                phone=creator.phone,
                email=creator.email,
                password_hash=creator.password_hash,
                full_name=creator.full_name,
                is_active=True,
                is_infra_admin=False,
                is_tenant_admin=True,
                source=creator.source,
            )
    except Exception:
        await _rollback_created_tenant(tenant.id)
        raise

    from core.services.tenant.tenant_init_data_service import TenantInitDataService

    await TenantInitDataService.set_tenant_data_initializing(tenant.id, True)
    schedule_initialize_tenant_data(tenant.id)
    return tenant


@router.post("/branch-organizations", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_branch_organization_from_site_settings(
    data: SubtenantCreateRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    return await create_subtenant_from_site_settings(
        data=data,
        tenant_id=tenant_id,
        current_user=current_user,
    )


@router.put("/branch-organizations/{branch_org_id}", response_model=TenantResponse)
async def update_branch_organization_from_site_settings(
    branch_org_id: int,
    data: BranchOrganizationUpdateRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    if not bool(getattr(current_user, "is_tenant_admin", False)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅组织管理员可修改分支组织")

    current_tenant = await Tenant.get_or_none(id=tenant_id)
    if not current_tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="当前组织不存在")
    if bool(current_tenant.is_subtenant):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="分支组织不允许修改分支组织")

    branch_org = await Tenant.get_or_none(id=branch_org_id)
    if not branch_org or not bool(branch_org.is_subtenant):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分支组织不存在")
    if branch_org.parent_tenant_id != current_tenant.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权修改该分支组织")

    update_payload = data.model_dump(exclude_unset=True)
    if not update_payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请提供要修改的字段")

    if "domain" in update_payload:
        normalized_domain = normalize_tenant_domain(update_payload["domain"])
        domain_taken = await Tenant.filter(domain=normalized_domain).exclude(id=branch_org_id).exists()
        if domain_taken:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"组织域名 {normalized_domain} 已被占用",
            )
        update_payload["domain"] = normalized_domain

    tenant_service = TenantService()
    tenant = await tenant_service.update_tenant(
        branch_org_id,
        TenantUpdate(**update_payload),
        skip_tenant_filter=True,
    )
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分支组织不存在")
    return tenant

