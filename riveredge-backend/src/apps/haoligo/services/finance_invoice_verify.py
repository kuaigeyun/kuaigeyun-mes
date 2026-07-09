"""好力 GO 财务 — 发票单价核对。"""

from __future__ import annotations

from decimal import Decimal

from apps.haoligo.constants.finance_invoice import (
    FINANCE_INVOICE_LINE_STATUS_MATCH,
    FINANCE_INVOICE_LINE_STATUS_MISSING_PRICE,
    FINANCE_INVOICE_LINE_STATUS_NEED_PRICE_CHANGE,
    FINANCE_INVOICE_LINE_STATUS_REJECTED,
    FINANCE_INVOICE_STATUS_PENDING,
)
from apps.haoligo.models.finance_invoice import HaoligoFinanceInvoice, HaoligoFinanceInvoiceLine
from apps.haoligo.services.finance_supplier_price import find_active_price
from apps.haoligo.utils.finance_decimal import resolve_unit_price_literal
from fastapi import HTTPException, status


def _price_equal(
    invoice_price: Decimal,
    invoice_literal: str | None,
    system_price: Decimal,
    system_literal: str | None,
) -> bool:
    try:
        inv = Decimal(str(invoice_literal).strip()) if invoice_literal else invoice_price
    except Exception:
        inv = invoice_price
    try:
        sys = Decimal(str(system_literal).strip()) if system_literal else system_price
    except Exception:
        sys = system_price
    return inv == sys


async def verify_invoice_lines(tenant_id: int, invoice: HaoligoFinanceInvoice) -> list[HaoligoFinanceInvoiceLine]:
    if invoice.status != FINANCE_INVOICE_STATUS_PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅已登记发票可执行单价核对")
    lines = await HaoligoFinanceInvoiceLine.filter(
        tenant_id=tenant_id, invoice_id=invoice.id, deleted_at__isnull=True
    ).order_by("line_no", "id")
    supplier_id = invoice.supplier_id
    for line in lines:
        if line.line_status == FINANCE_INVOICE_LINE_STATUS_REJECTED:
            continue
        active = await find_active_price(tenant_id, supplier_id, line.material_code)
        if not active:
            line.system_unit_price = None
            line.system_unit_price_literal = None
            line.price_diff_amount = None
            line.price_diff_ratio = None
            line.supplier_price_id = None
            line.line_status = FINANCE_INVOICE_LINE_STATUS_MISSING_PRICE
        elif _price_equal(
            line.invoice_unit_price,
            line.invoice_unit_price_literal,
            active.unit_price,
            active.unit_price_literal,
        ):
            system_literal = resolve_unit_price_literal(active.unit_price, active.unit_price_literal)
            line.system_unit_price = active.unit_price
            line.system_unit_price_literal = system_literal
            line.price_diff_amount = Decimal("0")
            line.price_diff_ratio = Decimal("0")
            line.supplier_price_id = active.id
            line.line_status = FINANCE_INVOICE_LINE_STATUS_MATCH
        else:
            system_literal = resolve_unit_price_literal(active.unit_price, active.unit_price_literal)
            system_price = Decimal(system_literal)
            invoice_literal = resolve_unit_price_literal(
                line.invoice_unit_price, line.invoice_unit_price_literal
            )
            invoice_price = Decimal(invoice_literal)
            diff = invoice_price - system_price
            ratio = (diff / system_price * Decimal("100")) if system_price else None
            line.system_unit_price = system_price
            line.system_unit_price_literal = system_literal
            line.price_diff_amount = diff
            line.price_diff_ratio = ratio
            line.supplier_price_id = active.id
            line.line_status = FINANCE_INVOICE_LINE_STATUS_NEED_PRICE_CHANGE
        await line.save()
    return lines


def invoice_ready_for_acceptance(lines: list[HaoligoFinanceInvoiceLine]) -> bool:
    if not lines:
        return False
    return all(
        ln.line_status in (FINANCE_INVOICE_LINE_STATUS_MATCH, FINANCE_INVOICE_LINE_STATUS_REJECTED)
        for ln in lines
    )
