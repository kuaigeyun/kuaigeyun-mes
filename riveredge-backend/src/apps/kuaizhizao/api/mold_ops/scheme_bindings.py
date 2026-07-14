"""
模具方案绑定 API。
"""

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

from apps.kuaizhizao.schemas.mold_ops import (
    MoldSchemeBindingCreate,
    MoldSchemeBindingBulkReplace,
    MoldSchemeBindingResponse,
)
from apps.kuaizhizao.services.mold_ops_service import MoldOpsService

router = APIRouter()
svc = MoldOpsService()


@router.get(
    "/mold-scheme-bindings",
    response_model=List[MoldSchemeBindingResponse],
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-scheme:read"))],
)
async def list_mold_scheme_bindings(
    mold_id: int = Query(..., ge=1),
    scheme_type: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await svc.scheme_binding_service.list_by_mold(tenant_id, mold_id, scheme_type)
    return [MoldSchemeBindingResponse.model_validate(r) for r in rows]


@router.post(
    "/mold-scheme-bindings",
    response_model=MoldSchemeBindingResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-scheme:update"))],
)
async def create_mold_scheme_binding(
    data: MoldSchemeBindingCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scheme_binding_service.create(tenant_id, data, current_user=current_user)
        return MoldSchemeBindingResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.put(
    "/mold-scheme-bindings/bulk-replace",
    response_model=List[MoldSchemeBindingResponse],
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-scheme:update"))],
)
async def bulk_replace_mold_scheme_bindings(
    data: MoldSchemeBindingBulkReplace,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        rows = await svc.scheme_binding_service.bulk_replace(tenant_id, data, current_user=current_user)
        return [MoldSchemeBindingResponse.model_validate(r) for r in rows]
    except (ValidationError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=code, detail=str(e))


@router.delete(
    "/mold-scheme-bindings/{binding_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:mold-maintenance-scheme:update"))],
)
async def delete_mold_scheme_binding(binding_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.scheme_binding_service.delete(tenant_id, binding_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
