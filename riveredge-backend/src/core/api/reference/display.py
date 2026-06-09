"""引用资源展示 API。"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.api.deps.access import AuthContext, get_auth_context
from core.api.deps.deps import get_current_tenant
from core.schemas.reference_display import (
    ReferenceDisplayListResponse,
    ReferenceDisplayResolveRequest,
    ReferenceDisplayResolveResponse,
)
from core.services.reference.reference_display_service import ReferenceDisplayService
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="/reference", tags=["引用资源展示"])


@router.get("/display-search", response_model=ReferenceDisplayListResponse)
async def search_reference_display(
    resource: str = Query(..., description="全局 resource_key"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    host_resource: Optional[str] = Query(None, description="宿主 {app}:{module}"),
    group_id: Optional[int] = Query(None),
    source_type: Optional[str] = Query(None),
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    result = await ReferenceDisplayService.search(
        tenant_id=tenant_id,
        user=current_user,
        resource_key=resource,
        page=page,
        page_size=page_size,
        keyword=keyword,
        is_active=is_active,
        host_resource=host_resource,
        extra={"group_id": group_id, "source_type": source_type},
        is_infra_admin=auth.is_infra_admin,
        is_tenant_admin=auth.is_tenant_admin,
    )
    return ReferenceDisplayListResponse(**result)


@router.post("/display-resolve", response_model=ReferenceDisplayResolveResponse)
async def resolve_reference_display(
    body: ReferenceDisplayResolveRequest,
    auth: AuthContext = Depends(get_auth_context),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    items = await ReferenceDisplayService.resolve(
        tenant_id=tenant_id,
        user=current_user,
        resource_key=body.resource,
        record_ids=body.record_ids,
        record_uuids=body.record_uuids,
        host_resource=body.host_resource,
        is_infra_admin=auth.is_infra_admin,
        is_tenant_admin=auth.is_tenant_admin,
    )
    return ReferenceDisplayResolveResponse(items=items)
