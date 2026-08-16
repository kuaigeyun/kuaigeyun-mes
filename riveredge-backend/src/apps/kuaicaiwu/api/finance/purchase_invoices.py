"""
采购发票 API 路由
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Request
from loguru import logger

from tortoise.transactions import in_transaction

from apps.kuaicaiwu.schemas.finance import (
    PurchaseInvoiceCreate, PurchaseInvoiceUpdate, PurchaseInvoiceResponse, PurchaseInvoiceListResponse,
)
from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService
from apps.kuaicaiwu.services.finance_tax import compute_tax_from_excluding
from apps.kuaicaiwu.services.invoice_concurrent_settlement import (
    create_concurrent_payment_for_payable,
)
from apps.kuaicaiwu.services.purchase_invoice_pull_service import PurchaseInvoicePullService
from apps.kuaicaiwu.services.finance_audit_workflow import submit_finance_review
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
from core.api.deps.access import AuthContext, ensure_permission_codes, require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.utils.timezone_utils import today_site_str
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
    request: Request,
    auth: AuthContext = Depends(require_permission_codes("kuaicaiwu:purchase-invoice:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    try:
        # 价税合计由服务端按未税×税率计算；拉单门禁不得依赖可选入参 total_amount。
        _, _, total_for_gate = compute_tax_from_excluding(
            Decimal(str(data.invoice_amount)),
            Decimal(str(data.tax_rate)),
        )
        concurrent = data.concurrent_settlement
        want_payment = bool(concurrent and concurrent.enabled)
        settle_amount = Decimal("0")
        if want_payment:
            if str(data.source_type or "").strip() != "payable" or not data.source_id:
                raise BusinessLogicError("仅从应付单开票时可同时付款")
            await ensure_permission_codes(
                auth, tenant_id, request, ["kuaicaiwu:payment:create"]
            )
            if not concurrent.payment_method or concurrent.voucher_date is None:
                raise BusinessLogicError("同时付款须填写付款方式与付款日期")
            settle_amount = Decimal(str(concurrent.total_amount or total_for_gate))
            if settle_amount <= 0:
                raise BusinessLogicError("同时付款金额须大于 0")

        pull_preview: Optional[Dict[str, Any]] = None
        if data.source_type and data.source_id:
            pull_preview = await purchase_invoice_pull_service.assert_pull_create_allowed(
                tenant_id=tenant_id,
                source_type=str(data.source_type).strip(),
                source_id=int(data.source_id),
                total_amount=total_for_gate,
            )
            if pull_preview:
                po_id = pull_preview.get("purchase_order_id")
                po_code = pull_preview.get("purchase_order_code")
                if po_id and not data.purchase_order_id:
                    data = data.model_copy(
                        update={
                            "purchase_order_id": int(po_id),
                            "purchase_order_code": str(po_code or data.purchase_order_code or "") or None,
                            "supplier_id": int(pull_preview.get("supplier_id") or data.supplier_id),
                            "supplier_name": str(
                                pull_preview.get("supplier_name") or data.supplier_name or ""
                            ),
                        }
                    )
                elif not po_id and not data.purchase_order_id:
                    # 无采购订单来源（委外/手工应付等）：显式置空，避免客户端脏值
                    data = data.model_copy(
                        update={
                            "purchase_order_id": None,
                            "purchase_order_code": None,
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

        input_payable_id = data.payable_id
        invoice_id: Optional[int] = None
        auto_payable_id: Optional[int] = None
        allocated_code = await invoice_service.generate_code(
            tenant_id, "PURCHASE_INVOICE_CODE", prefix=f"PI{today_site_str()}"
        )
        async with in_transaction():
            invoice = await invoice_service.create_purchase_invoice(
                tenant_id,
                data,
                current_user.id,
                skip_legacy_amount_gate=bool(pull_preview),
                submit_review=False,
                invoice_code=allocated_code,
            )
            invoice_id = int(invoice.id)
            if invoice.payable_id and not input_payable_id:
                auto_payable_id = int(invoice.payable_id)
            if pull_preview and data.source_type and data.source_id:
                await purchase_invoice_pull_service.create_pull_relation(
                    tenant_id=tenant_id,
                    source_type=str(data.source_type).strip(),
                    source_id=int(data.source_id),
                    source_code=str(pull_preview.get("source_code") or ""),
                    invoice_id=invoice_id,
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
                if want_payment and concurrent:
                    await create_concurrent_payment_for_payable(
                        tenant_id=tenant_id,
                        payable_id=int(data.payable_id),
                        total_amount=settle_amount,
                        payment_method=str(concurrent.payment_method),
                        bank_account_id=concurrent.bank_account_id,
                        bank_account=concurrent.bank_account,
                        payment_date=concurrent.voucher_date,
                        notes=concurrent.notes
                        or f"进项发票 {invoice.invoice_code} 开票同时付款",
                        current_user=current_user,
                    )
        # 审核/审批通知不得放在写库事务内：create_task 会与连接行锁互相等待，网关 504。
        if auto_payable_id:
            await submit_finance_review(
                model=Payable,
                tenant_id=tenant_id,
                doc_id=auto_payable_id,
                updated_by=current_user.id,
                doc_label="应付单",
                node_key="payable",
            )
        await submit_finance_review(
            model=PurchaseInvoice,
            tenant_id=tenant_id,
            doc_id=int(invoice_id),
            updated_by=current_user.id,
            doc_label="采购发票",
            node_key="purchase_invoice",
        )
        return await invoice_service.get_purchase_invoice_by_id(tenant_id, int(invoice_id))
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
    verification_status: Optional[str] = Query(None),
    tax_period: Optional[str] = Query(None),
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
        verification_status=verification_status,
        tax_period=tax_period,
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
