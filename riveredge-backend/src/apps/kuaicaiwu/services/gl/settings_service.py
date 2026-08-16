"""总账账套参数与开账。"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from apps.kuaicaiwu.models.gl_book_settings import GlBookSettings
from infra.exceptions.exceptions import ValidationError
from core.utils.timezone_utils import resolve_business_datetime, to_site_date


class GlSettingsService:
    async def get_or_create(self, tenant_id: int) -> GlBookSettings:
        row = await GlBookSettings.get_or_none(tenant_id=tenant_id, deleted_at__isnull=True)
        if row:
            return row
        today = to_site_date(resolve_business_datetime())
        return await GlBookSettings.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            current_year=today.year,
            current_month=today.month,
        )

    async def update_settings(self, tenant_id: int, data: Dict[str, Any]) -> GlBookSettings:
        row = await self.get_or_create(tenant_id)
        allowed = {
            "account_code_rule",
            "base_currency",
            "require_reviewer_different",
            "deficit_control",
            "allow_gl_entry_on_controlled",
            "cash_account_ids",
            "bank_account_ids",
            "enable_voucher_words",
            "require_transfer_before_close",
            "current_year",
            "current_month",
        }
        for key, value in data.items():
            if key in allowed:
                setattr(row, key, value)
        await row.save()
        return row

    async def finish_initialization(
        self,
        tenant_id: int,
        *,
        year: int,
        month: int,
        operator_id: int,
    ) -> GlBookSettings:
        from apps.kuaicaiwu.services.gl.period_service import GlPeriodService

        row = await self.get_or_create(tenant_id)
        if row.initialized:
            raise ValidationError("账套已开账，不可重复结束初始化")

        from apps.kuaicaiwu.services.gl.balance_service import BalanceService

        trial = await BalanceService().trial_balance(
            tenant_id, year, month, include_unposted=False
        )
        if not trial.get("balanced"):
            raise ValidationError("期初试算不平衡，禁止开账")

        period = await GlPeriodService().ensure_period(tenant_id, year, month, status="open")
        period.status = "open"
        period.closed_at = None
        period.closed_by = None
        await period.save()
        row.initialized = True
        row.current_year = year
        row.current_month = month
        await row.save()
        return row

    def to_dict(self, row: GlBookSettings) -> Dict[str, Any]:
        return {
            "id": row.id,
            "tenant_id": row.tenant_id,
            "account_code_rule": row.account_code_rule,
            "base_currency": row.base_currency,
            "require_reviewer_different": row.require_reviewer_different,
            "deficit_control": row.deficit_control,
            "allow_gl_entry_on_controlled": row.allow_gl_entry_on_controlled,
            "cash_account_ids": row.cash_account_ids or [],
            "bank_account_ids": row.bank_account_ids or [],
            "enable_voucher_words": getattr(row, "enable_voucher_words", True),
            "require_transfer_before_close": getattr(row, "require_transfer_before_close", False),
            "initialized": row.initialized,
            "current_year": row.current_year,
            "current_month": row.current_month,
        }
