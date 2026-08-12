"""
销售发票管理 API 路由

使用 Invoice 模型, category='OUT' 表示销项发票。
"""

import uuid
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Request
from datetime import date, datetime
from decimal import Decimal
from loguru import logger

from tortoise.transactions import in_transaction
from tortoise import timezone as tortoise_timezone

from apps.common.audit_actor import apply_create_audit, apply_update_audit, audit_response_fields
from apps.kuaicaiwu.schemas.finance import (
    SalesInvoiceCreate,
    SalesInvoiceUpdate,
    SalesInvoiceResponse,
    SalesInvoiceListResponse,
    SalesInvoiceDetailResponse,
    SalesInvoiceLineResponse,
    SalesInvoiceVoidRequest,
    SalesInvoiceRedLetterRequest,
    ReceivableCreate,
)
from apps.kuaicaiwu.models.invoice import Invoice, InvoiceItem
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.constants import RECEIVABLE_SOURCE_SALES_INVOICE
from apps.kuaicaiwu.services.finance_service import ReceivableService
from apps.kuaicaiwu.services.invoice_service import InvoiceService
from apps.kuaicaiwu.services.invoice_concurrent_settlement import (
    create_concurrent_receipt_for_receivable,
)
from apps.kuaicaiwu.services.sales_invoice_service import SalesInvoiceService
from infra.exceptions.exceptions import BusinessLogicError
from core.api.deps.access import AuthContext, ensure_permission_codes, require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.services.authorization.permission_policy_service import PermissionPolicyService
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.services.business_config_service import BusinessConfigService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str

router = APIRouter(prefix="/sales-invoices", tags=["App - Kuaicaiwu - Finance"])
business_config_service = BusinessConfigService()
receivable_service = ReceivableService()
invoice_service = InvoiceService()
sales_invoice_service = SalesInvoiceService()


async def _generate_sales_invoice_code(tenant_id: int) -> str:
    today = today_site_str()
    return await invoice_service.generate_code(tenant_id, "SALES_INVOICE_CODE", prefix=f"SI{today}")


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "kuaicaiwu_sales_invoices_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
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


async def _get_or_404(tenant_id: int, invoice_id: int, route: str = "/sales-invoices/{id}") -> Invoice:
    obj = await Invoice.get_or_none(
        tenant_id=tenant_id, id=invoice_id, category="OUT", deleted_at__isnull=True
    )
    if not obj:
        raise _http_exception_with_trace(404, f"销售发票不存在: {invoice_id}", route, tenant_id)
    return obj


def _derive_sales_invoice_review_status(inv: Invoice) -> str:
    """列表生命周期与审核操作按钮：与 status 对齐"""
    st = (inv.status or "").strip()
    if st == "已作废":
        return "已作废"
    if st == "已红冲":
        return "已红冲"
    if st == "已驳回":
        return "已驳回"
    if st in ("已审核", "已开票"):
        return "已审核"
    return "待审核"


async def _serialize(tenant_id: int, user_id: int, obj: Invoice) -> SalesInvoiceResponse:
    """将 Invoice 模型转换为 SalesInvoiceResponse"""
    audit = audit_response_fields(obj)
    payload = SalesInvoiceResponse(
        id=obj.id,
        tenant_id=obj.tenant_id,
        invoice_code=obj.invoice_code,
        customer_id=obj.partner_id,
        customer_name=obj.partner_name,
        sales_order_id=None,
        sales_order_code=obj.source_document_code,
        invoice_number=obj.invoice_number,
        invoice_date=obj.invoice_date,
        invoice_type=obj.invoice_type or "增值税专用发票",
        tax_rate=float(obj.tax_rate or 0) * 100,  # model stores as decimal (0.13), UI shows as 13
        invoice_amount=float(obj.amount_excluding_tax or 0),
        tax_amount=float(obj.tax_amount or 0),
        total_amount=float(obj.total_amount or 0),
        receivable_id=getattr(obj, "receivable_id", None),
        receivable_code=getattr(obj, "receivable_code", None),
        attachment_path=obj.attachment_uuid,
        attachments=getattr(obj, "attachments", None),
        notes=obj.description,
        original_invoice_id=getattr(obj, "original_invoice_id", None),
        red_flush_invoice_id=getattr(obj, "red_flush_invoice_id", None),
        void_reason=getattr(obj, "void_reason", None),
        voided_at=getattr(obj, "voided_at", None),
        status=obj.status or "未审核",
        reviewer_id=None,
        reviewer_name=None,
        review_time=None,
        review_status=_derive_sales_invoice_review_status(obj),
        review_remarks=None,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
        created_by=audit.get("created_by"),
        created_by_name=audit.get("created_by_name"),
        updated_by=audit.get("updated_by"),
        updated_by_name=audit.get("updated_by_name"),
    ).model_dump()
    masked = await PermissionPolicyService.apply_field_masks_to_dict(
        tenant_id=tenant_id,
        user_id=user_id,
        resource="kuaicaiwu:sales-invoice",
        payload=payload,
    )
    return SalesInvoiceResponse.model_validate(masked)


