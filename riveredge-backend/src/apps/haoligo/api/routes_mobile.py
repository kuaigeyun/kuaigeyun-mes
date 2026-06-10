"""好力 GO — 移动端聚合 API（启动角标、版本检查等）。"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, Field

from apps.haoligo.api._qs import tenant_alive
from tortoise.expressions import Q

from apps.haoligo.models.mold_maintenance_complete_sheet import HaoligoMoldMaintenanceCompleteSheet
from apps.haoligo.models.mold_maintenance_sheet import HaoligoMoldMaintenanceSheet
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from apps.haoligo.constants.mold_sheet_audit import SHEET_STATUS_APPROVED
from core.config.client_product_registry import CLIENT_KEY_HAOLIGO
from core.services import client_release_service as release_svc
from apps.haoligo.services.mobile_workbench import resolve_mobile_workbench
from apps.haoligo.services.trial_sheet_side_effects import count_pending_trial_failure_exceptions
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/mobile",
    tags=["App · HaoliGO · 移动端"],
)


class MobileBootstrapOut(BaseModel):
    pending_audit_count: int = Field(description="当前用户外协完修单待审核数量")
    trial_failed_count: int = Field(description="待处理试模/试产不合格单数量（角标参考，不含已确认收回）")
    maintenance_open_for_complete_count: int = Field(
        description="厂内维修+保养维保单待完修数量（已通过且尚无关联完修单）"
    )


class MobileWorkbenchEntryOut(BaseModel):
    key: str
    label: str
    route: str
    icon: str
    icon_group: str | None = None
    solo_row: bool = False


class MobileWorkbenchSectionOut(BaseModel):
    key: str
    title: str
    entries: list[MobileWorkbenchEntryOut]


class MobileReleaseApkOut(BaseModel):
    url: str
    sha256: str | None = None
    size_bytes: int | None = None


class MobileReleaseLatestOut(BaseModel):
    app_version: str
    version_code: int
    runtime_version: str
    release_notes: str = ""
    bundle_id: str | None = None
    apk: MobileReleaseApkOut | None = None


class MobileReleaseOtaOut(BaseModel):
    updates_url: str


class MobileReleaseCheckOut(BaseModel):
    update_type: str = Field(description="none | ota | apk")
    force: bool = False
    latest: MobileReleaseLatestOut | None = None
    ota: MobileReleaseOtaOut | None = None


@router.get("/release/check", response_model=MobileReleaseCheckOut, summary="移动端版本检查（公开）")
async def check_mobile_release(
    request: Request,
    platform: Annotated[str, Query(description="android | ios")] = "android",
    app_version: Annotated[str, Query(description="客户端 semver")] = "0.0.0",
    version_code: Annotated[int, Query(ge=0, description="Android versionCode")] = 0,
    runtime_version: Annotated[str, Query(description="expo runtimeVersion")] = "0.0.0",
    bundle_id: Annotated[str | None, Query(description="当前 OTA bundle_id")] = None,
    device_id: Annotated[str | None, Query(description="设备稳定标识，用于灰度")] = None,
) -> MobileReleaseCheckOut:
    origin = release_svc.resolve_request_public_origin(
        base_url=str(request.base_url).rstrip("/"),
        host=request.headers.get("host"),
        scheme=request.url.scheme,
        port=request.url.port,
    )
    result = await release_svc.check_release(
        client_key=CLIENT_KEY_HAOLIGO,
        platform=platform,
        app_version=app_version,
        version_code=version_code,
        runtime_version=runtime_version,
        bundle_id=bundle_id,
        origin=origin,
        device_id=device_id,
    )
    if result.get("update_type") == "package":
        result["update_type"] = "apk"
    return MobileReleaseCheckOut.model_validate(result)


@router.get("/updates/manifest", summary="expo-updates 自建 manifest（公开）")
async def get_mobile_updates_manifest(
    request: Request,
    response: Response,
    platform: Annotated[str, Query()] = "android",
    runtime_version: Annotated[str | None, Query(alias="runtime-version")] = None,
) -> Any:
    """返回 expo-updates 可消费的 JSON manifest；assets 指向 /static/mobile-updates/。"""
    expo_runtime = runtime_version or request.headers.get("expo-runtime-version") or ""
    active = await release_svc.get_active_release(CLIENT_KEY_HAOLIGO, platform)
    if not active or not active.ota_relative_path:
        response.status_code = 204
        return None

    if expo_runtime and expo_runtime != active.runtime_version:
        response.status_code = 204
        return None

    origin = release_svc.resolve_request_public_origin(
        base_url=str(request.base_url).rstrip("/"),
        host=request.headers.get("host"),
        scheme=request.url.scheme,
        port=request.url.port,
    )
    manifest = release_svc.build_expo_updates_manifest(active, origin)
    if not manifest:
        response.status_code = 204
        return None

    response.headers["expo-protocol-version"] = "1"
    response.headers["expo-sfv-version"] = "0"
    response.headers["cache-control"] = "private, max-age=0"
    return manifest


@router.get("/bootstrap", response_model=MobileBootstrapOut, summary="移动端启动聚合")
async def get_mobile_bootstrap(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
) -> MobileBootstrapOut:
    pending_audit_count = await (
        tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id)
        .filter(applicant_user_id=user.id, sheet_status="待审核")
        .count()
    )

    trial_failed_count = await count_pending_trial_failure_exceptions(tenant_id)

    linked_complete_ids = [
        int(x)
        for x in await tenant_alive(HaoligoMoldMaintenanceCompleteSheet, tenant_id)
        .filter(deleted_at__isnull=True, source_maintenance_sheet_id__not_isnull=True)
        .values_list("source_maintenance_sheet_id", flat=True)
        if x is not None
    ]
    maint_open_qs = tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id).filter(
        sheet_status=SHEET_STATUS_APPROVED,
        service_type__in=["维修", "保养"],
    )
    if linked_complete_ids:
        maint_open_qs = maint_open_qs.filter(~Q(id__in=linked_complete_ids))
    maintenance_open_for_complete_count = await maint_open_qs.count()

    return MobileBootstrapOut(
        pending_audit_count=pending_audit_count,
        trial_failed_count=trial_failed_count,
        maintenance_open_for_complete_count=maintenance_open_for_complete_count,
    )


@router.get("/workbench", response_model=list[MobileWorkbenchSectionOut], summary="移动端工作台导航")
async def get_mobile_workbench(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    scope: Annotated[str, Query(description="home | approval | mold_menu")] = "home",
) -> list[MobileWorkbenchSectionOut]:
    sections: list[dict[str, Any]] = await resolve_mobile_workbench(
        tenant_id=tenant_id,
        user=user,
        scope=scope,
    )
    return [MobileWorkbenchSectionOut.model_validate(s) for s in sections]
