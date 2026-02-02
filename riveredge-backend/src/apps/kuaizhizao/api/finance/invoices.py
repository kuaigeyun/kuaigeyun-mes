"""
发票管理 API 路由

提供发票的 CRUD 操作。

Author: Antigravity
Date: 2026-02-02
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.schemas.invoice import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoiceListResponse
)
from apps.kuaizhizao.services.invoice_service import InvoiceService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/invoices", tags=["Kuaige Zhizao Finance"])

invoice_service = InvoiceService()

@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    data: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        invoice = await invoice_service.create_invoice(tenant_id, data, current_user.id)
        return InvoiceResponse.model_validate(invoice)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    tenant_id: int = Depends(get_current_tenant)
):
    items, total = await invoice_service.list_invoices(
        tenant_id, skip, limit, category, status, search
    )
    return InvoiceListResponse(
        items=[InvoiceResponse.model_validate(i) for i in items],
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{code}", response_model=InvoiceResponse)
async def get_invoice(
    code: str,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        invoice = await invoice_service.get_invoice_by_uuid(tenant_id, code)
        return InvoiceResponse.model_validate(invoice)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{code}", response_model=InvoiceResponse)
async def update_invoice(
    code: str,
    data: InvoiceUpdate,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        invoice = await invoice_service.update_invoice(tenant_id, code, data)
        return InvoiceResponse.model_validate(invoice)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    code: str,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        await invoice_service.delete_invoice(tenant_id, code)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
