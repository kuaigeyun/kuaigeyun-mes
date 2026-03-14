"""
应付管理 API 路由
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaicaiwu.schemas.finance import (
    PayableCreate, PayableUpdate, PayableResponse, PayableListResponse,
    PaymentRecordCreate
)
from apps.kuaicaiwu.services.finance_service import PayableService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/payables", tags=["Kuaicaiwu Finance"])

payable_service = PayableService()


@router.post("", response_model=PayableResponse, status_code=status.HTTP_201_CREATED)
async def create_payable(
    data: PayableCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        payable = await payable_service.create_payable(tenant_id, data, current_user.id)
        return PayableResponse.model_validate(payable)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("", response_model=PayableListResponse)
async def list_payables(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1),
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    tenant_id: int = Depends(get_current_tenant)
):
    payables = await payable_service.list_payables(
        tenant_id, skip, limit, status=status, supplier_id=supplier_id
    )
    return PayableListResponse(
        items=payables,
        total=len(payables),
        skip=skip,
        limit=limit
    )


@router.get("/{id}", response_model=PayableResponse)
async def get_payable(
    id: int,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        payable = await payable_service.get_payable_by_id(tenant_id, id)
        return payable
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{id}/payment", response_model=PayableResponse)
async def record_payment(
    id: int,
    data: PaymentRecordCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        payable = await payable_service.record_payment(tenant_id, id, data, current_user.id)
        return payable
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{id}/approve", response_model=PayableResponse)
async def approve_payable(
    id: int,
    rejection_reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        payable = await payable_service.approve_payable(tenant_id, id, current_user.id, rejection_reason)
        return payable
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payable(
    id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        await payable_service.delete_payable(tenant_id, id)
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
