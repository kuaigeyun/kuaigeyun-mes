"""会计期间：开账/结账/反结账（期间实体为真源）。"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from apps.kuaicaiwu.models.accounting_period import AccountingPeriod
from apps.kuaicaiwu.models.voucher import Voucher
from apps.kuaicaiwu.services.gl.settings_service import GlSettingsService
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from core.utils.timezone_utils import resolve_business_datetime


class GlPeriodService:
    async def list_periods(self, tenant_id: int, year: Optional[int] = None) -> List[AccountingPeriod]:
        q = AccountingPeriod.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if year:
            q = q.filter(period_year=year)
        return await q.order_by("period_year", "period_month").all()

    async def ensure_period(self, tenant_id: int, year: int, month: int, *, status: str = "open") -> AccountingPeriod:
        row = await AccountingPeriod.get_or_none(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            deleted_at__isnull=True,
        )
        if row:
            return row
        return await AccountingPeriod.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            period_year=year,
            period_month=month,
            status=status,
        )

    async def assert_period_open_for_posting(self, tenant_id: int, year: int, month: int) -> None:
        settings = await GlSettingsService().get_or_create(tenant_id)
        if not settings.initialized:
            raise BusinessLogicError("账套尚未开账，禁止记账")
        period = await AccountingPeriod.get_or_none(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            deleted_at__isnull=True,
        )
        if not period:
            raise BusinessLogicError(f"会计期间 {year:04d}-{month:02d} 不存在")
        if period.status == "closed":
            raise BusinessLogicError(f"会计期间 {year:04d}-{month:02d} 已结账，禁止记账")
        if period.status != "open":
            raise BusinessLogicError(f"会计期间 {year:04d}-{month:02d} 未打开，禁止记账")

        # 上月未结账则本月不可记账（开账月无上月期间则跳过）
        prev_year, prev_month = (year - 1, 12) if month == 1 else (year, month - 1)
        prev = await AccountingPeriod.get_or_none(
            tenant_id=tenant_id,
            period_year=prev_year,
            period_month=prev_month,
            deleted_at__isnull=True,
        )
        if prev and prev.status != "closed":
            raise BusinessLogicError(f"上月 {prev_year:04d}-{prev_month:02d} 未结账，本月不可记账")

    async def close_period(
        self,
        tenant_id: int,
        year: int,
        month: int,
        operator_id: int,
        *,
        skip_checks: bool = False,
    ) -> Dict[str, Any]:
        period = await AccountingPeriod.get_or_none(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            deleted_at__isnull=True,
        )
        if not period:
            raise NotFoundError(f"会计期间不存在: {year:04d}-{month:02d}")
        if period.status == "closed":
            return {"period": f"{year:04d}-{month:02d}", "status": "already_closed"}

        if not skip_checks:
            checks = await self.pre_close_checks(tenant_id, year, month)
            if not checks["ok"]:
                raise ValidationError(f"结账前检查未通过: {'; '.join(checks['errors'])}")

        period.status = "closed"
        period.closed_at = resolve_business_datetime()
        period.closed_by = operator_id
        await period.save()

        settings = await GlSettingsService().get_or_create(tenant_id)
        next_year, next_month = (year + 1, 1) if month == 12 else (year, month + 1)
        await self.ensure_period(tenant_id, next_year, next_month, status="open")
        settings.current_year = next_year
        settings.current_month = next_month
        await settings.save()

        # 结转下期初：由余额服务在结账时滚动
        from apps.kuaicaiwu.services.gl.balance_service import BalanceService

        await BalanceService().roll_opening_to_next(tenant_id, year, month, next_year, next_month)

        return {
            "period": f"{year:04d}-{month:02d}",
            "status": "closed",
            "next_period": f"{next_year:04d}-{next_month:02d}",
            "closed_by": operator_id,
        }

    async def reopen_period(self, tenant_id: int, year: int, month: int, operator_id: int) -> Dict[str, Any]:
        period = await AccountingPeriod.get_or_none(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            deleted_at__isnull=True,
        )
        if not period:
            raise NotFoundError(f"会计期间不存在: {year:04d}-{month:02d}")
        if period.status != "closed":
            raise ValidationError("仅已结账期间可反结账")

        # 仅允许反结最近已结期间：下一期间尚无已记账凭证
        next_year, next_month = (year + 1, 1) if month == 12 else (year, month + 1)
        posted_next = await Voucher.filter(
            tenant_id=tenant_id,
            period_year=next_year,
            period_month=next_month,
            status="posted",
            deleted_at__isnull=True,
        ).exists()
        if posted_next:
            raise ValidationError("下一期间已有记账凭证，禁止反结账")

        period.status = "open"
        period.closed_at = None
        period.closed_by = None
        await period.save()

        settings = await GlSettingsService().get_or_create(tenant_id)
        settings.current_year = year
        settings.current_month = month
        await settings.save()

        nxt = await AccountingPeriod.get_or_none(
            tenant_id=tenant_id,
            period_year=next_year,
            period_month=next_month,
            deleted_at__isnull=True,
        )
        if nxt and nxt.status == "open":
            nxt.status = "not_open"
            await nxt.save()

        return {"period": f"{year:04d}-{month:02d}", "status": "open", "reopened_by": operator_id}

    async def pre_close_checks(self, tenant_id: int, year: int, month: int) -> Dict[str, Any]:
        errors: List[str] = []
        unposted = await Voucher.filter(
            tenant_id=tenant_id,
            period_year=year,
            period_month=month,
            status__in=["draft", "reviewed"],
            deleted_at__isnull=True,
        ).count()
        if unposted:
            errors.append(f"存在 {unposted} 张未记账凭证")

        from apps.kuaicaiwu.services.gl.balance_service import BalanceService

        trial = await BalanceService().trial_balance(tenant_id, year, month, include_unposted=False)
        if not trial.get("balanced"):
            errors.append("试算不平衡")

        return {"ok": len(errors) == 0, "errors": errors, "unposted_count": unposted}

    async def get_status(self, tenant_id: int) -> Dict[str, Any]:
        settings = await GlSettingsService().get_or_create(tenant_id)
        periods = await self.list_periods(tenant_id, settings.current_year)
        return {
            "initialized": settings.initialized,
            "current_year": settings.current_year,
            "current_month": settings.current_month,
            "periods": [
                {
                    "period_year": p.period_year,
                    "period_month": p.period_month,
                    "status": p.status,
                    "closed_at": p.closed_at.isoformat() if p.closed_at else None,
                    "closed_by": p.closed_by,
                }
                for p in periods
            ],
        }
