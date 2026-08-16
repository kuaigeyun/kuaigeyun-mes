"""
会计期间关账服务：委托 GlPeriodService（期间实体为真源）。
保留旧入口兼容既有 API 路径。
"""

from __future__ import annotations

from typing import Any, Dict

from apps.kuaicaiwu.services.gl.period_service import GlPeriodService


class PeriodCloseService:
    def __init__(self):
        self._inner = GlPeriodService()

    async def is_period_close_enabled(self, tenant_id: int) -> bool:
        from apps.kuaicaiwu.services.gl.settings_service import GlSettingsService

        settings = await GlSettingsService().get_or_create(tenant_id)
        return bool(settings.initialized)

    async def assert_period_open(self, tenant_id: int, year: int, month: int) -> None:
        await self._inner.assert_period_open_for_posting(tenant_id, year, month)

    async def close_period(
        self,
        tenant_id: int,
        year: int,
        month: int,
        operator_id: int,
    ) -> Dict[str, Any]:
        return await self._inner.close_period(tenant_id, year, month, operator_id)

    async def get_period_status(self, tenant_id: int) -> Dict[str, Any]:
        return await self._inner.get_status(tenant_id)
