"""
采购发票 API 路由
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from loguru import logger

from apps.kuaicaiwu.schemas.finance import (
    PurchaseInvoiceCreate, PurchaseInvoiceUpdate, PurchaseInvoiceResponse, PurchaseInvoiceListResponse,
)
from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/purchase-invoices", tags=["App · Kuaicaiwu · Finance"])

invoice_service = PurchaseInvoiceService()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_purchase_invoices_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return HTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


@router.post("", response_model=PurchaseInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_invoice(
    data: PurchaseInvoiceCreate,
    _auth: object = Depends(
        require_access(
            "finance.invoice",
            "create",
            required_permissions=["kuaicaiwu:invoice:create"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        invoice = await invoice_service.create_purchase_invoice(tenant_id, data, current_user.id)
        return PurchaseInvoiceResponse.model_validate(invoice)
    except ValidationError as e:
        raise _http_exception_with_trace(422, str(e), "/purchase-invoices", tenant_id)


@router.get("", response_model=PurchaseInvoiceListResponse)
async def list_purchase_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1),
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    purchase_order_id: Optional[int] = None,
    _auth: object = Depends(
        require_access(
            "finance.invoice",
            "read",
            required_permissions=["kuaicaiwu:invoice:view"],
        )
    ),
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
    _auth: object = Depends(
        require_access(
            "finance.invoice",
            "read",
            required_permissions=["kuaicaiwu:invoice:view"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        invoice = await invoice_service.get_purchase_invoice_by_id(tenant_id, id)
        return invoice
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/purchase-invoices/{id}", tenant_id)


@router.post("/{id}/approve", response_model=PurchaseInvoiceResponse)
async def approve_purchase_invoice(
    id: int,
    rejection_reason: Optional[str] = Query(None),
    _auth: object = Depends(
        require_access(
            "finance.invoice",
            "update",
            required_permissions=["kuaicaiwu:invoice:create"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        invoice = await invoice_service.approve_invoice(tenant_id, id, current_user.id, rejection_reason)
        return invoice
    except BusinessLogicError as e:
        raise _http_exception_with_trace(
            400,
            str(e),
            "/purchase-invoices/{id}/approve",
            tenant_id,
        )
