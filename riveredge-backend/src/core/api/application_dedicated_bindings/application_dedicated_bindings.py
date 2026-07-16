"""
定制应用 ↔ 组织绑定（Core）

供已在租户上下文登录的「平台管理员」（is_infra_admin）维护绑定关系。
Infra 超级管理员仍可使用 /api/v1/infra/application-dedicated-bindings。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.api.deps.access import AuthContext, get_auth_context
from core.services.application.application_dedicated_binding_service import ApplicationDedicatedBindingService
from infra.exceptions.exceptions import ValidationError
from infra.services.tenant_service import TenantService

router = APIRouter(prefix="/application-dedicated-bindings", tags=["Core - Dedicated app bindings"])


class DedicatedBindingRow(BaseModel):
    id: int
    app_code: str
    tenant_id: int
    tenant_name: Optional[str] = None
    created_at: Any


class BindDedicatedBody(BaseModel):
    app_code: str = Field(..., min_length=1, max_length=50)
    tenant_id: int = Field(..., ge=1)


class TenantSearchItem(BaseModel):
    id: int
    name: str
    domain: Optional[str] = None


class TenantSearchForBindingResponse(BaseModel):
    items: List[TenantSearchItem]
    total: int
    page: int
    page_size: int


def _require_platform_admin_for_bindings(auth: AuthContext) -> None:
    if not auth.is_infra_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅平台管理员可维护定制应用的组织绑定。",
        )


@router.get("", response_model=List[DedicatedBindingRow])
async def list_bindings_core(
    app_code: Optional[str] = Query(None, description="按应用代码筛选"),
    auth: AuthContext = Depends(get_auth_context),
):
    _require_platform_admin_for_bindings(auth)
    rows = await ApplicationDedicatedBindingService.list_bindings(app_code=app_code)
    return [DedicatedBindingRow(**r) for r in rows]


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def bind_dedicated_core(
    body: BindDedicatedBody,
    auth: AuthContext = Depends(get_auth_context),
):
    _require_platform_admin_for_bindings(auth)
    try:
        await ApplicationDedicatedBindingService.bind(body.app_code.strip(), body.tenant_id)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def unbind_dedicated_core(
    app_code: str = Query(..., min_length=1),
    tenant_id: int = Query(..., ge=1),
    auth: AuthContext = Depends(get_auth_context),
):
    _require_platform_admin_for_bindings(auth)
    await ApplicationDedicatedBindingService.unbind(app_code.strip(), tenant_id)


@router.get("/tenant-search", response_model=TenantSearchForBindingResponse)
async def tenant_search_for_binding(
    name: Optional[str] = Query(None, description="组织名称模糊搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    auth: AuthContext = Depends(get_auth_context),
):
    """供绑定弹窗下拉搜索组织（平台管理员）。"""
    _require_platform_admin_for_bindings(auth)
    svc = TenantService()
    result = await svc.list_tenants(
        page=page,
        page_size=page_size,
        name=name.strip() if name else None,
        skip_tenant_filter=True,
    )
    items_raw = result.get("items") or []
    items: List[TenantSearchItem] = []
    for t in items_raw:
        items.append(
            TenantSearchItem(
                id=int(t.id),
                name=str(t.name or ""),
                domain=str(t.domain) if getattr(t, "domain", None) else None,
            )
        )
    return TenantSearchForBindingResponse(
        items=items,
        total=int(result.get("total") or 0),
        page=int(result.get("page") or page),
        page_size=int(result.get("page_size") or page_size),
    )
