"""应交增值税属期台账汇总。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from apps.kuaicaiwu.models.invoice import Invoice
from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
from apps.kuaicaiwu.models.tax_period_record import TaxPeriodRecord
from apps.kuaicaiwu.services.tax.tax_constants import (
    TAXPAYER_SMALL_SCALE,
    VERIFICATION_CERTIFIED,
    VERIFICATION_TRANSFERRED_OUT,
)
from apps.kuaicaiwu.services.tax.tax_period_service import TaxPeriodService, tax_period_from_date
from apps.kuaicaiwu.services.tax.tax_settings_service import TaxSettingsService

_MONEY = Decimal("0.01")
_APPROVED_SALES = ("已审核",)
_VOID_SALES = ("已作废",)


def _d(v: Any) -> Decimal:
    return Decimal(str(v or 0)).quantize(_MONEY)


class VatLedgerService:
    def __init__(self) -> None:
        self.settings_service = TaxSettingsService()
        self.period_service = TaxPeriodService()

    async def summarize_period(
        self,
        tenant_id: int,
        year: int,
        month: int,
    ) -> Dict[str, Any]:
        settings = await self.settings_service.get_or_create(tenant_id)
        period_key = f"{year:04d}-{month:02d}"
        is_small = settings.taxpayer_type == TAXPAYER_SMALL_SCALE

        output_tax = Decimal("0")
        sales_q = Invoice.filter(
            tenant_id=tenant_id,
            category="OUT",
            tax_period=period_key,
            deleted_at__isnull=True,
        ).exclude(status__in=list(_VOID_SALES))
        for inv in await sales_q.all():
            if (inv.status or "").strip() not in _APPROVED_SALES:
                continue
            output_tax += _d(inv.tax_amount)

        input_tax = Decimal("0")
        transfer_out = Decimal("0")
        if not is_small:
            certified = PurchaseInvoice.filter(
                tenant_id=tenant_id,
                verification_status=VERIFICATION_CERTIFIED,
                verification_date__gte=f"{year:04d}-{month:02d}-01",
                verification_date__lte=f"{year:04d}-{month:02d}-31",
                deleted_at__isnull=True,
            )
            for inv in await certified.all():
                vdate = inv.verification_date
                if vdate and tax_period_from_date(vdate) == period_key:
                    input_tax += _d(inv.tax_amount)

            transferred = PurchaseInvoice.filter(
                tenant_id=tenant_id,
                verification_status=VERIFICATION_TRANSFERRED_OUT,
                verification_date__gte=f"{year:04d}-{month:02d}-01",
                verification_date__lte=f"{year:04d}-{month:02d}-31",
                deleted_at__isnull=True,
            )
            for inv in await transferred.all():
                vdate = inv.verification_date
                if vdate and tax_period_from_date(vdate) == period_key:
                    transfer_out += _d(inv.tax_amount)

        if is_small:
            tax_payable = output_tax
        else:
            tax_payable = (output_tax - input_tax + transfer_out).quantize(_MONEY)

        sur = settings.surcharge_rates or {}
        uc_rate = Decimal(str(sur.get("urban_construction", 7))) / Decimal("100")
        ed_rate = Decimal(str(sur.get("education", 3))) / Decimal("100")
        le_rate = Decimal(str(sur.get("local_education", 2))) / Decimal("100")
        base = max(tax_payable, Decimal("0"))
        urban = (base * uc_rate).quantize(_MONEY)
        education = (base * ed_rate).quantize(_MONEY)
        local_ed = (base * le_rate).quantize(_MONEY)

        record = await TaxPeriodRecord.get_or_none(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            deleted_at__isnull=True,
        )
        locked = await self.period_service.is_period_locked(tenant_id, year, month)

        return {
            "period_year": year,
            "period_month": month,
            "tax_period": period_key,
            "taxpayer_type": settings.taxpayer_type,
            "output_tax": float(output_tax),
            "input_tax": float(input_tax),
            "transfer_out": float(transfer_out),
            "tax_payable": float(tax_payable),
            "surcharge_urban": float(urban),
            "surcharge_education": float(education),
            "surcharge_local_education": float(local_ed),
            "surcharge_total": float((urban + education + local_ed).quantize(_MONEY)),
            "locked": locked,
            "vat_transfer_voucher_id": getattr(record, "vat_transfer_voucher_id", None),
            "surcharge_voucher_id": getattr(record, "surcharge_voucher_id", None),
        }

    async def list_drill_invoices(
        self,
        tenant_id: int,
        year: int,
        month: int,
        *,
        kind: str,
        skip: int = 0,
        limit: int = 50,
    ) -> Dict[str, Any]:
        period_key = f"{year:04d}-{month:02d}"
        items: List[Dict[str, Any]] = []
        total = 0

        if kind == "output":
            q = Invoice.filter(
                tenant_id=tenant_id,
                category="OUT",
                tax_period=period_key,
                status__in=list(_APPROVED_SALES),
                deleted_at__isnull=True,
            ).exclude(status__in=list(_VOID_SALES))
            total = await q.count()
            for inv in await q.offset(skip).limit(limit).order_by("-invoice_date").all():
                items.append(self._serialize_sales(inv))
        elif kind == "input":
            q = PurchaseInvoice.filter(
                tenant_id=tenant_id,
                verification_status=VERIFICATION_CERTIFIED,
                deleted_at__isnull=True,
            )
            rows = await q.order_by("-verification_date").all()
            filtered = [
                r
                for r in rows
                if r.verification_date and tax_period_from_date(r.verification_date) == period_key
            ]
            total = len(filtered)
            for inv in filtered[skip : skip + limit]:
                items.append(self._serialize_purchase(inv))
        elif kind == "transfer_out":
            q = PurchaseInvoice.filter(
                tenant_id=tenant_id,
                verification_status=VERIFICATION_TRANSFERRED_OUT,
                deleted_at__isnull=True,
            )
            rows = await q.order_by("-verification_date").all()
            filtered = [
                r
                for r in rows
                if r.verification_date and tax_period_from_date(r.verification_date) == period_key
            ]
            total = len(filtered)
            for inv in filtered[skip : skip + limit]:
                items.append(self._serialize_purchase(inv))
        else:
            return {"items": [], "total": 0, "skip": skip, "limit": limit}

        return {"items": items, "total": total, "skip": skip, "limit": limit}

    @staticmethod
    def _serialize_sales(inv: Invoice) -> Dict[str, Any]:
        return {
            "source": "sales",
            "id": inv.id,
            "invoice_code": inv.invoice_code,
            "invoice_number": inv.invoice_number,
            "partner_name": inv.partner_name,
            "invoice_date": str(inv.invoice_date),
            "tax_period": inv.tax_period,
            "invoice_type": inv.invoice_type,
            "invoice_color": getattr(inv, "invoice_color", "blue"),
            "tax_amount": float(inv.tax_amount or 0),
            "total_amount": float(inv.total_amount or 0),
            "status": inv.status,
        }

    @staticmethod
    def _serialize_purchase(inv: PurchaseInvoice) -> Dict[str, Any]:
        return {
            "source": "purchase",
            "id": inv.id,
            "invoice_code": inv.invoice_code,
            "invoice_number": inv.invoice_number,
            "partner_name": inv.supplier_name,
            "invoice_date": str(inv.invoice_date),
            "tax_period": inv.tax_period,
            "verification_status": inv.verification_status,
            "verification_date": str(inv.verification_date) if inv.verification_date else None,
            "transfer_out_reason": inv.transfer_out_reason,
            "tax_amount": float(inv.tax_amount or 0),
            "total_amount": float(inv.total_amount or 0),
            "status": inv.status,
        }
