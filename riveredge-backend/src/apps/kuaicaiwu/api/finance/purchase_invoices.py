"""
采购发票 API 路由
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaicaiwu.schemas.finance import (
    PurchaseInvoiceCreate, PurchaseInvoiceUpdate, PurchaseInvoiceResponse, PurchaseInvoiceListResponse,
)
from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/purchase-invoices", tags=["Kuaicaiwu Finance"])

invoice_service = PurchaseInvoiceService()


@router.post("", response_model=PurchaseInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_invoice(
    data: PurchaseInvoiceCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        invoice = await invoice_service.create_purchase_invoice(tenant_id, data, current_user.id)
        return PurchaseInvoiceResponse.model_validate(invoice)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("", response_model=PurchaseInvoiceListResponse)
async def list_purchase_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1),
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    purchase_order_id: Optional[int] = None,
    tenant_id: int = Depends(get_current_tenant)
):
    invoices = await invoice_service.list_purchase_invoices(
        tenant_id, skip, limit,
        status=status, supplier_id=supplier_id, purchase_order_id=purchase_order_id
    )
    return PurchaseInvoiceListResponse(
        items=invoices,
        total=len(invoices),
        skip=skip,
        limit=limit
    )


@router.get("/{id}", response_model=PurchaseInvoiceResponse)
async def get_purchase_invoice(
    id: int,
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        invoice = await invoice_service.get_purchase_invoice_by_id(tenant_id, id)
        return invoice
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{id}/approve", response_model=PurchaseInvoiceResponse)
async def approve_purchase_invoice(
    id: int,
    rejection_reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        invoice = await invoice_service.approve_invoice(tenant_id, id, current_user.id, rejection_reason)
        return invoice
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))