async def _serialize_detail(tenant_id: int, user_id: int, obj: Invoice) -> SalesInvoiceDetailResponse:
    await obj.fetch_related("items")
    base = (await _serialize(tenant_id, user_id, obj)).model_dump()
    line_payloads: list[dict] = []
    for it in obj.items:
        line_payloads.append(
            SalesInvoiceLineResponse(
                id=it.id,
                item_name=it.item_name or "",
                spec_model=it.spec_model,
                unit=it.unit,
                quantity=it.quantity,
                unit_price=it.unit_price,
                amount=it.amount,
                tax_rate=it.tax_rate,
                tax_amount=it.tax_amount,
            ).model_dump()
        )
    base["items"] = line_payloads
    masked = await PermissionPolicyService.apply_field_masks_to_dict(
        tenant_id=tenant_id,
        user_id=user_id,
        resource="kuaicaiwu:sales-invoice",
        payload=base,
    )
    return SalesInvoiceDetailResponse.model_validate(masked)


async def _maybe_auto_generate_receivable_for_sales_invoice(
    *,
    tenant_id: int,
    invoice: Invoice,
    created_by: int,
) -> tuple[Optional[int], Optional[str]]:
    _partner_id = getattr(invoice, "partner_id", None)
    if not await business_config_service.should_auto_generate_receivable_from_sales_invoice_effective(
        tenant_id, int(_partner_id) if _partner_id is not None else None
    ):
        return None, None
    if not await business_config_service.check_node_enabled(tenant_id, "receivable"):
        return None, None

    if Decimal(invoice.total_amount or 0) <= 0:
        return None, None

    from apps.kuaicaiwu.services.finance_due_date import resolve_partner_due_date

    biz_date = invoice.invoice_date or date.today()
    due = await resolve_partner_due_date(
        tenant_id, "customer", int(invoice.partner_id), biz_date
    )
    receivable = await receivable_service.create_receivable(
        tenant_id=tenant_id,
        receivable_data=ReceivableCreate(
            source_type=RECEIVABLE_SOURCE_SALES_INVOICE,
            source_id=invoice.id,
            source_code=invoice.invoice_code,
            customer_id=invoice.partner_id,
            customer_name=invoice.partner_name,
            total_amount=Decimal(invoice.total_amount or 0),
            received_amount=Decimal("0.00"),
            remaining_amount=Decimal(invoice.total_amount or 0),
            due_date=due,
            business_date=biz_date,
            status="未收款",
            invoice_issued=True,
            invoice_number=invoice.invoice_number,
        ),
        created_by=created_by,
    )
    await Invoice.filter(tenant_id=tenant_id, id=invoice.id).update(
        receivable_id=receivable.id,
        receivable_code=receivable.receivable_code,
    )
    try:
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        rel_svc = DocumentRelationNewService()
        await rel_svc.create_relation(
            tenant_id=tenant_id,
            relation_data=DocumentRelationCreate(
                source_type="sales_invoice",
                source_id=invoice.id,
                source_code=invoice.invoice_code,
                source_name=None,
                target_type="receivable",
                target_id=receivable.id,
                target_code=receivable.receivable_code,
                target_name=None,
                relation_type="source",
                relation_mode="push",
                relation_desc="销售发票自动生成应收单",
            ),
            created_by=created_by,
        )
    except Exception as rel_e:
        logger.warning("创建销售发票→应收单 单据关联失败: {}", rel_e)
    return receivable.id, receivable.receivable_code


