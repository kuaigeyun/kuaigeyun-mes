"""采购发票进项认证、转出与红冲。"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.transactions import in_transaction

from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
from apps.kuaicaiwu.services.finance_tax import compute_tax_from_excluding
from apps.kuaicaiwu.services.tax.tax_constants import (
    TAXPAYER_SMALL_SCALE,
    VERIFICATION_CERTIFIED,
    VERIFICATION_NOT_DEDUCTIBLE,
    VERIFICATION_PENDING,
    VERIFICATION_TRANSFERRED_OUT,
)
from apps.kuaicaiwu.services.tax.tax_period_service import TaxPeriodService, tax_period_from_date
from apps.kuaicaiwu.services.tax.tax_settings_service import TaxSettingsService
from apps.common.base_service import AppBaseService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str, to_site_date
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PurchaseInvoiceTaxService:
    def __init__(self) -> None:
        self.settings_service = TaxSettingsService()
        self.period_service = TaxPeriodService()
        self._base = AppBaseService(PurchaseInvoice)

    async def _default_verification_status(self, tenant_id: int) -> str:
        settings = await self.settings_service.get_or_create(tenant_id)
        if settings.taxpayer_type == TAXPAYER_SMALL_SCALE:
            return VERIFICATION_NOT_DEDUCTIBLE
        return VERIFICATION_PENDING

    async def apply_tax_fields_on_create(
        self,
        tenant_id: int,
        invoice_date: date,
    ) -> Dict[str, Any]:
        return {
            "tax_period": tax_period_from_date(invoice_date),
            "verification_status": await self._default_verification_status(tenant_id),
        }

    async def _get_invoice(self, tenant_id: int, invoice_id: int) -> PurchaseInvoice:
        row = await PurchaseInvoice.get_or_none(
            tenant_id=tenant_id, id=invoice_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"采购发票不存在: {invoice_id}")
        return row

    async def _assert_editable(self, tenant_id: int, inv: PurchaseInvoice) -> None:
        vdate = inv.verification_date
        if vdate:
            await self.period_service.assert_period_editable(
                tenant_id, vdate.year, vdate.month
            )
        if inv.tax_period:
            try:
                y, m = int(inv.tax_period[:4]), int(inv.tax_period[5:7])
                await self.period_service.assert_period_editable(tenant_id, y, m)
            except (ValueError, IndexError):
                pass

    async def certify(
        self,
        tenant_id: int,
        invoice_id: int,
        *,
        verification_date: Optional[date] = None,
    ) -> PurchaseInvoice:
        settings = await self.settings_service.get_or_create(tenant_id)
        if settings.taxpayer_type == TAXPAYER_SMALL_SCALE:
            raise ValidationError("小规模纳税人不进行进项抵扣认证")

        inv = await self._get_invoice(tenant_id, invoice_id)
        if (inv.status or "").strip() != "已审核":
            raise ValidationError("仅已审核发票可认证")
        if inv.verification_status not in (VERIFICATION_PENDING,):
            raise ValidationError("当前状态不可认证")
        if getattr(inv, "original_invoice_id", None):
            raise ValidationError("红字发票不可认证")

        cert_date = verification_date or to_site_date(resolve_business_datetime())
        await self.period_service.assert_period_editable(
            tenant_id, cert_date.year, cert_date.month
        )

        inv.verification_status = VERIFICATION_CERTIFIED
        inv.verification_date = cert_date
        await inv.save()
        return inv

    async def batch_certify(
        self,
        tenant_id: int,
        invoice_ids: List[int],
        *,
        verification_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        certified: List[int] = []
        errors: List[Dict[str, Any]] = []
        for iid in invoice_ids:
            try:
                await self.certify(tenant_id, iid, verification_date=verification_date)
                certified.append(iid)
            except Exception as exc:  # noqa: BLE001 — 批量逐条收集
                errors.append({"id": iid, "message": str(exc)})
        return {"certified": certified, "errors": errors}

    async def transfer_out(
        self,
        tenant_id: int,
        invoice_id: int,
        reason: str,
        *,
        verification_date: Optional[date] = None,
    ) -> PurchaseInvoice:
        reason = (reason or "").strip()
        if not reason:
            raise ValidationError("须填写转出原因")

        inv = await self._get_invoice(tenant_id, invoice_id)
        if inv.verification_status != VERIFICATION_CERTIFIED:
            raise ValidationError("仅已认证发票可转出")

        cert_date = verification_date or inv.verification_date or to_site_date(resolve_business_datetime())
        await self.period_service.assert_period_editable(
            tenant_id, cert_date.year, cert_date.month
        )

        inv.verification_status = VERIFICATION_TRANSFERRED_OUT
        inv.transfer_out_reason = reason
        inv.verification_date = cert_date
        await inv.save()
        return inv

    async def create_red_flush(
        self,
        tenant_id: int,
        invoice_id: int,
        reason: str,
        *,
        created_by: int,
    ) -> PurchaseInvoice:
        reason = (reason or "").strip()
        if not reason:
            raise ValidationError("须填写红冲原因")

        async with in_transaction():
            orig = await self._get_invoice(tenant_id, invoice_id)
            if getattr(orig, "original_invoice_id", None):
                raise ValidationError("红字发票不能再红冲")
            if (orig.status or "").strip() != "已审核":
                raise ValidationError("仅已审核的蓝字发票可红冲")
            if getattr(orig, "red_flush_invoice_id", None):
                raise ValidationError("该发票已关联红字发票")

            await self._assert_editable(tenant_id, orig)

            excl = Decimal(orig.invoice_amount or 0)
            tax = Decimal(orig.tax_amount or 0)
            tot = Decimal(orig.total_amount or 0)
            neg_excl, neg_tax, neg_tot = -excl, -tax, -tot

            code = await self._base.generate_code(
                tenant_id, "PURCHASE_INVOICE_CODE", prefix=f"PI{today_site_str()}"
            )

            red = await PurchaseInvoice.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                invoice_code=code,
                purchase_order_id=orig.purchase_order_id,
                purchase_order_code=orig.purchase_order_code,
                supplier_id=orig.supplier_id,
                supplier_name=orig.supplier_name,
                invoice_number=f"红-{orig.invoice_number}",
                invoice_date=orig.invoice_date,
                invoice_type=orig.invoice_type,
                tax_period=orig.tax_period,
                tax_rate=orig.tax_rate,
                invoice_amount=neg_excl,
                tax_amount=neg_tax,
                total_amount=neg_tot,
                status="未审核",
                review_status="草稿",
                payable_id=orig.payable_id,
                payable_code=orig.payable_code,
                notes=f"红冲原发票#{orig.id}（{orig.invoice_code}）：{reason}",
                verification_status=VERIFICATION_NOT_DEDUCTIBLE,
                original_invoice_id=orig.id,
                created_by=created_by,
            )

            orig.red_flush_invoice_id = red.id
            await orig.save()
            return red
