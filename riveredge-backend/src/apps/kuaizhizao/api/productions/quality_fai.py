"""FAI 首件检验 API"""

from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from apps.kuaizhizao.schemas.drawing_balloon_sheet import FaiImportFromBalloonSheetRequest
from apps.kuaizhizao.schemas.quality_fai import (
    FaiFairExportResponse,
    FaiImportFromPlanRequest,
    FaiOrderCreate,
    FaiOrderListResponse,
    FaiOrderResponse,
    FaiOrderUpdate,
)
from apps.kuaizhizao.services.quality_fai_service import FaiOrderService
from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_permission_codes
from infra.models.user import User

router = APIRouter(tags=["App - Kuaige Zhizao - FAI"])

fai_service = FaiOrderService()

_READ = Depends(require_permission_codes("kuaizhizao:quality-management-fai-orders:read"))
_CREATE = Depends(require_permission_codes("kuaizhizao:quality-management-fai-orders:create"))
_UPDATE = Depends(require_permission_codes("kuaizhizao:quality-management-fai-orders:update"))
_DELETE = Depends(require_permission_codes("kuaizhizao:quality-management-fai-orders:delete"))
_SUBMIT = Depends(require_permission_codes("kuaizhizao:quality-management-fai-orders:submit"))
_APPROVE = Depends(require_permission_codes("kuaizhizao:quality-management-fai-orders:approve"))
_REJECT = Depends(require_permission_codes("kuaizhizao:quality-management-fai-orders:reject"))
_EXPORT = Depends(require_permission_codes("kuaizhizao:quality-management-fai-orders:export"))


@router.post("/fai-orders", response_model=FaiOrderResponse, summary="Create FAI order")
async def create_fai_order(
    payload: FaiOrderCreate,
    _auth=_CREATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiOrderResponse:
    return await fai_service.create_order(tenant_id=tenant_id, payload=payload, user=current_user)


@router.get("/fai-orders", response_model=FaiOrderListResponse, summary="List FAI orders")
async def list_fai_orders(
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    work_order_id: Optional[int] = Query(None),
    material_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    _auth=_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiOrderListResponse:
    return await fai_service.list_orders(
        tenant_id=tenant_id,
        keyword=keyword,
        status=status,
        work_order_id=work_order_id,
        material_id=material_id,
        skip=skip,
        limit=limit,
    )


@router.get("/fai-orders/{order_id}", response_model=FaiOrderResponse, summary="Get FAI order")
async def get_fai_order(
    order_id: int,
    _auth=_READ,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiOrderResponse:
    return await fai_service.get_order(tenant_id=tenant_id, order_id=order_id)


@router.put("/fai-orders/{order_id}", response_model=FaiOrderResponse, summary="Update FAI order")
async def update_fai_order(
    order_id: int,
    payload: FaiOrderUpdate,
    _auth=_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiOrderResponse:
    return await fai_service.update_order(
        tenant_id=tenant_id, order_id=order_id, payload=payload, user=current_user
    )


@router.delete("/fai-orders/{order_id}", summary="Delete FAI order")
async def delete_fai_order(
    order_id: int,
    _auth=_DELETE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    await fai_service.delete_order(tenant_id=tenant_id, order_id=order_id, user=current_user)
    return {"success": True}


@router.post("/fai-orders/{order_id}/submit", response_model=FaiOrderResponse, summary="Submit FAI")
async def submit_fai_order(
    order_id: int,
    _auth=_SUBMIT,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiOrderResponse:
    return await fai_service.submit(tenant_id=tenant_id, order_id=order_id, user=current_user)


@router.post("/fai-orders/{order_id}/approve", response_model=FaiOrderResponse, summary="Approve FAI")
async def approve_fai_order(
    order_id: int,
    _auth=_APPROVE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiOrderResponse:
    return await fai_service.approve(tenant_id=tenant_id, order_id=order_id, user=current_user)


@router.post("/fai-orders/{order_id}/reject", response_model=FaiOrderResponse, summary="Reject FAI")
async def reject_fai_order(
    order_id: int,
    remarks: Optional[str] = Body(None, embed=True),
    _auth=_REJECT,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiOrderResponse:
    return await fai_service.reject(
        tenant_id=tenant_id, order_id=order_id, remarks=remarks, user=current_user
    )


@router.post("/fai-orders/{order_id}/close", response_model=FaiOrderResponse, summary="Close FAI")
async def close_fai_order(
    order_id: int,
    _auth=_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiOrderResponse:
    return await fai_service.close(tenant_id=tenant_id, order_id=order_id, user=current_user)


@router.post(
    "/fai-orders/{order_id}/import-from-plan",
    response_model=FaiOrderResponse,
    summary="Import characteristics from inspection plan",
)
async def import_fai_from_plan(
    order_id: int,
    payload: FaiImportFromPlanRequest,
    _auth=_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiOrderResponse:
    return await fai_service.import_from_plan(
        tenant_id=tenant_id, order_id=order_id, payload=payload, user=current_user
    )


@router.get(
    "/fai-orders/{order_id}/fair-export",
    response_model=FaiFairExportResponse,
    summary="Export FAIR Form1/2/3 structure",
)
async def export_fai_fair(
    order_id: int,
    _auth=_EXPORT,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiFairExportResponse:
    return await fai_service.export_fair(tenant_id=tenant_id, order_id=order_id)


@router.post(
    "/fai-orders/{order_id}/import-from-balloon-sheet",
    response_model=FaiOrderResponse,
    summary="Import characteristics from confirmed drawing balloon sheet",
)
async def import_fai_from_balloon_sheet(
    order_id: int,
    payload: FaiImportFromBalloonSheetRequest,
    _auth=_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiOrderResponse:
    return await fai_service.import_from_balloon_sheet(
        tenant_id=tenant_id,
        order_id=order_id,
        sheet_id=payload.sheet_id,
        replace_existing=payload.replace_existing,
        user=current_user,
    )
