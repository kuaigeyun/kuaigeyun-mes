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

from apps.kuaicaiwu.schemas.finance import (
    SalesInvoiceCreate, SalesInvoiceUpdate,
    SalesInvoiceResponse, SalesInvoiceListResponse,
    ReceivableCreate,
)
from apps.kuaicaiwu.models.invoice import Invoice
from apps.kuaicaiwu.services.finance_service import ReceivableService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from core.services.authorization.permission_policy_service import PermissionPolicyService
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.services.business_config_service import BusinessConfigService

router = APIRouter(prefix="/sales-invoices", tags=["Kuaicaiwu Finance"])
business_config_service = BusinessConfigService()
receivable_service = ReceivableService()


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
        receivable_id=None,
        receivable_code=None,
        attachment_path=obj.attachment_uuid,
        notes=obj.description,
        status=obj.status or "未审核",
        reviewer_id=None,
        reviewer_name=None,
        review_time=None,
        review_status="待审核",
        review_remarks=None,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    ).model_dump()
    masked = await PermissionPolicyService.apply_field_masks_to_dict(
        tenant_id=tenant_id,
        user_id=user_id,
        resource="kuaicaiwu:invoice",
        payload=payload,
    )
    return SalesInvoiceResponse.model_validate(masked)


async def _maybe_auto_generate_receivable_for_sales_invoice(
    *,
    tenant_id: int,
    invoice: Invoice,
    created_by: int,
) -> tuple[Optional[int], Optional[str]]:
    enabled = await business_config_service.get_finance_auto_generate_receivable_from_sales_invoice(tenant_id)
    if not enabled:
        return None, None
    if not await business_config_service.check_node_enabled(tenant_id, "receivable"):
        return None, None

    receivable = await receivable_service.create_receivable(
        tenant_id=tenant_id,
        receivable_data=ReceivableCreate(
            source_type="SalesInvoice",
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
    return receivable.id, receivable.receivable_code


@router.post("", response_model=SalesInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_invoice(
    data: SalesInvoiceCreate,
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
    """创建销售发票"""
    today = datetime.now().strftime("%Y%m%d")
    count = await Invoice.filter(tenant_id=tenant_id, category="OUT").count()
    code = f"SINV{today}{count + 1:04d}"
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
        description=data.notes,
        status="未审核",
        created_by=current_user.id,
    )
    receivable_id, receivable_code = await _maybe_auto_generate_receivable_for_sales_invoice(
        tenant_id=tenant_id,
        invoice=invoice,
        created_by=current_user.id,
    )
    result = await _serialize(tenant_id, current_user.id, invoice)
    result.receivable_id = receivable_id
    result.receivable_code = receivable_code
    return result


@router.get("", response_model=SalesInvoiceListResponse)
async def list_sales_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    _auth: object = Depends(
        require_access(
            "finance.invoice",
            "read",
            required_permissions=["kuaicaiwu:invoice:view"],
        )
    ),
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


@router.get("/{id}", response_model=SalesInvoiceResponse)
async def get_sales_invoice(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.invoice",
            "read",
            required_permissions=["kuaicaiwu:invoice:view"],
        )
    ),
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
):
    """获取销售发票详情"""
    invoice = await _get_or_404(tenant_id, id)
    return await _serialize(tenant_id, current_user.id, invoice)


@router.put("/{id}", response_model=SalesInvoiceResponse)
async def update_sales_invoice(
    id: int,
    data: SalesInvoiceUpdate,
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
    """更新销售发票"""
    invoice = await _get_or_404(tenant_id, id)
    if invoice.status == "已审核":
        raise _http_exception_with_trace(400, "已审核的发票不能修改", "/sales-invoices/{id}", tenant_id)
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
    if update_data:
        await Invoice.filter(id=id).update(**update_data)
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.post("/{id}/approve", response_model=SalesInvoiceResponse)
async def approve_sales_invoice(
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
    """审核销售发票"""
    invoice = await _get_or_404(tenant_id, id)
    if invoice.status not in ("未审核", "DRAFT"):
        raise _http_exception_with_trace(
            400,
            "发票状态不允许审核",
            "/sales-invoices/{id}/approve",
            tenant_id,
        )
    new_status = "已驳回" if rejection_reason else "已审核"
    await Invoice.filter(id=id).update(status=new_status)
    return await _serialize(tenant_id, current_user.id, await _get_or_404(tenant_id, id))


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sales_invoice(
    id: int,
    _auth: object = Depends(
        require_access(
            "finance.invoice",
            "delete",
            required_permissions=["kuaicaiwu:invoice:create"],
        )
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """删除销售发票"""
    invoice = await _get_or_404(tenant_id, id)
    if invoice.status == "已审核":
        raise _http_exception_with_trace(400, "已审核的发票不能删除", "/sales-invoices/{id}", tenant_id)
    await Invoice.filter(id=id).delete()