@router.post("", response_model=SalesInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_invoice(
    data: SalesInvoiceCreate,
    request: Request,
    auth: AuthContext = Depends(require_permission_codes("kuaicaiwu:sales-invoice:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """创建销售发票（从应收拉单时可同时收款）"""
    try:
        from apps.kuaicaiwu.services.finance_tax import compute_tax_from_excluding

        _, tax_amount, total_amount = compute_tax_from_excluding(
            Decimal(data.invoice_amount),
            Decimal(data.tax_rate),
        )

        concurrent = data.concurrent_settlement
        want_receipt = bool(concurrent and concurrent.enabled)
        if want_receipt:
            if str(data.source_type or "").strip() != "receivable" or not data.source_id:
                raise BusinessLogicError("仅从应收单开票时可同时收款")
            await ensure_permission_codes(
                auth, tenant_id, request, ["kuaicaiwu:receipt:create"]
            )
            if not concurrent.payment_method or concurrent.voucher_date is None:
                raise BusinessLogicError("同时收款须填写收款方式与收款日期")
            settle_amount = Decimal(str(concurrent.total_amount or total_amount))
            if settle_amount <= 0:
                raise BusinessLogicError("同时收款金额须大于 0")

        pull_preview: Optional[Dict[str, Any]] = None
        if data.source_type and data.source_id:
            pull_preview = await sales_invoice_service.assert_pull_create_allowed(
                tenant_id=tenant_id,
                source_type=str(data.source_type).strip(),
                source_id=int(data.source_id),
                total_amount=total_amount,
            )

        source_document_code = data.sales_order_code
        receivable_id = data.receivable_id
        receivable_code = data.receivable_code
        customer_id = data.customer_id
        customer_name = data.customer_name
        if pull_preview:
            source_document_code = str(pull_preview.get("source_code") or source_document_code or "")
            if str(data.source_type or "").strip() == "receivable":
                receivable_id = int(pull_preview.get("receivable_id") or data.source_id or receivable_id or 0) or receivable_id
                receivable_code = str(
                    pull_preview.get("receivable_code") or receivable_code or source_document_code or ""
                )
                customer_id = int(pull_preview.get("customer_id") or customer_id)
                customer_name = str(pull_preview.get("customer_name") or customer_name or "")

        code = await _generate_sales_invoice_code(tenant_id)
        create_payload = {
            "tenant_id": tenant_id,
            "invoice_code": code,
            "category": "OUT",
            "invoice_number": data.invoice_number,
            "invoice_date": data.invoice_date,
            "invoice_type": data.invoice_type or "增值税专用发票",
            "partner_id": customer_id,
            "partner_name": customer_name,
            "tax_rate": data.tax_rate / 100,  # API 百分比 → 落库小数
            "amount_excluding_tax": data.invoice_amount,
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "source_document_code": source_document_code,
            "receivable_id": receivable_id,
            "receivable_code": receivable_code,
            "attachment_uuid": data.attachment_path,
            "attachments": data.attachments,
            "description": data.notes,
            "status": "未审核",
        }
        apply_create_audit(create_payload, current_user)
        async with in_transaction():
            invoice = await Invoice.create(**create_payload)
            if pull_preview and data.source_type and data.source_id:
                await sales_invoice_service.create_pull_relation(
                    tenant_id=tenant_id,
                    source_type=str(data.source_type).strip(),
                    source_id=int(data.source_id),
                    source_code=str(pull_preview.get("source_code") or source_document_code or ""),
                    invoice_id=int(invoice.id),
                    invoice_code=str(invoice.invoice_code),
                    created_by=current_user.id,
                )
            if pull_preview and str(data.source_type or "").strip() == "receivable" and receivable_id:
                receivable_update: dict = {
                    "invoice_issued": True,
                    "updated_by": current_user.id,
                }
                if data.invoice_number:
                    receivable_update["invoice_number"] = data.invoice_number
                await Receivable.filter(tenant_id=tenant_id, id=int(receivable_id)).update(**receivable_update)
                if want_receipt and concurrent:
                    await create_concurrent_receipt_for_receivable(
                        tenant_id=tenant_id,
                        receivable_id=int(receivable_id),
                        total_amount=settle_amount,
                        payment_method=str(concurrent.payment_method),
                        bank_account_id=concurrent.bank_account_id,
                        bank_account=concurrent.bank_account,
                        receipt_date=concurrent.voucher_date,
                        notes=concurrent.notes
                        or f"销项发票 {invoice.invoice_code} 开票同时收款",
                        current_user=current_user,
                    )
            elif not (pull_preview and str(data.source_type or "").strip() == "receivable"):
                await _maybe_auto_generate_receivable_for_sales_invoice(
                    tenant_id=tenant_id,
                    invoice=invoice,
                    created_by=current_user.id,
                )
        invoice = await _get_or_404(tenant_id, invoice.id)
        return await _serialize(tenant_id, current_user.id, invoice)
    except BusinessLogicError as e:
        raise _http_exception_with_trace(422, str(e), "/sales-invoices", tenant_id) from e


@router.get("", response_model=SalesInvoiceListResponse)
async def list_sales_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    keyword: Optional[str] = Query(None),
    invoice_code: Optional[str] = Query(None),
    customer_name: Optional[str] = Query(None),
    invoice_number: Optional[str] = Query(None),
    review_status: Optional[str] = None,
    created_start_date: Optional[str] = Query(None),
    created_end_date: Optional[str] = Query(None),
    updated_start_date: Optional[str] = Query(None),
    updated_end_date: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    """获取销售发票列表"""
    from apps.kuaicaiwu.services.finance_list_core import apply_finance_invoice_list_filters

    query = Invoice.filter(tenant_id=tenant_id, category="OUT", deleted_at__isnull=True)
    if status:
        query = query.filter(status=status)
    if customer_id:
        query = query.filter(partner_id=customer_id)

    doc_date_start = start_date.isoformat() if start_date else None
    doc_date_end = end_date.isoformat() if end_date else None

    query, order_expr = apply_finance_invoice_list_filters(
        query,
        doc_code_field="invoice_code",
        partner_name_field="partner_name",
        keyword=keyword,
        doc_code=invoice_code,
        partner_name=customer_name,
        invoice_number=invoice_number,
        keyword_fields=["invoice_code", "partner_name", "invoice_number", "source_document_code"],
        review_status=review_status,
        review_status_mode="sales_status",
        doc_date_start=doc_date_start,
        doc_date_end=doc_date_end,
        created_start_date=created_start_date,
        created_end_date=created_end_date,
        updated_start_date=updated_start_date,
        updated_end_date=updated_end_date,
        sort_field=sort_field,
        sort_order=sort_order,
    )

    total = await query.count()
    items = await query.order_by(order_expr, "-id").offset(skip).limit(limit)
    serialized = [await _serialize(tenant_id, current_user.id, inv) for inv in items]
    return SalesInvoiceListResponse(
        items=serialized,
        total=total, skip=skip, limit=limit
    )


@router.get(
    "/pull-candidates/sales-orders",
    summary="List sales order pull candidates for sales invoice",
)
async def list_sales_invoice_sales_order_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await sales_invoice_service.list_sales_order_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/pull-candidates/sales-deliveries",
    summary="List sales delivery pull candidates for sales invoice",
)
async def list_sales_invoice_sales_delivery_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await sales_invoice_service.list_sales_delivery_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/from-sales-order/{order_id}/pull-preview",
    summary="Preview pull sales invoice from sales order",
)
async def preview_pull_sales_invoice_from_sales_order(
    order_id: int = Path(..., description="销售订单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await sales_invoice_service.preview_pull_from_sales_order(
        tenant_id=tenant_id,
        order_id=order_id,
    )


@router.get(
    "/from-sales-delivery/{delivery_id}/pull-preview",
    summary="Preview pull sales invoice from sales delivery",
)
async def preview_pull_sales_invoice_from_sales_delivery(
    delivery_id: int = Path(..., description="销售出库单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await sales_invoice_service.preview_pull_from_sales_delivery(
        tenant_id=tenant_id,
        delivery_id=delivery_id,
    )


@router.get(
    "/pull-candidates/receivables",
    summary="List receivable pull candidates for sales invoice",
)
async def list_sales_invoice_receivable_pull_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await sales_invoice_service.list_receivable_pull_candidates(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
    )


@router.get(
    "/from-receivable/{receivable_id}/pull-preview",
    summary="Preview pull sales invoice from receivable",
)
async def preview_pull_sales_invoice_from_receivable(
    receivable_id: int = Path(..., description="应收单ID"),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    return await sales_invoice_service.preview_pull_from_receivable(
        tenant_id=tenant_id,
        receivable_id=receivable_id,
    )


@router.get("/{id}", response_model=SalesInvoiceDetailResponse)
async def get_sales_invoice(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    """获取销售发票详情（含明细行）"""
    invoice = await _get_or_404(tenant_id, id)
    return await _serialize_detail(tenant_id, current_user.id, invoice)


@router.put("/{id}", response_model=SalesInvoiceResponse)
async def update_sales_invoice(
    id: int,
    data: SalesInvoiceUpdate,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新销售发票"""
    invoice = await _get_or_404(tenant_id, id)
    if invoice.status in ("已审核", "已作废", "已红冲"):
        raise _http_exception_with_trace(
            400, "已审核、已作废或已红冲的发票不能修改", "/sales-invoices/{id}", tenant_id
        )
    from apps.kuaicaiwu.services.finance_tax import compute_tax_from_excluding

    update_data: dict = {}
    if data.invoice_number is not None:
        update_data["invoice_number"] = data.invoice_number
    if data.invoice_date is not None:
        update_data["invoice_date"] = data.invoice_date
    if data.invoice_type is not None:
        update_data["invoice_type"] = data.invoice_type
    amount_excl = data.invoice_amount if data.invoice_amount is not None else invoice.amount_excluding_tax
    tax_rate_percent = data.tax_rate if data.tax_rate is not None else Decimal(str(invoice.tax_rate or 0)) * Decimal("100")
    if data.tax_rate is not None:
        update_data["tax_rate"] = data.tax_rate / 100
    if data.invoice_amount is not None:
        update_data["amount_excluding_tax"] = data.invoice_amount
    if data.invoice_amount is not None or data.tax_rate is not None:
        _, tax_amount, total_amount = compute_tax_from_excluding(
            Decimal(amount_excl),
            Decimal(tax_rate_percent),
        )
        update_data["tax_amount"] = tax_amount
        update_data["total_amount"] = total_amount
    if data.notes is not None:
        update_data["description"] = data.notes
    if data.attachments is not None:
        update_data["attachments"] = data.attachments
    if update_data:
        apply_update_audit(update_data, current_user)
        await Invoice.filter(id=id).update(**update_data)
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.post("/{id}/approve", response_model=SalesInvoiceResponse)
async def approve_sales_invoice(
    id: int,
    rejection_reason: Optional[str] = Query(None),
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:audit")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """审核销售发票"""
    invoice = await _get_or_404(tenant_id, id)
    if invoice.status not in ("未审核", "DRAFT"):
        raise _http_exception_with_trace(
            400,
            "发票状态不允许审核（仅待审核/草稿可审；已作废、已红冲请走实务流程）",
            "/sales-invoices/{id}/approve",
            tenant_id,
        )
    new_status = "已驳回" if rejection_reason else "已审核"
    approve_payload = {"status": new_status}
    apply_update_audit(approve_payload, current_user)
    await Invoice.filter(id=id).update(**approve_payload)
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sales_invoice(
    id: int,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:delete")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除销售发票"""
    invoice = await _get_or_404(tenant_id, id)
    if invoice.status in ("已审核", "已作废", "已红冲"):
        raise _http_exception_with_trace(
            400,
            "已审核、已作废或已红冲的发票不能删除（保留审计轨迹）",
            "/sales-invoices/{id}",
            tenant_id,
        )
    from datetime import datetime

    await Invoice.filter(tenant_id=tenant_id, id=id).update(deleted_at=resolve_business_datetime())


@router.post("/{id}/void", response_model=SalesInvoiceResponse)
async def void_sales_invoice(
    id: int,
    body: SalesInvoiceVoidRequest,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:revoke")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    发票作废：适用于开票有误且符合企业内控的未跨期处理等场景。
    跨期或已报税抵扣等情形实务上应优先「红冲」，请使用红字发票接口。
    """
    invoice = await _get_or_404(tenant_id, id)
    st = (invoice.status or "").strip()
    if st in ("已作废", "已红冲"):
        raise _http_exception_with_trace(400, "该发票已作废或已红冲", "/sales-invoices/{id}/void", tenant_id)
    if st == "已驳回":
        raise _http_exception_with_trace(
            400, "已驳回单据请删除或修改后重新提交，无需作废", "/sales-invoices/{id}/void", tenant_id
        )
    if st == "已审核":
        raise _http_exception_with_trace(
            400,
            "已审核发票请使用「申请红字发票」冲销；作废仅适用于未审核/草稿（开票有误未确认前）",
            "/sales-invoices/{id}/void",
            tenant_id,
        )
    if st not in ("未审核", "DRAFT"):
        raise _http_exception_with_trace(
            400, "当前状态不允许作废", "/sales-invoices/{id}/void", tenant_id
        )
    reason = body.reason.strip()
    void_payload: dict = {
        "status": "已作废",
        "void_reason": reason,
        "voided_at": tortoise_timezone.now(),
    }
    apply_update_audit(void_payload, current_user)
    await Invoice.filter(tenant_id=tenant_id, id=id).update(**void_payload)
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.post("/{id}/red-letter", response_model=SalesInvoiceDetailResponse)
async def create_red_letter_sales_invoice(
    id: int,
    body: SalesInvoiceRedLetterRequest,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    开具红字销项发票草稿：按原蓝字金额生成负数明细（税务红字信息表、税控开票仍在线下完成）。
    生成后请审核红字发票；原蓝字发票状态将变为「已红冲」。
    """
    reason = body.reason.strip()
    async with in_transaction():
        orig = await Invoice.get_or_none(tenant_id=tenant_id, id=id, category="OUT").prefetch_related("items")
        if not orig:
            raise _http_exception_with_trace(404, f"销售发票不存在: {id}", "/sales-invoices/{id}/red-letter", tenant_id)
        if getattr(orig, "original_invoice_id", None):
            raise _http_exception_with_trace(
                400, "红字发票不能再申请红冲", "/sales-invoices/{id}/red-letter", tenant_id
            )
        if (orig.status or "").strip() != "已审核":
            raise _http_exception_with_trace(
                400, "仅已审核的蓝字发票可申请红冲", "/sales-invoices/{id}/red-letter", tenant_id
            )
        if getattr(orig, "red_flush_invoice_id", None):
            raise _http_exception_with_trace(
                400, "该发票已关联红字发票", "/sales-invoices/{id}/red-letter", tenant_id
            )

        excl = Decimal(orig.amount_excluding_tax or 0)
        tax = Decimal(orig.tax_amount or 0)
        tot = Decimal(orig.total_amount or 0)
        code = await _generate_sales_invoice_code(tenant_id)
        desc = (orig.description or "").strip()
        tail = f"\n红冲原发票#{orig.id}（{orig.invoice_code}）：{reason}"
        red_create_payload: dict = {
            "tenant_id": tenant_id,
            "invoice_code": code,
            "category": "OUT",
            "invoice_number": "",
            "invoice_date": orig.invoice_date,
            "invoice_type": orig.invoice_type or "VAT_SPECIAL",
            "partner_id": orig.partner_id,
            "partner_name": orig.partner_name,
            "tax_rate": orig.tax_rate,
            "amount_excluding_tax": -excl,
            "tax_amount": -tax,
            "total_amount": -tot,
            "source_document_code": orig.source_document_code,
            "attachment_uuid": orig.attachment_uuid,
            "description": (desc + tail) if desc else tail.strip(),
            "status": "未审核",
            "original_invoice_id": orig.id,
        }
        apply_create_audit(red_create_payload, current_user)
        new_inv = await Invoice.create(**red_create_payload)

        item_rows = list(orig.items) if orig.items else []
        if item_rows:
            for it in item_rows:
                amt = Decimal(it.amount or 0)
                tamt = Decimal(it.tax_amount or 0)
                qty = it.quantity
                up = it.unit_price
                await InvoiceItem.create(
                    tenant_id=tenant_id,
                    invoice=new_inv,
                    item_name=it.item_name or "明细",
                    spec_model=it.spec_model,
                    unit=it.unit,
                    quantity=-qty if qty is not None else None,
                    unit_price=up,
                    amount=-amt,
                    tax_rate=it.tax_rate,
                    tax_amount=-tamt,
                )
        else:
            await InvoiceItem.create(
                tenant_id=tenant_id,
                invoice=new_inv,
                item_name=f"红冲原发票#{orig.id}",
                spec_model=None,
                unit=None,
                quantity=None,
                unit_price=None,
                amount=-excl,
                tax_rate=orig.tax_rate or Decimal("0.13"),
                tax_amount=-tax,
            )

        red_orig_payload: dict = {
            "status": "已红冲",
            "red_flush_invoice_id": new_inv.id,
        }
        apply_update_audit(red_orig_payload, current_user)
        await Invoice.filter(tenant_id=tenant_id, id=orig.id).update(**red_orig_payload)

        fresh = await Invoice.get_or_none(tenant_id=tenant_id, id=new_inv.id, category="OUT")
        if not fresh:
            raise _http_exception_with_trace(500, "红字发票创建后读取失败", "/sales-invoices/{id}/red-letter", tenant_id)

    await _maybe_auto_generate_receivable_for_sales_invoice(
        tenant_id=tenant_id,
        invoice=fresh,
        created_by=current_user.id,
    )
    final_inv = await _get_or_404(tenant_id, fresh.id)
    return await _serialize_detail(tenant_id, current_user.id, final_inv)
