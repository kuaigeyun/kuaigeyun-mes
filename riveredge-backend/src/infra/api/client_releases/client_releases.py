"""平台级客户端发布 API（超管 + 公开检查/登录下载）。"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from pydantic import BaseModel, Field

from core.services import client_release_service as svc
from core.services import client_product_config_service as product_cfg_svc
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.api.deps.deps import get_current_infra_superadmin
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.models.user import User
from infra.services.platform_settings_service import PlatformSettingsService

router = APIRouter(prefix="/client-releases", tags=["Platform - Client Releases"])


class ClientProductOut(BaseModel):
    client_key: str
    display_name: str
    app_code: str | None
    client_kind: str
    platform_target: str
    supports_ota: bool
    login_tile_slot: str
    sort_order: int
    header_download_enabled: bool = True


class ClientReleaseCreateIn(BaseModel):
    client_key: str
    platform: str
    app_version: str
    version_code: int = Field(default=0, ge=0)
    runtime_version: str | None = None
    update_type: str = Field(description="package | ota | both")
    requires_native: bool = False
    force_update: bool = False
    min_version_code: int = Field(default=0, ge=0)
    release_notes: str = ""
    bundle_id: str | None = None
    ota_relative_path: str | None = None
    rollout_percent: int = Field(default=100, ge=0, le=100)
    activate: bool = False


class ClientReleaseUpdateIn(BaseModel):
    """可编辑元数据；客户端 / 平台 / 版本号不可改。安装包通过 upload-package 可选替换。"""

    release_notes: str | None = None
    force_update: bool | None = None
    rollout_percent: int | None = Field(default=None, ge=0, le=100)
    runtime_version: str | None = None
    min_version_code: int | None = Field(default=None, ge=0)


class ClientReleaseOut(BaseModel):
    id: int
    uuid: str
    client_key: str
    platform: str
    app_version: str
    version_code: int
    runtime_version: str | None
    update_type: str
    requires_native: bool
    force_update: bool
    min_version_code: int
    release_notes: str
    bundle_id: str | None
    is_active: bool
    rollout_percent: int
    artifact_ext: str | None = None
    published_at: str | None
    created_by: str | None
    package: dict[str, Any] | None = None
    apk: dict[str, Any] | None = None
    ota: dict[str, Any] | None = None


class ClientReleaseCheckOut(BaseModel):
    client_key: str
    update_type: str
    force: bool = False
    latest: dict[str, Any] | None = None
    ota: dict[str, Any] | None = None


class LoginClientDownloadOut(BaseModel):
    client_key: str
    display_name: str
    app_version: str
    url: str
    sha256: str | None = None
    size_bytes: int | None = None
    release_notes: str = ""


class LoginClientDownloadsOut(BaseModel):
    windows: LoginClientDownloadOut | None = None
    android_pda: LoginClientDownloadOut | None = None


class ClientProductConfigOut(BaseModel):
    client_key: str
    display_name: str
    platform_target: str
    push_configurable: bool
    push_enabled: bool
    header_download_enabled: bool = True
    jpush_app_key: str
    jpush_master_secret_configured: bool
    effective_push_ready: bool
    env_fallback_app_key: bool
    env_fallback_master_secret: bool


class ClientProductConfigUpdateIn(BaseModel):
    push_enabled: bool | None = None
    header_download_enabled: bool | None = None
    jpush_app_key: str | None = None
    jpush_master_secret: str | None = Field(
        default=None,
        description="留空表示不修改；传空字符串可清除数据库中的 Master Secret",
    )


class ClientPushTestIn(BaseModel):
    tenant_id: int = Field(gt=0, description="租户 ID")
    user_id: int = Field(gt=0, description="用户 ID（与手机登录账号一致）")
    registration_id: str | None = Field(
        default=None,
        description="可选：极光 RegistrationID 或 FCM token，用于绕过 alias/用户 token 列表排查",
    )


class ClientPushTestOut(BaseModel):
    alias: str
    success: bool
    http_status: int
    jpush_message: str
    hint: str | None = None


class HeaderMiniprogramQrOut(BaseModel):
    enabled: bool = False
    file_uuid: str | None = None
    image_url: str | None = None


class HeaderMiniprogramQrUpdateIn(BaseModel):
    enabled: bool = Field(description="是否在顶栏展示小程序码")
    file_uuid: str | None = Field(
        default=None,
        description="小程序码图片文件 UUID；开启时必填；传空字符串可清除",
    )


async def _resolve_miniprogram_qr_image_url(file_uuid: str | None) -> str | None:
    """解析小程序码公开预览 URL；文件不存在或无效时返回 None。"""
    uuid = (file_uuid or "").strip()
    if not uuid:
        return None
    from core.models.file import File as FileModel
    from core.services.file.file_preview_service import FilePreviewService

    file_row = await FileModel.get_or_none(uuid=uuid, category="miniprogram-qr")
    if not file_row:
        return None
    tenant_id = file_row.tenant_id
    if tenant_id is None:
        tenant_id = 1
    try:
        preview_info = await FilePreviewService.get_preview_info(
            file_uuid=uuid,
            tenant_id=tenant_id,
        )
        url = (preview_info or {}).get("preview_url")
        return str(url).strip() if url else None
    except Exception:
        return None


async def _get_header_miniprogram_qr(*, for_tenant: bool) -> HeaderMiniprogramQrOut:
    from infra.models.platform_settings import PlatformSettings

    settings = await PlatformSettings.first()
    if not settings:
        return HeaderMiniprogramQrOut(enabled=False)
    enabled = bool(getattr(settings, "header_miniprogram_qr_enabled", False))
    file_uuid = getattr(settings, "header_miniprogram_qr_uuid", None)
    file_uuid = str(file_uuid).strip() if file_uuid else None
    image_url = await _resolve_miniprogram_qr_image_url(file_uuid) if file_uuid else None
    if for_tenant:
        visible = enabled and bool(image_url)
        return HeaderMiniprogramQrOut(
            enabled=visible,
            file_uuid=file_uuid if visible else None,
            image_url=image_url if visible else None,
        )
    return HeaderMiniprogramQrOut(
        enabled=enabled,
        file_uuid=file_uuid,
        image_url=image_url,
    )


def _origin(request: Request) -> str:
    return svc.resolve_request_public_origin(
        base_url=str(request.base_url).rstrip("/"),
        host=request.headers.get("host"),
        scheme=request.url.scheme,
        port=request.url.port,
    )


@router.get("/products", response_model=list[ClientProductOut], summary="客户端产品列表")
async def list_client_products(
    app_code: Annotated[str | None, Query()] = None,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> list[ClientProductOut]:
    await svc.ensure_default_products()
    rows = await svc.list_products(app_code=app_code)
    return [
        ClientProductOut(
            client_key=r.client_key,
            display_name=r.display_name,
            app_code=r.app_code,
            client_kind=r.client_kind,
            platform_target=r.platform_target,
            supports_ota=r.supports_ota,
            login_tile_slot=r.login_tile_slot,
            sort_order=r.sort_order,
            header_download_enabled=bool(r.header_download_enabled),
        )
        for r in rows
    ]


@router.get(
    "/products/configs",
    response_model=list[ClientProductConfigOut],
    summary="客户端产品配置列表（超管）",
)
async def list_client_product_configs(
    platform: Annotated[str | None, Query(description="按平台筛选，如 android")] = None,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> list[ClientProductConfigOut]:
    rows = await product_cfg_svc.list_client_product_configs(platform=platform)
    return [ClientProductConfigOut.model_validate(r) for r in rows]


@router.get(
    "/products/{client_key}/config",
    response_model=ClientProductConfigOut,
    summary="客户端产品配置（超管）",
)
async def get_client_product_config(
    client_key: str,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> ClientProductConfigOut:
    data = await product_cfg_svc.get_client_product_config(client_key)
    return ClientProductConfigOut.model_validate(data)


@router.put(
    "/products/{client_key}/config",
    response_model=ClientProductConfigOut,
    summary="更新客户端产品配置（超管）",
)
async def update_client_product_config(
    client_key: str,
    body: ClientProductConfigUpdateIn,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> ClientProductConfigOut:
    data = await product_cfg_svc.update_client_product_config(
        client_key,
        push_enabled=body.push_enabled,
        header_download_enabled=body.header_download_enabled,
        jpush_app_key=body.jpush_app_key,
        jpush_master_secret=body.jpush_master_secret,
    )
    return ClientProductConfigOut.model_validate(data)


@router.get(
    "/miniprogram-qr",
    response_model=HeaderMiniprogramQrOut,
    summary="顶栏小程序码配置（超管）",
)
async def get_header_miniprogram_qr_admin(
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> HeaderMiniprogramQrOut:
    return await _get_header_miniprogram_qr(for_tenant=False)


@router.put(
    "/miniprogram-qr",
    response_model=HeaderMiniprogramQrOut,
    summary="更新顶栏小程序码配置（超管）",
)
async def update_header_miniprogram_qr_admin(
    body: HeaderMiniprogramQrUpdateIn,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> HeaderMiniprogramQrOut:
    from core.utils.timezone_utils import now_utc
    from infra.models.platform_settings import PlatformSettings

    settings = await PlatformSettings.first()
    if not settings:
        settings = await PlatformSettings.create(platform_name="RiverEdge SaaS Framework")

    file_uuid: str | None
    if body.file_uuid is None:
        file_uuid = getattr(settings, "header_miniprogram_qr_uuid", None)
        file_uuid = str(file_uuid).strip() if file_uuid else None
    else:
        file_uuid = str(body.file_uuid).strip() or None

    if body.enabled and not file_uuid:
        raise HTTPException(status_code=400, detail="开启顶栏小程序码前请先上传小程序码图片")

    if file_uuid:
        image_url = await _resolve_miniprogram_qr_image_url(file_uuid)
        if not image_url:
            raise HTTPException(status_code=400, detail="小程序码图片无效或不存在，请重新上传")

    settings.header_miniprogram_qr_enabled = bool(body.enabled)
    settings.header_miniprogram_qr_uuid = file_uuid
    settings.updated_at = now_utc()
    await settings.save()
    return await _get_header_miniprogram_qr(for_tenant=False)


async def _ensure_push_configurable_client(client_key: str) -> dict:
    product = await product_cfg_svc.get_client_product_config(client_key)
    if not product.get("push_configurable"):
        raise HTTPException(status_code=400, detail="该客户端不支持极光推送测试")
    return product


@router.get(
    "/products/{client_key}/push-test-users",
    summary="推送测试：列出租户下用户（超管）",
)
async def list_push_test_users(
    client_key: str,
    tenant_id: Annotated[int, Query(gt=0, description="租户 ID")],
    keyword: Annotated[str | None, Query(description="姓名或账号关键词")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    """平台超管选人：不依赖租户内 system:user:read 权限。"""
    from core.schemas.user_display import UserDisplayListResponse
    from core.services.user.user_display_service import UserDisplayService

    await _ensure_push_configurable_client(client_key)
    result = await UserDisplayService.search(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        keyword=keyword,
        is_active=True,
    )
    return UserDisplayListResponse(**result)


@router.post(
    "/products/{client_key}/push-test",
    response_model=ClientPushTestOut,
    summary="发送推送测试（超管，按 PUSH_PROVIDER）",
)
async def send_client_push_test(
    client_key: str,
    body: ClientPushTestIn,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> ClientPushTestOut:
    from core.services.messaging.push_dispatch_service import send_push_test_notification

    await _ensure_push_configurable_client(client_key)
    result = await send_push_test_notification(
        tenant_id=body.tenant_id,
        user_id=body.user_id,
        client_key=client_key,
        registration_id=body.registration_id,
        fcm_token=body.registration_id,
    )
    return ClientPushTestOut.model_validate(result)


@router.get("", response_model=list[ClientReleaseOut], summary="发布记录列表（超管）")
async def list_client_releases(
    request: Request,
    client_key: Annotated[str | None, Query()] = None,
    platform: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> list[ClientReleaseOut]:
    rows = await svc.list_releases(client_key=client_key, platform=platform, limit=limit)
    origin = _origin(request)
    return [ClientReleaseOut.model_validate(svc.serialize_release(r, origin)) for r in rows]


@router.post("", response_model=ClientReleaseOut, summary="注册发布元数据（超管）")
async def create_client_release(
    body: ClientReleaseCreateIn,
    request: Request,
    admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> ClientReleaseOut:
    row = await svc.create_release(
        client_key=body.client_key,
        platform=body.platform,
        app_version=body.app_version,
        version_code=body.version_code,
        runtime_version=body.runtime_version,
        update_type=body.update_type,
        requires_native=body.requires_native,
        force_update=body.force_update,
        min_version_code=body.min_version_code,
        release_notes=body.release_notes,
        bundle_id=body.bundle_id,
        ota_relative_path=body.ota_relative_path,
        created_by=admin.username,
        rollout_percent=body.rollout_percent,
        activate=body.activate,
    )
    return ClientReleaseOut.model_validate(svc.serialize_release(row, _origin(request)))


@router.post("/upload-package", response_model=ClientReleaseOut, summary="上传安装包（超管）")
async def upload_client_package(
    request: Request,
    release_id: Annotated[int, Query(description="发布记录 id")],
    file: UploadFile = File(...),
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> ClientReleaseOut:
    content = await file.read()
    filename = file.filename or f"package-{release_id}"
    row = await svc.register_package_file(release_id, filename, content)
    return ClientReleaseOut.model_validate(svc.serialize_release(row, _origin(request)))


class ClientPackageInspectOut(BaseModel):
    platform: str
    app_version: str
    version_code: int
    package_name: str | None = None
    runtime_version: str | None = None


@router.post("/inspect-package", response_model=ClientPackageInspectOut, summary="解析安装包版本（超管）")
async def inspect_client_package(
    platform: Annotated[str, Query(description="android | ios | windows")],
    file: UploadFile = File(...),
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> ClientPackageInspectOut:
    from core.services.package_metadata_service import inspect_package_bytes

    content = await file.read()
    if len(content) > svc.PACKAGE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="安装包超过大小限制")
    filename = file.filename or "package.bin"
    meta = inspect_package_bytes(content=content, filename=filename, platform=platform)
    return ClientPackageInspectOut(
        platform=meta.platform,
        app_version=meta.app_version,
        version_code=meta.version_code,
        package_name=meta.package_name,
        runtime_version=meta.app_version,
    )


@router.post("/{release_id}/activate", response_model=ClientReleaseOut, summary="激活发布（超管）")
async def activate_client_release(
    release_id: int,
    request: Request,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> ClientReleaseOut:
    row = await svc.activate_release(release_id)
    return ClientReleaseOut.model_validate(svc.serialize_release(row, _origin(request)))


@router.get("/{release_id}", response_model=ClientReleaseOut, summary="发布详情（超管）")
async def get_client_release(
    release_id: int,
    request: Request,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> ClientReleaseOut:
    row = await svc.get_release(release_id)
    return ClientReleaseOut.model_validate(svc.serialize_release(row, _origin(request)))


@router.put("/{release_id}", response_model=ClientReleaseOut, summary="更新发布元数据（超管）")
async def update_client_release(
    release_id: int,
    body: ClientReleaseUpdateIn,
    request: Request,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> ClientReleaseOut:
    row = await svc.update_release(
        release_id,
        release_notes=body.release_notes,
        force_update=body.force_update,
        rollout_percent=body.rollout_percent,
        runtime_version=body.runtime_version,
        min_version_code=body.min_version_code,
    )
    return ClientReleaseOut.model_validate(svc.serialize_release(row, _origin(request)))


@router.delete("/{release_id}", summary="删除历史发布（超管）")
async def delete_client_release(
    release_id: int,
    _admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
) -> dict[str, bool]:
    await svc.delete_release(release_id)
    return {"success": True}


public_router = APIRouter(prefix="/clients", tags=["Platform - Client Releases (Public)"])


@public_router.get("/login-downloads", response_model=LoginClientDownloadsOut, summary="登录页终端下载（公开）")
async def get_login_client_downloads(request: Request) -> LoginClientDownloadsOut:
    service = PlatformSettingsService()
    settings = await service.get_or_create_default_settings()
    origin = _origin(request)
    raw = await svc.resolve_login_downloads(
        origin,
        win_enabled=getattr(settings, "login_client_win_enabled", True),
        android_enabled=getattr(settings, "login_client_android_enabled", True),
    )
    return LoginClientDownloadsOut(
        windows=LoginClientDownloadOut.model_validate(raw["windows"]) if raw.get("windows") else None,
        android_pda=LoginClientDownloadOut.model_validate(raw["android_pda"]) if raw.get("android_pda") else None,
    )


@public_router.get("/{client_key}/release/check", response_model=ClientReleaseCheckOut, summary="客户端版本检查（公开）")
async def check_client_release(
    client_key: str,
    request: Request,
    platform: Annotated[str, Query()] = "android",
    app_version: Annotated[str, Query()] = "0.0.0",
    version_code: Annotated[int, Query(ge=0)] = 0,
    runtime_version: Annotated[str | None, Query()] = None,
    bundle_id: Annotated[str | None, Query()] = None,
    device_id: Annotated[str | None, Query()] = None,
) -> ClientReleaseCheckOut:
    result = await svc.check_release(
        client_key=client_key,
        platform=platform,
        app_version=app_version,
        version_code=version_code,
        runtime_version=runtime_version,
        bundle_id=bundle_id,
        origin=_origin(request),
        device_id=device_id,
    )
    return ClientReleaseCheckOut.model_validate(result)


@public_router.get("/{client_key}/updates/manifest", summary="expo-updates manifest（公开）")
async def get_client_updates_manifest(
    client_key: str,
    request: Request,
    response: Response,
    platform: Annotated[str, Query()] = "android",
    runtime_version: Annotated[str | None, Query(alias="runtime-version")] = None,
) -> Any:
    expo_runtime = runtime_version or request.headers.get("expo-runtime-version") or ""
    active = await svc.get_active_release(client_key, platform)
    if not active or not active.ota_relative_path:
        response.status_code = 204
        return None
    active_rv = active.runtime_version or active.app_version
    if expo_runtime and expo_runtime != active_rv:
        response.status_code = 204
        return None
    manifest = svc.build_expo_updates_manifest(active, _origin(request))
    if not manifest:
        response.status_code = 204
        return None
    response.headers["expo-protocol-version"] = "1"
    response.headers["expo-sfv-version"] = "0"
    response.headers["cache-control"] = "private, max-age=0"
    return manifest


tenant_router = APIRouter(prefix="/client-releases", tags=["Core - Client Releases"])


class TenantClientDownloadOut(BaseModel):
    client_key: str
    display_name: str
    platform: str
    app_version: str
    url: str
    sha256: str | None = None
    size_bytes: int | None = None
    filename: str | None = None
    release_notes: str = ""


class ClientDownloadQrOriginOut(BaseModel):
    origin: str


@tenant_router.get("/qr-origin", response_model=ClientDownloadQrOriginOut, summary="扫码下载站点 origin（LAN/公网）")
async def get_client_download_qr_origin(
    request: Request,
    port: Annotated[int | None, Query(ge=1, le=65535, description="浏览器当前端口")] = None,
    _user: User = Depends(get_current_user),
) -> ClientDownloadQrOriginOut:
    origin = svc.resolve_qr_download_origin(
        request_scheme=request.url.scheme,
        frontend_port=port,
    )
    if not origin:
        raise HTTPException(
            status_code=503,
            detail="无法解析局域网地址，请配置 BASE_URL 或使用局域网 IP 访问 Web",
        )
    return ClientDownloadQrOriginOut(origin=origin)


@tenant_router.get("/downloads", response_model=list[TenantClientDownloadOut], summary="当前租户可下载客户端")
async def get_tenant_client_downloads(
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _user: User = Depends(get_current_user),
) -> list[TenantClientDownloadOut]:
    rows = await svc.resolve_tenant_downloads(tenant_id, _origin(request))
    return [TenantClientDownloadOut.model_validate(r) for r in rows]


@tenant_router.get(
    "/miniprogram-qr",
    response_model=HeaderMiniprogramQrOut,
    summary="当前租户顶栏小程序码",
)
async def get_tenant_header_miniprogram_qr(
    _user: User = Depends(get_current_user),
) -> HeaderMiniprogramQrOut:
    return await _get_header_miniprogram_qr(for_tenant=True)


@tenant_router.get("/by-app/{app_code}", summary="应用关联客户端当前发布（租户只读）")
async def get_active_releases_by_app(
    app_code: str,
    request: Request,
    _user: User = Depends(get_current_user),
) -> list[ClientReleaseOut]:
    await svc.ensure_default_products()
    products = await svc.list_products(app_code=app_code)
    origin = _origin(request)
    out: list[ClientReleaseOut] = []
    for product in products:
        active = await svc.get_active_release(product.client_key, product.platform_target)
        if active:
            out.append(ClientReleaseOut.model_validate(svc.serialize_release(active, origin)))
    return out
