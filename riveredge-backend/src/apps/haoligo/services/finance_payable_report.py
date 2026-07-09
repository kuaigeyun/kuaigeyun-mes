"""好力 GO 财务 — 应付款与本月付款明细聚合（按未拒收发票口径）。"""

from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from tortoise import timezone
from tortoise.expressions import Q

from apps.haoligo.constants.finance_invoice import FINANCE_INVOICE_STATUS_REJECTED
from apps.haoligo.models.finance_invoice import HaoligoFinanceInvoice
from apps.haoligo.models.finance_payment import HaoligoFinancePayment
from apps.haoligo.models.finance_supplier import HaoligoFinanceSupplier


def _today() -> date:
    return timezone.now().date()


def _month_range(year: int, month: int) -> tuple[date, date]:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def _invoice_base_date(inv: HaoligoFinanceInvoice, fallback: date) -> date:
    if inv.invoice_date:
        return inv.invoice_date
    if inv.created_at:
        return inv.created_at.date()
    return fallback


def _fifo_remaining_by_invoice(
    invoices: list[HaoligoFinanceInvoice],
    payment_total: Decimal,
) -> dict[int, Decimal]:
    """按开票日期 FIFO 将付款金额分摊到各发票，返回每张票剩余应付。"""
    ordered = sorted(
        invoices,
        key=lambda r: (_invoice_base_date(r, date.min), r.id),
    )
    pool = payment_total
    remaining: dict[int, Decimal] = {}
    for inv in ordered:
        amount = Decimal(inv.total_amount or 0)
        if pool >= amount:
            pool -= amount
            remaining[inv.id] = Decimal("0")
        else:
            remaining[inv.id] = amount - pool
            pool = Decimal("0")
    return remaining


async def build_payable_report_rows(
    tenant_id: int,
    *,
    supplier_id: int | None = None,
    keyword: str | None = None,
) -> list[dict]:
    today = _today()
    month_start, month_end = _month_range(today.year, today.month)

    inv_qs = HaoligoFinanceInvoice.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).exclude(status=FINANCE_INVOICE_STATUS_REJECTED)
    pay_qs = HaoligoFinancePayment.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if supplier_id is not None:
        inv_qs = inv_qs.filter(supplier_id=supplier_id)
        pay_qs = pay_qs.filter(supplier_id=supplier_id)

    # 3 次查询：发票 + 付款 + 相关供应商（不再按供应商循环查库）
    invoices = await inv_qs.only("id", "supplier_id", "total_amount", "invoice_date", "created_at")
    payments = await pay_qs.only("id", "supplier_id", "amount")

    active_supplier_ids = {inv.supplier_id for inv in invoices} | {pay.supplier_id for pay in payments}
    if not active_supplier_ids:
        return []

    supplier_qs = HaoligoFinanceSupplier.filter(
        tenant_id=tenant_id,
        id__in=list(active_supplier_ids),
        deleted_at__isnull=True,
    )
    if keyword and keyword.strip():
        k = keyword.strip()
        supplier_qs = supplier_qs.filter(Q(supplier_code__icontains=k) | Q(supplier_name__icontains=k))
    suppliers = await supplier_qs.order_by("supplier_code").only(
        "id", "supplier_code", "supplier_name", "payment_terms_days"
    )
    if not suppliers:
        return []
    supplier_id_set = {s.id for s in suppliers}

    invoices_by_supplier: dict[int, list[HaoligoFinanceInvoice]] = defaultdict(list)
    for inv in invoices:
        if inv.supplier_id in supplier_id_set:
            invoices_by_supplier[inv.supplier_id].append(inv)

    paid_by_supplier: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    payment_count_by_supplier: dict[int, int] = defaultdict(int)
    for pay in payments:
        if pay.supplier_id not in supplier_id_set:
            continue
        paid_by_supplier[pay.supplier_id] += Decimal(pay.amount or 0)
        payment_count_by_supplier[pay.supplier_id] += 1

    rows: list[dict] = []
    for sup in suppliers:
        inv_list = invoices_by_supplier.get(sup.id, [])
        total_payable = sum((Decimal(inv.total_amount or 0) for inv in inv_list), Decimal("0"))
        total_paid = paid_by_supplier.get(sup.id, Decimal("0"))
        balance = total_payable - total_paid

        fifo = _fifo_remaining_by_invoice(inv_list, total_paid)
        overdue = Decimal("0")
        due_this_month = Decimal("0")
        oldest_unpaid_due: date | None = None
        for inv in inv_list:
            rem = fifo.get(inv.id, Decimal(inv.total_amount or 0))
            if rem <= 0:
                continue
            base = _invoice_base_date(inv, today)
            due = base + timedelta(days=int(sup.payment_terms_days or 0)) if sup.payment_terms_days else base
            if due < today:
                overdue += rem
            if month_start <= due <= month_end:
                due_this_month += rem
            if oldest_unpaid_due is None or due < oldest_unpaid_due:
                oldest_unpaid_due = due

        rows.append(
            {
                "supplier_id": sup.id,
                "supplier_code": sup.supplier_code,
                "supplier_name": sup.supplier_name,
                "payment_terms_days": sup.payment_terms_days,
                "total_payable": total_payable,
                "total_paid": total_paid,
                "balance": balance,
                "overdue_amount": overdue,
                "due_this_month_amount": due_this_month,
                "oldest_unpaid_due_date": oldest_unpaid_due.isoformat() if oldest_unpaid_due else None,
                "invoice_count": len(inv_list),
                "payment_count": payment_count_by_supplier.get(sup.id, 0),
            }
        )
    return rows


