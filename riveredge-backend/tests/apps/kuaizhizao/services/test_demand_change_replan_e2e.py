"""需求变更重算：冻结期日历与审批门禁（内存桩）。"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.demand_replan_impact_service import DemandReplanImpactService
from apps.kuaizhizao.services.demand_replanning_orchestrator_service import (
    DemandReplanningOrchestratorService,
)
from infra.exceptions.exceptions import BusinessLogicError


def test_frozen_horizon_uses_site_calendar_not_server_local(monkeypatch):
    monkeypatch.setattr(
        "apps.kuaizhizao.services.demand_replan_impact_service.resolve_business_datetime",
        lambda: datetime(2026, 8, 15, 2, 0, tzinfo=timezone.utc),
    )
    monkeypatch.setattr(
        "apps.kuaizhizao.services.demand_replan_impact_service.to_site_date",
        lambda dt: dt.astimezone(timezone.utc).date(),
    )
    effective = datetime(2026, 8, 20, 2, 0, tzinfo=timezone.utc)
    assert DemandReplanImpactService._is_within_frozen_horizon(effective, frozen_days=7) is True
    far = datetime(2026, 9, 20, 2, 0, tzinfo=timezone.utc)
    assert DemandReplanImpactService._is_within_frozen_horizon(far, frozen_days=7) is False


def test_recomputable_status_constants():
    assert DemandReplanImpactService.filter_recomputable_computation_ids.__doc__
    from apps.kuaizhizao.services.demand_replan_impact_service import RECOMPUTABLE_COMPUTATION_STATUSES

    assert RECOMPUTABLE_COMPUTATION_STATUSES == frozenset({"完成", "失败"})


def test_execute_task_rejects_when_pending_approval_without_force(monkeypatch):
    svc = DemandReplanningOrchestratorService()
    task = SimpleNamespace(
        status="pending",
        approval_status="pending",
        task_code="RPLAN-1",
        task_scope={"computation_ids": [1]},
        approved_by=None,
        approved_at=None,
        approval_comment=None,
        event_id=1,
        mode="net_change",
    )

    async def _fake_get(*_args, **_kwargs):
        return task

    monkeypatch.setattr(
        "apps.kuaizhizao.services.demand_replanning_orchestrator_service.DemandReplanTask.get_or_none",
        _fake_get,
    )
    with pytest.raises(BusinessLogicError, match="需要审批"):
        asyncio.run(svc.execute_task(tenant_id=1, task_id=1, operator_id=1, force=False))
