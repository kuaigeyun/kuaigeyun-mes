"""
采购发票 API 路由
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from loguru import logger

from apps.kuaicaiwu.schemas.finance import (
    PurchaseInvoiceCreate, PurchaseInvoiceUpdate, PurchaseInvoiceResponse, PurchaseInvoiceListResponse,
)
from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService
from apps.kuaicaiwu.services.purchase_invoice_pull_service import PurchaseInvoicePullService
from apps.kuaicaiwu.models.payable import Payable
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

router = APIRouter(prefix="/purchase-invoices", tags=["App - Kuaicaiwu - Finance"])

invoice_service = PurchaseInvoiceService()
purchase_invoice_pull_service = PurchaseInvoicePullService()


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
    _auth: object = Depends(require_permission_codes("kuaicaiwu:purchase-invoice:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        pull_preview: Optional[Dict[str, Any]] = None
        if data.source_type and data.source_id:
            pull_preview = await purchase_invoice_pull_service.assert_pull_create_allowed(
                tenant_id=tenant_id,
                source_type=str(data.source_type).strip(),
                source_id=int(data.source_id),
                total_amount=Decimal(data.total_amount),
            )
            if pull_preview:
                po_id = pull_preview.get("purchase_order_id")
                po_code = pull_preview.get("purchase_order_code")
                if po_id and not data.purchase_order_id:
                    data = data.model_copy(
                        update={
                            "purchase_order_id": int(po_id),
                            "purchase_order_code": str(po_code or data.purchase_order_code or ""),
                            "supplier_id": int(pull_preview.get("supplier_id") or data.supplier_id),
                            "supplier_name": str(
                                pull_preview.get("supplier_name") or data.supplier_name or ""
                            ),
                        }
                    )
                if str(data.source_type or "").strip() == "payable":
                    payable_id = pull_preview.get("payable_id")
                    payable_code = pull_preview.get("payable_code")
                    if payable_id:
                        data = data.model_copy(
                            update={
                                "payable_id": int(payable_id),
                                "payable_code": str(payable_code or data.payable_code or ""),
                                "supplier_id": int(pull_preview.get("supplier_id") or data.supplier_id),
                                "supplier_name": str(
                                    pull_preview.get("supplier_name") or data.supplier_name or ""
                                ),
                            }
                        )

        invoice = await invoice_service.create_purchase_invoice(
            tenant_id,
            data,
            current_user.id,
            skip_legacy_amount_gate=bool(pull_preview),
        )
        if pull_preview and data.source_type and data.source_id:
            await purchase_invoice_pull_service.create_pull_relation(
                tenant_id=tenant_id,
                source_type=str(data.source_type).strip(),
                source_id=int(data.source_id),
                source_code=str(pull_preview.get("source_code") or ""),
                invoice_id=int(invoice.id),
                invoice_code=str(invoice.invoice_code),
                created_by=current_user.id,
            )
        if pull_preview and str(data.source_type or "").strip() == "payable" and data.payable_id:
            payable_update: dict = {
                "invoice_received": True,
                "updated_by": current_user.id,
            }
            if data.invoice_number:
                payable_update["invoice_number"] = data.invoice_number
            await Payable.filter(tenant_id=tenant_id, id=int(data.payable_id)).update(**payable_update)
        return invoice
    except ValidationError as e:
        raise _http_exception_with_trace(422, str(e), "/purchase-invoices", tenant_id) from e
    except BusinessLogicError as e:
        raise _http_exception_with_trace(422, str(e), "/purchase-invoices", tenant_id) from e


@router.get("", response_model=PurchaseInvoiceListResponse)
async def list_purchase_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1),
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    purchase_order_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    keyword: Optional[str] = Query(None),
    invoice_code: Optional[str] = Query(None),
    supplier_name: Optional[str] = Query(None),
    invoice_number: Optional[str] = Query(None),
    review_status: Optional[str] = None,
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:purchase-invoice:read")),
    tenant_id: int = Depends(get_current_tenant)
):
    doc_date_start = start_date.isoformat() if start_date else None
    doc_date_end = end_date.isoformat() if end_date else None
    invoices, total = await invoice_service.list_purchase_invoices(
        tenant_id,
        skip,
        limit,
        status=status,
        supplier_id=supplier_id,
        purchase_order_id=purchase_order_id,
        keyword=keyword,
        invoice_code=invoice_code,
        supplier_name=supplier_name,
        invoice_number=invoice_number,
        review_status=review_status,
        start_date=doc_date_start,
        end_date=doc_date_end,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
        sort_field=sort_field,
        sort_order=sort_order,
    )
    return PurchaseInvoiceListResponse(
        items=invoices,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get(
    "/pull-candidates/purchase-orders",
    summary="List purchase order pull candidates for purchase invoice",
)
async def list_purchase_invoice_purchase_order_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:purchase-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await purchase_invoice_pull_service.list_purchase_order_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/pull-candidates/purchase-receipts",
    summary="List purchase receipt pull candidates for purchase invoice",
)
async def list_purchase_invoice_purchase_receipt_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:purchase-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await purchase_invoice_pull_service.list_purchase_receipt_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/from-purchase-order/{order_id}/pull-preview",
    summary="Preview pull purchase invoice from purchase order",
)
async def preview_pull_purchase_invoice_from_purchase_order(
    order_id: int = Path(..., description="采购订单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:purchase-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await purchase_invoice_pull_service.preview_pull_from_purchase_order(
        tenant_id=tenant_id,
        order_id=order_id,
    )


@router.get(
    "/from-purchase-receipt/{receipt_id}/pull-preview",
    summary="Preview pull purchase invoice from purchase receipt",
)
async def preview_pull_purchase_invoice_from_purchase_receipt(
    receipt_id: int = Path(..., description="采购入库单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:purchase-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await purchase_invoice_pull_service.preview_pull_from_purchase_receipt(
        tenant_id=tenant_id,
        receipt_id=receipt_id,
    )


@router.get(
    "/pull-candidates/payables",
    summary="List payable pull candidates for purchase invoice",
)
async def list_purchase_invoice_payable_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:purchase-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await purchase_invoice_pull_service.list_payable_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/from-payable/{payable_id}/pull-preview",
    summary="Preview pull purchase invoice from payable",
)
async def preview_pull_purchase_invoice_from_payable(
    payable_id: int = Path(..., description="应付单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:purchase-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await purchase_invoice_pull_service.preview_pull_from_payable(
        tenant_id=tenant_id,
        payable_id=payable_id,
    )


@router.get("/{id}", response_model=PurchaseInvoiceResponse)
async def get_purchase_invoice(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:purchase-invoice:read")),
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
    _auth: object = Depends(require_permission_codes("kuaicaiwu:purchase-invoice:audit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
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
