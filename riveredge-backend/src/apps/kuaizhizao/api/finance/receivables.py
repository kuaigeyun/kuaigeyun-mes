"""
应收管理 API 路由

提供应收单的 CRUD 操作。

Author: Antigravity
Date: 2026-02-02
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.schemas.finance import (
    ReceivableCreate, ReceivableUpdate, ReceivableResponse, ReceivableListResponse,
    ReceiptRecordCreate
)
from apps.kuaizhizao.services.finance_service import ReceivableService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/receivables", tags=["Kuaige Zhizao Finance"])

receivable_service = ReceivableService()

@router.post("", response_model=ReceivableResponse, status_code=status.HTTP_201_CREATED)
async def create_receivable(
    data: ReceivableCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        receivable = await receivable_service.create_receivable(tenant_id, data, current_user.id)
        return ReceivableResponse.model_validate(receivable)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.get("", response_model=ReceivableListResponse)
async def list_receivables(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1),
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    tenant_id: int = Depends(get_current_tenant)
):
    receivables = await receivable_service.list_receivables(
        tenant_id, skip, limit, status=status, customer_id=customer_id
    )
    return ReceivableListResponse(
        items=receivables,
        total=len(receivables),
        skip=skip,
        limit=limit
    )

@router.get("/{id}", response_model=ReceivableResponse)
async def get_receivable(
    id: int,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        receivable = await receivable_service.get_receivable_by_id(tenant_id, id)
        return receivable
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{id}/receipt", response_model=ReceivableResponse)
async def record_receipt(
    id: int,
    data: ReceiptRecordCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        receivable = await receivable_service.record_receipt(tenant_id, id, data, current_user.id)
        return receivable
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{id}/approve", response_model=ReceivableResponse)
async def approve_receivable(
    id: int,
    rejection_reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        receivable = await receivable_service.approve_receivable(tenant_id, id, current_user.id, rejection_reason)
        return receivable
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
