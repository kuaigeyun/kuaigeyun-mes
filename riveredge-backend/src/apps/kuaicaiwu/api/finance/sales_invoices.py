"""
销售发票管理 API 路由

使用 Invoice 模型, category='OUT' 表示销项发票。
"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import date, datetime
from decimal import Decimal
from loguru import logger

from tortoise.transactions import in_transaction
from tortoise import timezone as tortoise_timezone

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
from apps.kuaicaiwu.constants import RECEIVABLE_SOURCE_SALES_INVOICE
from apps.kuaicaiwu.services.finance_service import ReceivableService
from apps.kuaicaiwu.services.invoice_service import InvoiceService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.services.authorization.permission_policy_service import PermissionPolicyService
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.services.business_config_service import BusinessConfigService

router = APIRouter(prefix="/sales-invoices", tags=["App · Kuaicaiwu · Finance"])
business_config_service = BusinessConfigService()
receivable_service = ReceivableService()
invoice_service = InvoiceService()


async def _generate_sales_invoice_code(tenant_id: int) -> str:
    today = datetime.now().strftime("%Y%m%d")
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
    obj = await Invoice.get_or_none(tenant_id=tenant_id, id=invoice_id, category="OUT")
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
            due_date=invoice.invoice_date,
            business_date=invoice.invoice_date,
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
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """创建销售发票"""
    code = await _generate_sales_invoice_code(tenant_id)
    invoice = await Invoice.create(
        tenant_id=tenant_id,
        invoice_code=code,
        category="OUT",
        invoice_number=data.invoice_number,
        invoice_date=data.invoice_date,
        invoice_type=data.invoice_type or "增值税专用发票",
        partner_id=data.customer_id,
        partner_name=data.customer_name,
        tax_rate=data.tax_rate / 100,  # convert 13 -> 0.13
        amount_excluding_tax=data.invoice_amount,
        tax_amount=data.tax_amount,
        total_amount=data.total_amount,
        source_document_code=data.sales_order_code,
        attachment_uuid=data.attachment_path,
        attachments=data.attachments,
        description=data.notes,
        status="未审核",
        created_by=current_user.id,
    )
    await _maybe_auto_generate_receivable_for_sales_invoice(
        tenant_id=tenant_id,
        invoice=invoice,
        created_by=current_user.id,
    )
    invoice = await _get_or_404(tenant_id, invoice.id)
    return await _serialize(tenant_id, current_user.id, invoice)


@router.get("", response_model=SalesInvoiceListResponse)
async def list_sales_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    _auth: object = Depends(require_permission_codes("kuaicaiwu:sales-invoice:read")),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    """获取销售发票列表"""
    query = Invoice.filter(tenant_id=tenant_id, category="OUT")
    if status:
        query = query.filter(status=status)
    if customer_id:
        query = query.filter(partner_id=customer_id)
    if start_date:
        query = query.filter(invoice_date__gte=start_date)
    if end_date:
        query = query.filter(invoice_date__lte=end_date)

    total = await query.count()
    items = await query.offset(skip).limit(limit).order_by("-invoice_date", "-id")
    serialized = [await _serialize(tenant_id, current_user.id, inv) for inv in items]
    return SalesInvoiceListResponse(
        items=serialized,
        total=total, skip=skip, limit=limit
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
    update_data: dict = {}
    if data.invoice_number is not None:
        update_data["invoice_number"] = data.invoice_number
    if data.invoice_date is not None:
        update_data["invoice_date"] = data.invoice_date
    if data.invoice_type is not None:
        update_data["invoice_type"] = data.invoice_type
    if data.tax_rate is not None:
        update_data["tax_rate"] = data.tax_rate / 100
    if data.invoice_amount is not None:
        update_data["amount_excluding_tax"] = data.invoice_amount
    if data.tax_amount is not None:
        update_data["tax_amount"] = data.tax_amount
    if data.total_amount is not None:
        update_data["total_amount"] = data.total_amount
    if data.notes is not None:
        update_data["description"] = data.notes
    if data.attachments is not None:
        update_data["attachments"] = data.attachments
    if update_data:
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
    await Invoice.filter(id=id).update(status=new_status)
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
    await Invoice.filter(id=id).delete()


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
    await Invoice.filter(tenant_id=tenant_id, id=id).update(
        status="已作废",
        void_reason=reason,
        voided_at=tortoise_timezone.now(),
    )
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
        new_inv = await Invoice.create(
            tenant_id=tenant_id,
            invoice_code=code,
            category="OUT",
            invoice_number="",
            invoice_date=orig.invoice_date,
            invoice_type=orig.invoice_type or "VAT_SPECIAL",
            partner_id=orig.partner_id,
            partner_name=orig.partner_name,
            tax_rate=orig.tax_rate,
            amount_excluding_tax=-excl,
            tax_amount=-tax,
            total_amount=-tot,
            source_document_code=orig.source_document_code,
            attachment_uuid=orig.attachment_uuid,
            description=(desc + tail) if desc else tail.strip(),
            status="未审核",
            original_invoice_id=orig.id,
            created_by=current_user.id,
        )

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

        await Invoice.filter(tenant_id=tenant_id, id=orig.id).update(
            status="已红冲",
            red_flush_invoice_id=new_inv.id,
        )

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
