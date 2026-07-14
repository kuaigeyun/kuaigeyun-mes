"""
工装方案绑定 API。
"""

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

from apps.kuaizhizao.schemas.tool_ops import (
    ToolSchemeBindingCreate,
    ToolSchemeBindingBulkReplace,
    ToolSchemeBindingResponse,
)
from apps.kuaizhizao.services.tool_ops_service import ToolOpsService

router = APIRouter()
svc = ToolOpsService()


@router.get(
    "/tool-scheme-bindings",
    response_model=List[ToolSchemeBindingResponse],
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-scheme:read"))],
)
async def list_tool_scheme_bindings(
    tool_id: int = Query(..., ge=1),
    scheme_type: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await svc.scheme_binding_service.list_by_tool(tenant_id, tool_id, scheme_type)
    return [ToolSchemeBindingResponse.model_validate(r) for r in rows]


@router.post(
    "/tool-scheme-bindings",
    response_model=ToolSchemeBindingResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-scheme:update"))],
)
async def create_tool_scheme_binding(
    data: ToolSchemeBindingCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scheme_binding_service.create(tenant_id, data, current_user=current_user)
        return ToolSchemeBindingResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.put(
    "/tool-scheme-bindings/bulk-replace",
    response_model=List[ToolSchemeBindingResponse],
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-scheme:update"))],
)
async def bulk_replace_tool_scheme_bindings(
    data: ToolSchemeBindingBulkReplace,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        rows = await svc.scheme_binding_service.bulk_replace(tenant_id, data, current_user=current_user)
        return [ToolSchemeBindingResponse.model_validate(r) for r in rows]
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.delete(
    "/tool-scheme-bindings/{binding_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:tool-maintenance-scheme:update"))],
)
async def delete_tool_scheme_binding(binding_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.scheme_binding_service.delete(tenant_id, binding_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
