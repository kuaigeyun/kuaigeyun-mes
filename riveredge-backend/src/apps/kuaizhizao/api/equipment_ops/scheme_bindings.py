"""
设备方案绑定 API。
"""

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

from apps.kuaizhizao.schemas.equipment_ops import (
    SchemeBindingCreate,
    SchemeBindingBulkReplace,
    SchemeBindingResponse,
)
from apps.kuaizhizao.services.equipment_ops_service import EquipmentOpsService

router = APIRouter()
svc = EquipmentOpsService()


@router.get("/equipment-scheme-bindings", response_model=List[SchemeBindingResponse])
async def list_scheme_bindings(
    equipment_id: int = Query(..., ge=1),
    scheme_type: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await svc.scheme_binding_service.list_by_equipment(tenant_id, equipment_id, scheme_type)
    return [SchemeBindingResponse.model_validate(r) for r in rows]


@router.post(
    "/equipment-scheme-bindings",
    response_model=SchemeBindingResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-inspection-scheme:update"))],
)
async def create_scheme_binding(
    data: SchemeBindingCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await svc.scheme_binding_service.create(tenant_id, data)
        return SchemeBindingResponse.model_validate(row)
    except (ValidationError, NotFoundError) as e:
        status_code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=status_code, detail=str(e))


@router.put(
    "/equipment-scheme-bindings/bulk-replace",
    response_model=List[SchemeBindingResponse],
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-inspection-scheme:update"))],
)
async def bulk_replace_scheme_bindings(
    data: SchemeBindingBulkReplace,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        rows = await svc.scheme_binding_service.bulk_replace(tenant_id, data)
        return [SchemeBindingResponse.model_validate(r) for r in rows]
    except (ValidationError, NotFoundError) as e:
        status_code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_422_UNPROCESSABLE_ENTITY
        raise HTTPException(status_code=status_code, detail=str(e))


@router.delete(
    "/equipment-scheme-bindings/{binding_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaizhizao:equipment-inspection-scheme:update"))],
)
async def delete_scheme_binding(binding_id: int, tenant_id: int = Depends(get_current_tenant)):
    try:
        await svc.scheme_binding_service.delete(tenant_id, binding_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
