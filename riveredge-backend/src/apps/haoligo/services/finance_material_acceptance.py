"""好力 GO 财务 — 材料验收单合并与确认。"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from tortoise import timezone
from tortoise.transactions import in_transaction

from apps.haoligo.api._mold_sheet_code import generate_mold_sheet_no
from apps.haoligo.constants.finance_invoice import (
    FINANCE_ACCEPTANCE_STATUS_CONFIRMED,
    FINANCE_ACCEPTANCE_STATUS_DRAFT,
    FINANCE_INVOICE_LINE_STATUS_REJECTED,
    FINANCE_INVOICE_STATUS_ACCEPTED,
    FINANCE_INVOICE_STATUS_PENDING,
)
from apps.haoligo.constants.finance_sheet_rule_codes import HAOLIGO_FINANCE_MATERIAL_ACCEPTANCE_NO
from apps.haoligo.models.finance_invoice import (
    HaoligoFinanceAcceptanceInvoice,
    HaoligoFinanceInvoice,
    HaoligoFinanceInvoiceLine,
    HaoligoFinanceMaterialAcceptance,
    HaoligoFinanceMaterialAcceptanceLine,
)
from apps.haoligo.services.finance_invoice_verify import invoice_ready_for_acceptance, verify_invoice_lines
from apps.haoligo.services.finance_supplier_price import get_supplier_or_404


def _today() -> date:
    return timezone.now().date()


async def _load_invoices_for_merge(
    tenant_id: int,
    invoice_ids: list[int],
) -> list[HaoligoFinanceInvoice]:
    if not invoice_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择至少一张发票")
    rows = await HaoligoFinanceInvoice.filter(
        tenant_id=tenant_id, id__in=invoice_ids, deleted_at__isnull=True
    ).all()
    if len(rows) != len(set(invoice_ids)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="部分发票不存在")
    supplier_ids = {r.supplier_id for r in rows}
    if len(supplier_ids) != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="合并验收单须为同一供应商的发票")
    for inv in rows:
        if inv.status != FINANCE_INVOICE_STATUS_PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"发票 {inv.invoice_no} 状态不可合并（须为已登记）",
            )
        lines = await HaoligoFinanceInvoiceLine.filter(
            tenant_id=tenant_id, invoice_id=inv.id, deleted_at__isnull=True
        ).all()
        if not invoice_ready_for_acceptance(lines):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"发票 {inv.invoice_no} 尚有未处理明细（差异/未登记）",
            )
    return rows


async def get_or_create_acceptance_for_invoice(
    tenant_id: int,
    invoice_id: int,
) -> HaoligoFinanceMaterialAcceptance:
    """按单张发票打印验收单：已有关联验收单则复用，否则生成草稿验收单。"""
    link = (
        await HaoligoFinanceAcceptanceInvoice.filter(
            tenant_id=tenant_id, invoice_id=invoice_id, deleted_at__isnull=True
        )
        .order_by("-id")
        .first()
    )
    if link:
        acceptance = await HaoligoFinanceMaterialAcceptance.filter(
            tenant_id=tenant_id, id=link.acceptance_id, deleted_at__isnull=True
        ).first()
        if acceptance:
            return acceptance
    return await create_material_acceptance_from_invoices(tenant_id, invoice_ids=[invoice_id])


async def create_material_acceptance_from_invoices(
    tenant_id: int,
    *,
    invoice_ids: list[int],
    acceptance_date: date | None = None,
    remark: str | None = None,
) -> HaoligoFinanceMaterialAcceptance:
    invoices = await _load_invoices_for_merge(tenant_id, invoice_ids)
    supplier_id = invoices[0].supplier_id
    await get_supplier_or_404(tenant_id, supplier_id)

    merged: dict[tuple[str, str, Decimal], dict] = defaultdict(
        lambda: {
            "material_code": "",
            "material_name": "",
            "spec": None,
            "unit": None,
            "quantity": Decimal("0"),
            "unit_price": Decimal("0"),
            "source_invoice_line_ids": [],
        }
    )

    for inv in invoices:
        lines = await HaoligoFinanceInvoiceLine.filter(
            tenant_id=tenant_id, invoice_id=inv.id, deleted_at__isnull=True
        ).order_by("line_no", "id")
        for ln in lines:
            if ln.line_status == FINANCE_INVOICE_LINE_STATUS_REJECTED:
                continue
            key = (ln.material_code, ln.unit or "", ln.invoice_unit_price)
            bucket = merged[key]
            bucket["material_code"] = ln.material_code
            bucket["material_name"] = ln.material_name
            bucket["spec"] = ln.spec
            bucket["unit"] = ln.unit
            bucket["unit_price"] = ln.invoice_unit_price
            bucket["quantity"] += ln.quantity
            bucket["source_invoice_line_ids"].append(ln.id)

    if not merged:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无有效明细可生成验收单")

    sheet_no = await generate_mold_sheet_no(tenant_id, HAOLIGO_FINANCE_MATERIAL_ACCEPTANCE_NO)
    acc_date = acceptance_date or _today()
    total = Decimal("0")

    async with in_transaction():
        acceptance = await HaoligoFinanceMaterialAcceptance.create(
            tenant_id=tenant_id,
            sheet_no=sheet_no,
            supplier_id=supplier_id,
            acceptance_date=acc_date,
            status=FINANCE_ACCEPTANCE_STATUS_DRAFT,
            remark=(remark or "").strip() or None,
        )
        line_no = 0
        for bucket in merged.values():
            line_no += 1
            qty = bucket["quantity"]
            price = bucket["unit_price"]
            amount = (qty * price).quantize(Decimal("0.01"))
            total += amount
            await HaoligoFinanceMaterialAcceptanceLine.create(
                tenant_id=tenant_id,
                acceptance_id=acceptance.id,
                line_no=line_no,
                material_code=bucket["material_code"],
                material_name=bucket["material_name"],
                spec=bucket["spec"],
                unit=bucket["unit"],
                quantity=qty,
                unit_price=price,
                amount=amount,
                source_invoice_line_ids=bucket["source_invoice_line_ids"],
            )
        for inv in invoices:
            await HaoligoFinanceAcceptanceInvoice.create(
                tenant_id=tenant_id,
                acceptance_id=acceptance.id,
                invoice_id=inv.id,
            )
        acceptance.total_amount = total
        await acceptance.save()
    return acceptance


async def confirm_material_acceptance(tenant_id: int, acceptance_id: int) -> HaoligoFinanceMaterialAcceptance:
    acceptance = await HaoligoFinanceMaterialAcceptance.filter(
        tenant_id=tenant_id, id=acceptance_id, deleted_at__isnull=True
    ).first()
    if not acceptance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="验收单不存在")
    if acceptance.status != FINANCE_ACCEPTANCE_STATUS_DRAFT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅草稿验收单可确认")

    links = await HaoligoFinanceAcceptanceInvoice.filter(
        tenant_id=tenant_id, acceptance_id=acceptance.id, deleted_at__isnull=True
    ).all()
    invoice_ids = [lk.invoice_id for lk in links]

    async with in_transaction():
        acceptance.status = FINANCE_ACCEPTANCE_STATUS_CONFIRMED
        if not acceptance.acceptance_date:
            acceptance.acceptance_date = _today()
        await acceptance.save()
        if invoice_ids:
            await HaoligoFinanceInvoice.filter(
                tenant_id=tenant_id, id__in=invoice_ids, deleted_at__isnull=True
            ).update(status=FINANCE_INVOICE_STATUS_ACCEPTED)
    return acceptance


async def ensure_invoices_verified(tenant_id: int, invoice_ids: list[int]) -> None:
    for inv_id in invoice_ids:
        inv = await HaoligoFinanceInvoice.filter(
            tenant_id=tenant_id, id=inv_id, deleted_at__isnull=True
        ).first()
        if not inv:
            continue
        await verify_invoice_lines(tenant_id, inv)