async def build_monthly_payment_detail_rows(
    tenant_id: int,
    *,
    year: int,
    month: int,
    supplier_id: int | None = None,
) -> list[dict]:
    month_start, month_end = _month_range(year, month)
    inv_qs = HaoligoFinanceInvoice.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).exclude(status=FINANCE_INVOICE_STATUS_REJECTED)
    if supplier_id is not None:
        inv_qs = inv_qs.filter(supplier_id=supplier_id)
    invoices = await inv_qs.only(
        "id",
        "supplier_id",
        "invoice_no",
        "total_amount",
        "invoice_date",
        "created_at",
    ).order_by("invoice_date", "id")
    if not invoices:
        return []

    supplier_ids = list({inv.supplier_id for inv in invoices})
    suppliers = {
        s.id: s
        for s in await HaoligoFinanceSupplier.filter(
            tenant_id=tenant_id, id__in=supplier_ids, deleted_at__isnull=True
        ).only("id", "supplier_code", "supplier_name", "payment_terms_days")
    }

    payments = await HaoligoFinancePayment.filter(
        tenant_id=tenant_id,
        supplier_id__in=supplier_ids,
        deleted_at__isnull=True,
    ).only("supplier_id", "amount")
    payments_by_supplier: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for pay in payments:
        payments_by_supplier[pay.supplier_id] += Decimal(pay.amount or 0)

    inv_by_supplier: dict[int, list[HaoligoFinanceInvoice]] = defaultdict(list)
    for inv in invoices:
        inv_by_supplier[inv.supplier_id].append(inv)

    fifo_by_supplier = {
        sid: _fifo_remaining_by_invoice(inv_list, payments_by_supplier.get(sid, Decimal("0")))
        for sid, inv_list in inv_by_supplier.items()
    }

    today = _today()
    rows: list[dict] = []
    for inv in invoices:
        sup = suppliers.get(inv.supplier_id)
        if not sup:
            continue
        base = _invoice_base_date(inv, today)
        due = base + timedelta(days=int(sup.payment_terms_days or 0))
        if not (month_start <= due <= month_end):
            continue
        original = Decimal(inv.total_amount or 0)
        remaining = fifo_by_supplier.get(inv.supplier_id, {}).get(inv.id, original)
        paid = original - remaining
        if remaining <= 0 and paid <= 0:
            continue
        rows.append(
            {
                "invoice_id": inv.id,
                "invoice_no": inv.invoice_no,
                "supplier_id": sup.id,
                "supplier_code": sup.supplier_code,
                "supplier_name": sup.supplier_name,
                "payment_terms_days": sup.payment_terms_days,
                "invoice_date": base.isoformat(),
                "due_date": due.isoformat(),
                "original_amount": original,
                "paid_amount": paid,
                "remaining_amount": remaining,
            }
        )
    return rows
