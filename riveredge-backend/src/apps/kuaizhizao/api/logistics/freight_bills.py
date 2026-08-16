"""运费单 API"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.logistics import (
    FreightBillCreate,
    FreightBillListResponse,
    FreightBillReject,
    FreightBillUpdate,
)
from apps.kuaizhizao.services.freight_bill_service import FreightBillService
from core.api.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

service = FreightBillService()
router = APIRouter(
    prefix="/logistics/freight-bills",
    tags=["App - Kuaige Zhizao - Freight Bill"],
    dependencies=[Depends(require_kuaizhizao_module_access("freight-bill"))],
)


class FreightBillAuditBody(BaseModel):
    review_remarks: Optional[str] = None


@router.get("/pending-freight-orders")
async def list_pending_freight_orders(
    carrier_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_pending_freight_orders(
        tenant_id, carrier_id=carrier_id, keyword=keyword, skip=skip, limit=limit
    )


@router.get("", response_model=FreightBillListResponse)
async def list_freight_bills(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    keyword: Optional[str] = Query(None),
    review_status: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.list_bills(tenant_id, skip=skip, limit=limit, keyword=keyword, review_status=review_status)


@router.get("/{bill_id}")
async def get_freight_bill(bill_id: int = Path(...), tenant_id: int = Depends(get_current_tenant)):
    try:
        return await service.get_bill(tenant_id, bill_id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("")
async def create_freight_bill(
    data: FreightBillCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_bill(tenant_id, data, created_by=current_user.id)
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.put("/{bill_id}")
async def update_freight_bill(
    data: FreightBillUpdate,
    bill_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_bill(tenant_id, bill_id, data, updated_by=current_user.id)
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{bill_id}/submit")
async def submit_freight_bill(
    bill_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.submit_freight_bill(tenant_id, bill_id, submitted_by=current_user.id)
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{bill_id}/audit")
async def audit_freight_bill(
    bill_id: int = Path(...),
    body: FreightBillAuditBody = FreightBillAuditBody(),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.approve_freight_bill(tenant_id, bill_id, approver_id=current_user.id)
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{bill_id}/reject")
async def reject_freight_bill(
    bill_id: int = Path(...),
    body: FreightBillReject = FreightBillReject(),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.reject_freight_bill(
            tenant_id,
            bill_id,
            approver_id=current_user.id,
            rejection_reason=body.rejection_reason,
        )
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))


@router.delete("/{bill_id}")
async def delete_freight_bill(bill_id: int = Path(...), tenant_id: int = Depends(get_current_tenant)):
    try:
        await service.delete_bill(tenant_id, bill_id)
        return {"success": True}
    except (BusinessLogicError, NotFoundError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(e))
