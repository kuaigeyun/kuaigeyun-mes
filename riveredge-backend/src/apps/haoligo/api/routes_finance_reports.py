"""好力 GO — 财务应付款与本月付款报表 API。"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from apps.haoligo.api._haoligo_route_access import require_haoligo_module_access
from apps.haoligo.services.finance_payable_report import (
    build_monthly_payment_detail_rows,
    build_payable_report_rows,
)
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

payable_router = APIRouter(
    prefix="/finance/reports/payable",
    tags=["App · HaoliGO · 财务管理 · 应付款报表"],
    dependencies=[Depends(require_haoligo_module_access("finance-reports-payable"))],
)

monthly_router = APIRouter(
    prefix="/finance/reports/monthly-payment",
    tags=["App · HaoliGO · 财务管理 · 本月付款明细"],
    dependencies=[Depends(require_haoligo_module_access("finance-reports-monthly-payment"))],
)


class FinancePayableReportRow(BaseModel):
    supplier_id: int
    supplier_code: str
    supplier_name: str
    payment_terms_days: int
    total_payable: Decimal
    total_paid: Decimal
    balance: Decimal
    overdue_amount: Decimal
    due_this_month_amount: Decimal
    oldest_unpaid_due_date: Optional[str] = None
    invoice_count: int
    payment_count: int


class FinanceMonthlyPaymentDetailRow(BaseModel):
    invoice_id: int
    invoice_no: str
    supplier_id: int
    supplier_code: str
    supplier_name: str
    payment_terms_days: int
    invoice_date: str
    due_date: str
    original_amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal


class FinanceMonthlyPaymentSummary(BaseModel):
    year: int
    month: int
    total_remaining: Decimal = Field(description="本月到期剩余应付合计")
    row_count: int
    rows: List[FinanceMonthlyPaymentDetailRow]


@payable_router.get("", response_model=List[FinancePayableReportRow], summary="供应商应付款汇总")
async def get_finance_payable_report(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    supplier_id: Optional[int] = Query(None),
    keyword: Optional[str] = Query(None),
):
    rows = await build_payable_report_rows(tenant_id, supplier_id=supplier_id, keyword=keyword)
    return [FinancePayableReportRow.model_validate(r) for r in rows]


@monthly_router.get("", response_model=FinanceMonthlyPaymentSummary, summary="本月付款明细")
async def get_finance_monthly_payment_report(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    supplier_id: Optional[int] = Query(None),
):
    from tortoise import timezone

    today = timezone.now().date()
    y = year or today.year
    m = month or today.month
    rows = await build_monthly_payment_detail_rows(tenant_id, year=y, month=m, supplier_id=supplier_id)
    total_remaining = sum((r["remaining_amount"] for r in rows), Decimal("0"))
    return FinanceMonthlyPaymentSummary(
        year=y,
        month=m,
        total_remaining=total_remaining,
        row_count=len(rows),
        rows=[FinanceMonthlyPaymentDetailRow.model_validate(r) for r in rows],
    )
