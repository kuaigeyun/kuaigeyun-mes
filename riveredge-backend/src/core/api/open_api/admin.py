"""开放 API 账套 / 应用管理（租户管理员）。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.services.open_api.open_api_admin_service import OpenApiAdminService
from infra.config.infra_config import infra_settings

router = APIRouter(prefix="/open-api", tags=["Core - Open API"])


class RotateAcctIdBody(BaseModel):
    acct_id: Optional[str] = Field(None, description="自定义账套 ID；空则自动生成")


class CreateOpenApiAppBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    module_keys: list[str] = Field(default_factory=list)
    permission_codes: list[str] = Field(default_factory=list)
    ip_allowlist: Optional[str] = None
    expires_at: Optional[datetime] = None


class UpdateOpenApiAppBody(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    ip_allowlist: Optional[str] = None
    expires_at: Optional[datetime] = None
    clear_expires: bool = False
    module_keys: Optional[list[str]] = None
    permission_codes: Optional[list[str]] = None
    update_grants: bool = False


@router.get(
    "/account",
    dependencies=[Depends(require_permission_codes("system:open-api:read"))],
)
async def get_account(tenant_id: int = Depends(get_current_tenant)):
    account = await OpenApiAdminService.get_or_create_account(tenant_id)
    return OpenApiAdminService.serialize_account(account)


@router.post(
    "/account/rotate-acct-id",
    dependencies=[Depends(require_permission_codes("system:open-api:manage"))],
)
async def rotate_acct_id(
    body: RotateAcctIdBody,
    tenant_id: int = Depends(get_current_tenant),
):
    account = await OpenApiAdminService.rotate_acct_id(tenant_id, body.acct_id)
    return OpenApiAdminService.serialize_account(account)


@router.get(
    "/module-catalog",
    dependencies=[Depends(require_permission_codes("system:open-api:read"))],
)
async def module_catalog(tenant_id: int = Depends(get_current_tenant)):
    _ = tenant_id
    return {"items": OpenApiAdminService.module_catalog()}


@router.get(
    "/apps",
    dependencies=[Depends(require_permission_codes("system:open-api:read"))],
)
async def list_apps(tenant_id: int = Depends(get_current_tenant)):
    return {"items": await OpenApiAdminService.list_apps(tenant_id)}


@router.post(
    "/apps",
    dependencies=[Depends(require_permission_codes("system:open-api:manage"))],
)
async def create_app(
    body: CreateOpenApiAppBody,
    tenant_id: int = Depends(get_current_tenant),
):
    return await OpenApiAdminService.create_app(
        tenant_id,
        name=body.name,
        module_keys=body.module_keys,
        permission_codes=body.permission_codes,
        ip_allowlist=body.ip_allowlist,
        expires_at=body.expires_at,
    )


@router.get(
    "/apps/{app_uuid}",
    dependencies=[Depends(require_permission_codes("system:open-api:read"))],
)
async def get_app(app_uuid: str, tenant_id: int = Depends(get_current_tenant)):
    return await OpenApiAdminService.get_app(tenant_id, app_uuid)


@router.put(
    "/apps/{app_uuid}",
    dependencies=[Depends(require_permission_codes("system:open-api:manage"))],
)
async def update_app(
    app_uuid: str,
    body: UpdateOpenApiAppBody,
    tenant_id: int = Depends(get_current_tenant),
):
    return await OpenApiAdminService.update_app(
        tenant_id,
        app_uuid,
        name=body.name,
        status=body.status,
        ip_allowlist=body.ip_allowlist,
        expires_at=body.expires_at,
        clear_expires=body.clear_expires,
        module_keys=body.module_keys,
        permission_codes=body.permission_codes,
        update_grants=body.update_grants
        or body.module_keys is not None
        or body.permission_codes is not None,
    )


@router.post(
    "/apps/{app_uuid}/reset-secret",
    dependencies=[Depends(require_permission_codes("system:open-api:manage"))],
)
async def reset_secret(app_uuid: str, tenant_id: int = Depends(get_current_tenant)):
    return await OpenApiAdminService.reset_secret(tenant_id, app_uuid)


@router.delete(
    "/apps/{app_uuid}",
    dependencies=[Depends(require_permission_codes("system:open-api:manage"))],
)
async def delete_app(app_uuid: str, tenant_id: int = Depends(get_current_tenant)):
    await OpenApiAdminService.delete_app(tenant_id, app_uuid)
    return {"ok": True}


@router.get(
    "/integration-guide",
    dependencies=[Depends(require_permission_codes("system:open-api:read"))],
)
async def integration_guide(
    tenant_id: int = Depends(get_current_tenant),
    base_url: str | None = Query(
        None,
        description="示例中的 API 根地址，如 https://api.example.com",
    ),
):
    account = await OpenApiAdminService.get_or_create_account(tenant_id)
    host = (base_url or "").strip()
    if not host:
        # BASE_URL 为空时用占位；管理页可用 ?base_url= 覆盖为当前站点
        host = (infra_settings.BASE_URL or "").strip() or "https://your-host.example"
    return OpenApiAdminService.integration_docs(
        acct_id=account.acct_id,
        tenant_id=tenant_id,
        base_url=host.rstrip("/"),
    )
