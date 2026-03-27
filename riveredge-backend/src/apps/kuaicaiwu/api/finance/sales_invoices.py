"""
销售发票管理 API 路由

使用 Invoice 模型, category='OUT' 表示销项发票。
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import date, datetime

from apps.kuaicaiwu.schemas.finance import (
    SalesInvoiceCreate, SalesInvoiceUpdate,
    SalesInvoiceResponse, SalesInvoiceListResponse,
)
from apps.kuaicaiwu.models.invoice import Invoice
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="/sales-invoices", tags=["Kuaicaiwu Finance"])


async def _get_or_404(tenant_id: int, invoice_id: int) -> Invoice:
    obj = await Invoice.get_or_none(tenant_id=tenant_id, id=invoice_id, category="OUT")
    if not obj:
        raise HTTPException(status_code=404, detail=f"销售发票不存在: {invoice_id}")
    return obj


def _serialize(obj: Invoice) -> SalesInvoiceResponse:
    """将 Invoice 模型转换为 SalesInvoiceResponse"""
    return SalesInvoiceResponse(
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
    )


@router.post("", response_model=SalesInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_invoice(
    data: SalesInvoiceCreate,
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
    return _serialize(invoice)


@router.get("", response_model=SalesInvoiceListResponse)
async def list_sales_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    tenant_id: int = Depends(get_current_tenant)
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
    return SalesInvoiceListResponse(
        items=[_serialize(inv) for inv in items],
        total=total, skip=skip, limit=limit
    )


@router.get("/{id}", response_model=SalesInvoiceResponse)
async def get_sales_invoice(
    id: int,
    tenant_id: int = Depends(get_current_tenant)
):
    """获取销售发票详情"""
    invoice = await _get_or_404(tenant_id, id)
    return _serialize(invoice)


@router.put("/{id}", response_model=SalesInvoiceResponse)
async def update_sales_invoice(
    id: int,
    data: SalesInvoiceUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """更新销售发票"""
    invoice = await _get_or_404(tenant_id, id)
    if invoice.status == "已审核":
        raise HTTPException(status_code=400, detail="已审核的发票不能修改")
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
    return _serialize(await _get_or_404(tenant_id, id))


@router.post("/{id}/approve", response_model=SalesInvoiceResponse)
async def approve_sales_invoice(
    id: int,
    rejection_reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """审核销售发票"""
    invoice = await _get_or_404(tenant_id, id)
    if invoice.status not in ("未审核", "DRAFT"):
        raise HTTPException(status_code=400, detail="发票状态不允许审核")
    new_status = "已驳回" if rejection_reason else "已审核"
    await Invoice.filter(id=id).update(status=new_status)
    return _serialize(await _get_or_404(tenant_id, id))


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sales_invoice(
    id: int,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
):
    """删除销售发票"""
    invoice = await _get_or_404(tenant_id, id)
    if invoice.status == "已审核":
        raise HTTPException(status_code=400, detail="已审核的发票不能删除")
    await Invoice.filter(id=id).delete()
