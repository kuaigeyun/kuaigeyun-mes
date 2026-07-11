"""好力 GO — 财务付款记录 API。"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from tortoise import timezone
from tortoise.expressions import Q

from apps.haoligo.api._creator import current_user_creator_name, resolve_creator_name
from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.finance_payment import FINANCE_PAYMENT_METHODS
from apps.haoligo.models.finance_invoice import HaoligoFinanceInvoice, HaoligoFinanceMaterialAcceptance
from apps.haoligo.models.finance_payment import HaoligoFinancePayment
from apps.haoligo.services.finance_supplier_price import get_supplier_or_404
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(
    prefix="/finance/payments",
    tags=["App · HaoliGO · 财务管理 · 付款"],
    dependencies=[Depends(require_haoligo_module_access("finance-payments"))],
)

PaymentMethodLiteral = Literal["银行转账", "承兑汇票", "现金", "支票", "其他"]


class FinancePaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    supplier_id: int
    supplier_code: Optional[str] = None
    supplier_name: Optional[str] = None
    payment_date: date
    amount: Decimal
    payment_method: str
    contract_no: Optional[str] = None
    remark: Optional[str] = None
    acceptance_id: Optional[int] = None
    acceptance_sheet_no: Optional[str] = None
    invoice_id: Optional[int] = None
    invoice_no: Optional[str] = None
    creator_name: Optional[str] = None


class FinancePaymentCreate(BaseModel):
    supplier_id: int
    payment_date: date
    amount: Decimal = Field(gt=0)
    payment_method: PaymentMethodLiteral
    contract_no: Optional[str] = Field(None, max_length=128)
    remark: Optional[str] = None
    acceptance_id: Optional[int] = None
    invoice_id: Optional[int] = None


class FinancePaymentUpdate(BaseModel):
    supplier_id: Optional[int] = None
    payment_date: Optional[date] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    payment_method: Optional[PaymentMethodLiteral] = None
    contract_no: Optional[str] = Field(None, max_length=128)
    remark: Optional[str] = None
    acceptance_id: Optional[int] = None
    invoice_id: Optional[int] = None


async def _serialize_payment(row: HaoligoFinancePayment) -> FinancePaymentOut:
    supplier = await get_supplier_or_404(row.tenant_id, row.supplier_id)
    acceptance_sheet_no = None
    invoice_no = None
    if row.acceptance_id:
        acc = await HaoligoFinanceMaterialAcceptance.filter(
            tenant_id=row.tenant_id, id=row.acceptance_id, deleted_at__isnull=True
        ).first()
        acceptance_sheet_no = acc.sheet_no if acc else None
    if row.invoice_id:
        inv = await HaoligoFinanceInvoice.filter(
            tenant_id=row.tenant_id, id=row.invoice_id, deleted_at__isnull=True
        ).first()
        invoice_no = inv.invoice_no if inv else None
    return FinancePaymentOut(
        id=row.id,
        uuid=row.uuid,
        supplier_id=row.supplier_id,
        supplier_code=supplier.supplier_code,
        supplier_name=supplier.supplier_name,
        payment_date=row.payment_date,
        amount=row.amount,
        payment_method=row.payment_method,
        contract_no=row.contract_no,
        remark=row.remark,
        acceptance_id=row.acceptance_id,
        acceptance_sheet_no=acceptance_sheet_no,
        invoice_id=row.invoice_id,
        invoice_no=invoice_no,
        creator_name=resolve_creator_name(created_by_name=getattr(row, "created_by_name", None)),
    )


async def _validate_optional_links(
    tenant_id: int,
    *,
    supplier_id: int,
    acceptance_id: int | None,
    invoice_id: int | None,
) -> None:
    if acceptance_id is not None:
        acc = await tenant_alive(HaoligoFinanceMaterialAcceptance, tenant_id).filter(id=acceptance_id).first()
        if not acc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="关联验收单不存在")
        if acc.supplier_id != supplier_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验收单与供应商不匹配")
    if invoice_id is not None:
        inv = await tenant_alive(HaoligoFinanceInvoice, tenant_id).filter(id=invoice_id).first()
        if not inv:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="关联发票不存在")
        if inv.supplier_id != supplier_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="发票与供应商不匹配")


@router.get("", response_model=List[FinancePaymentOut], summary="付款记录列表")
async def list_finance_payments(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    supplier_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
    payment_date_from: Optional[date] = Query(None),
    payment_date_to: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    qs = tenant_alive(HaoligoFinancePayment, tenant_id)
    if supplier_id is not None:
        qs = qs.filter(supplier_id=supplier_id)
    if payment_date_from is not None:
        qs = qs.filter(payment_date__gte=payment_date_from)
    if payment_date_to is not None:
        qs = qs.filter(payment_date__lte=payment_date_to)
    if keyword and keyword.strip():
        k = keyword.strip()
        qs = qs.filter(Q(contract_no__icontains=k) | Q(remark__icontains=k) | Q(payment_method__icontains=k))
    rows = await qs.order_by("-payment_date", "-id").offset(skip).limit(limit)
    return [await _serialize_payment(r) for r in rows]


@router.get("/{payment_id}", response_model=FinancePaymentOut, summary="付款记录详情")
async def get_finance_payment(
    payment_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoFinancePayment, tenant_id).filter(id=payment_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="付款记录不存在")
    return await _serialize_payment(row)


@router.post("", response_model=FinancePaymentOut, summary="登记付款")
async def create_finance_payment(
    body: FinancePaymentCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
):
    if body.payment_method not in FINANCE_PAYMENT_METHODS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="付款方式无效")
    await get_supplier_or_404(tenant_id, body.supplier_id)
    await _validate_optional_links(
        tenant_id,
        supplier_id=body.supplier_id,
        acceptance_id=body.acceptance_id,
        invoice_id=body.invoice_id,
    )
    creator_id, creator_name = current_user_creator_name(user)
    row = await HaoligoFinancePayment.create(
        tenant_id=tenant_id,
        supplier_id=body.supplier_id,
        created_by_user_id=creator_id,
        created_by_name=creator_name,
        payment_date=body.payment_date,
        amount=body.amount,
        payment_method=body.payment_method,
        contract_no=(body.contract_no or "").strip() or None,
        remark=(body.remark or "").strip() or None,
        acceptance_id=body.acceptance_id,
        invoice_id=body.invoice_id,
    )
    return await _serialize_payment(row)


@router.patch("/{payment_id}", response_model=FinancePaymentOut, summary="更新付款记录")
async def update_finance_payment(
    payment_id: int,
    body: FinancePaymentUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoFinancePayment, tenant_id).filter(id=payment_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="付款记录不存在")
    data = body.model_dump(exclude_unset=True)
    supplier_id = data.get("supplier_id", row.supplier_id)
    if "supplier_id" in data:
        await get_supplier_or_404(tenant_id, supplier_id)
    acceptance_id = data.get("acceptance_id", row.acceptance_id)
    invoice_id = data.get("invoice_id", row.invoice_id)
    if "acceptance_id" in data or "invoice_id" in data or "supplier_id" in data:
        await _validate_optional_links(
            tenant_id,
            supplier_id=supplier_id,
            acceptance_id=acceptance_id,
            invoice_id=invoice_id,
        )
    if "payment_method" in data and data["payment_method"] not in FINANCE_PAYMENT_METHODS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="付款方式无效")
    for field in ("supplier_id", "payment_date", "amount", "payment_method"):
        if field in data and data[field] is not None:
            setattr(row, field, data[field])
    # 可选关联允许显式置空
    for field in ("acceptance_id", "invoice_id"):
        if field in data:
            setattr(row, field, data[field])
    for field in ("contract_no", "remark"):
        if field in data:
            val = data[field]
            setattr(row, field, (val or "").strip() or None if isinstance(val, str) else val)
    await row.save()
    return await _serialize_payment(row)


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除付款记录")
async def delete_finance_payment(
    payment_id: int,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    row = await tenant_alive(HaoligoFinancePayment, tenant_id).filter(id=payment_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="付款记录不存在")
    row.deleted_at = timezone.now()
    await row.save()
