"""税务属期工具：属期字符串、锁定检查。"""

from __future__ import annotations

from datetime import date
from typing import Optional

from apps.kuaicaiwu.models.accounting_period import AccountingPeriod
from apps.kuaicaiwu.models.tax_period_record import TaxPeriodRecord
from infra.exceptions.exceptions import BusinessLogicError, ValidationError


def tax_period_from_date(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def parse_tax_period(period: str) -> tuple[int, int]:
    raw = str(period or "").strip()
    if len(raw) != 7 or raw[4] != "-":
        raise ValidationError("属期格式须为 YYYY-MM")
    year = int(raw[:4])
    month = int(raw[5:7])
    if month < 1 or month > 12:
        raise ValidationError("属期月份无效")
    return year, month


class TaxPeriodService:
    async def get_or_create_record(
        self,
        tenant_id: int,
        year: int,
        month: int,
    ) -> TaxPeriodRecord:
        import uuid

        row = await TaxPeriodRecord.get_or_none(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            deleted_at__isnull=True,
        )
        if row:
            return row
        return await TaxPeriodRecord.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            period_year=year,
            period_month=month,
            locked=False,
        )

    async def is_period_locked(self, tenant_id: int, year: int, month: int) -> bool:
        record = await TaxPeriodRecord.get_or_none(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            deleted_at__isnull=True,
        )
        if record and record.locked:
            return True
        gl_period = await AccountingPeriod.get_or_none(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            deleted_at__isnull=True,
        )
        return bool(gl_period and gl_period.status == "closed")

    async def assert_period_editable(self, tenant_id: int, year: int, month: int) -> None:
        if await self.is_period_locked(tenant_id, year, month):
            raise BusinessLogicError(f"税务属期 {year:04d}-{month:02d} 已锁定，禁止修改")

    async def lock_period(
        self,
        tenant_id: int,
        year: int,
        month: int,
        operator_id: Optional[int] = None,
    ) -> TaxPeriodRecord:
        from core.utils.timezone_utils import resolve_business_datetime

        record = await self.get_or_create_record(tenant_id, year, month)
        record.locked = True
        record.locked_at = resolve_business_datetime()
        record.locked_by = operator_id
        await record.save()
        return record
