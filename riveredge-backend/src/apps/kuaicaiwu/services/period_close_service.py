"""
会计期间关账服务（功能开关控制）。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from infra.exceptions.exceptions import BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class PeriodCloseService:
    async def is_period_close_enabled(self, tenant_id: int) -> bool:
        cfg = await BusinessConfigService().get_business_config(tenant_id)
        fin = cfg.get("parameters", {}).get("finance", {}) or {}
        return bool(fin.get("gl_period_close_enabled", False))

    async def assert_period_open(self, tenant_id: int, year: int, month: int) -> None:
        if not await self.is_period_close_enabled(tenant_id):
            return
        closed = await self._get_closed_periods(tenant_id)
        key = f"{year:04d}-{month:02d}"
        if key in closed:
            raise BusinessLogicError(f"会计期间 {key} 已关账，禁止过账")

    async def _get_closed_periods(self, tenant_id: int) -> List[str]:
        cfg = await BusinessConfigService().get_business_config(tenant_id)
        fin = cfg.get("parameters", {}).get("finance", {}) or {}
        raw = fin.get("gl_closed_periods") or []
        return [str(x) for x in raw]

    async def close_period(
        self,
        tenant_id: int,
        year: int,
        month: int,
        operator_id: int,
    ) -> Dict[str, Any]:
        if not await self.is_period_close_enabled(tenant_id):
            raise BusinessLogicError("总账关账功能未启用，请在业务配置中开启 gl_period_close_enabled")

        key = f"{year:04d}-{month:02d}"
        closed = await self._get_closed_periods(tenant_id)
        if key in closed:
            return {"period": key, "status": "already_closed"}

        closed.append(key)
        svc = BusinessConfigService()
        await svc.update_process_parameter(
            tenant_id=tenant_id,
            category="finance",
            parameter_key="gl_closed_periods",
            value=closed,
        )
        return {"period": key, "status": "closed", "closed_by": operator_id}

    async def get_period_status(self, tenant_id: int) -> Dict[str, Any]:
        enabled = await self.is_period_close_enabled(tenant_id)
        closed = await self._get_closed_periods(tenant_id) if enabled else []
        return {
            "gl_period_close_enabled": enabled,
            "closed_periods": closed,
        }
