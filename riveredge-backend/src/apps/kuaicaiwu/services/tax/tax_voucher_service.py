"""税金计提凭证：增值税结转与附加税计提。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional

from tortoise.transactions import in_transaction

from apps.kuaicaiwu.models.tax_period_record import TaxPeriodRecord
from apps.kuaicaiwu.services.posting_service import PostingService
from apps.kuaicaiwu.services.tax.tax_period_service import TaxPeriodService
from apps.kuaicaiwu.services.tax.tax_settings_service import TaxSettingsService
from apps.kuaicaiwu.services.tax.vat_ledger_service import VatLedgerService
from core.utils.timezone_utils import resolve_business_datetime, to_site_date
from infra.exceptions.exceptions import BusinessLogicError, ValidationError


def _money(v: float) -> Decimal:
    return Decimal(str(v)).quantize(Decimal("0.01"))


class TaxVoucherService:
    def __init__(self) -> None:
        self.ledger_service = VatLedgerService()
        self.settings_service = TaxSettingsService()
        self.period_service = TaxPeriodService()
        self.posting_service = PostingService()

    async def _get_record(self, tenant_id: int, year: int, month: int) -> TaxPeriodRecord:
        return await self.period_service.get_or_create_record(tenant_id, year, month)

    async def generate_vat_transfer_voucher(
        self,
        tenant_id: int,
        year: int,
        month: int,
        operator_id: int,
    ) -> Dict[str, Any]:
        if await self.period_service.is_period_locked(tenant_id, year, month):
            raise BusinessLogicError(f"属期 {year:04d}-{month:02d} 已锁定")

        record = await self._get_record(tenant_id, year, month)
        if record.vat_transfer_voucher_id:
            raise ValidationError("该属期增值税结转凭证已存在")

        summary = await self.ledger_service.summarize_period(tenant_id, year, month)
        output_tax = _money(summary["output_tax"])
        input_tax = _money(summary["input_tax"])
        transfer_out = _money(summary["transfer_out"])

        if output_tax == 0 and input_tax == 0 and transfer_out == 0:
            raise ValidationError("该属期无增值税发生额，无需结转")

        out_id = await self.settings_service.require_account_id(tenant_id, "output_vat", label="销项税额")
        in_id = await self.settings_service.require_account_id(tenant_id, "input_vat", label="进项税额")
        to_id = await self.settings_service.require_account_id(
            tenant_id, "transfer_unpaid_vat", label="转出未交增值税"
        )
        tout_id = await self.settings_service.require_account_id(
            tenant_id, "input_transfer_out", label="进项税额转出"
        )

        period_label = f"{year:04d}年{month:02d}月"
        lines: list[Dict[str, Any]] = []
        if output_tax > 0:
            lines.append(
                {"account_id": to_id, "summary": f"{period_label}结转销项税额", "debit_amount": float(output_tax), "credit_amount": 0}
            )
            lines.append(
                {"account_id": out_id, "summary": f"{period_label}结转销项税额", "debit_amount": 0, "credit_amount": float(output_tax)}
            )
        if input_tax > 0:
            lines.append(
                {"account_id": in_id, "summary": f"{period_label}结转进项税额", "debit_amount": float(input_tax), "credit_amount": 0}
            )
            lines.append(
                {"account_id": to_id, "summary": f"{period_label}结转进项税额", "debit_amount": 0, "credit_amount": float(input_tax)}
            )
        if transfer_out > 0:
            lines.append(
                {"account_id": to_id, "summary": f"{period_label}结转进项转出", "debit_amount": float(transfer_out), "credit_amount": 0}
            )
            lines.append(
                {"account_id": tout_id, "summary": f"{period_label}结转进项转出", "debit_amount": 0, "credit_amount": float(transfer_out)}
            )

        if len(lines) < 2:
            raise ValidationError("凭证分录不足")

        voucher_date = to_site_date(resolve_business_datetime())
        async with in_transaction():
            voucher = await self.posting_service.create_manual_voucher(
                tenant_id,
                operator_id,
                {
                    "voucher_word": "转",
                    "voucher_date": voucher_date.isoformat(),
                    "period_year": year,
                    "period_month": month,
                    "summary": f"{period_label}增值税结转",
                    "lines": lines,
                },
                allow_controlled=True,
            )
            record.vat_transfer_voucher_id = voucher.id
            await record.save()

        return {"voucher_id": voucher.id, "voucher_code": voucher.voucher_code}

    async def generate_surcharge_voucher(
        self,
        tenant_id: int,
        year: int,
        month: int,
        operator_id: int,
    ) -> Dict[str, Any]:
        if await self.period_service.is_period_locked(tenant_id, year, month):
            raise BusinessLogicError(f"属期 {year:04d}-{month:02d} 已锁定")

        record = await self._get_record(tenant_id, year, month)
        if record.surcharge_voucher_id:
            raise ValidationError("该属期附加税计提凭证已存在")

        summary = await self.ledger_service.summarize_period(tenant_id, year, month)
        urban = _money(summary["surcharge_urban"])
        education = _money(summary["surcharge_education"])
        local_ed = _money(summary["surcharge_local_education"])
        total = urban + education + local_ed
        if total <= 0:
            raise ValidationError("该属期无附加税计提金额")

        expense_id = await self.settings_service.require_account_id(
            tenant_id, "tax_surcharge_expense", label="税金及附加"
        )
        uc_id = await self.settings_service.require_account_id(
            tenant_id, "urban_construction", label="城建税"
        )
        ed_id = await self.settings_service.require_account_id(
            tenant_id, "education", label="教育费附加"
        )
        le_id = await self.settings_service.require_account_id(
            tenant_id, "local_education", label="地方教育附加"
        )

        period_label = f"{year:04d}年{month:02d}月"
        lines: list[Dict[str, Any]] = [
            {
                "account_id": expense_id,
                "summary": f"{period_label}计提附加税",
                "debit_amount": float(total),
                "credit_amount": 0,
            }
        ]
        if urban > 0:
            lines.append(
                {"account_id": uc_id, "summary": f"{period_label}城建税", "debit_amount": 0, "credit_amount": float(urban)}
            )
        if education > 0:
            lines.append(
                {"account_id": ed_id, "summary": f"{period_label}教育费附加", "debit_amount": 0, "credit_amount": float(education)}
            )
        if local_ed > 0:
            lines.append(
                {"account_id": le_id, "summary": f"{period_label}地方教育附加", "debit_amount": 0, "credit_amount": float(local_ed)}
            )

        voucher_date = to_site_date(resolve_business_datetime())
        async with in_transaction():
            voucher = await self.posting_service.create_manual_voucher(
                tenant_id,
                operator_id,
                {
                    "voucher_word": "转",
                    "voucher_date": voucher_date.isoformat(),
                    "period_year": year,
                    "period_month": month,
                    "summary": f"{period_label}附加税计提",
                    "lines": lines,
                },
                allow_controlled=True,
            )
            record.surcharge_voucher_id = voucher.id
            await record.save()

        return {"voucher_id": voucher.id, "voucher_code": voucher.voucher_code}

    async def lock_tax_period(
        self,
        tenant_id: int,
        year: int,
        month: int,
        operator_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        record = await self.period_service.lock_period(tenant_id, year, month, operator_id)
        return {"locked": True, "period_year": record.period_year, "period_month": record.period_month}
