import sys
import types
from datetime import datetime, timedelta

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaicaiwu.services.cost_service import CostCalculationService


class _AllQuery:
    def __init__(self, rows):
        self._rows = rows

    async def all(self):
        return self._rows


class _LatestQuery:
    def __init__(self, row):
        self._row = row

    def order_by(self, *_args):
        return self

    async def first(self):
        return self._row


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_realtime_costs_only_recalculates_stale_work_orders(monkeypatch):
    service = CostCalculationService()
    now = datetime.now()

    reporting_rows = [
        types.SimpleNamespace(work_order_id=101, reported_at=now - timedelta(minutes=20)),
        types.SimpleNamespace(work_order_id=102, reported_at=now - timedelta(minutes=10)),
    ]
    picking_rows = []
    latest_calc_map = {
        101: types.SimpleNamespace(created_at=now - timedelta(hours=2)),   # stale -> refresh
        102: types.SimpleNamespace(created_at=now - timedelta(minutes=5)),  # fresh -> skip
    }
    refreshed_ids = []

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.cost_service.ReportingRecord.filter",
        lambda **_kwargs: _AllQuery(reporting_rows),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.cost_service.ProductionPicking.filter",
        lambda **_kwargs: _AllQuery(picking_rows),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.cost_service.CostCalculation.filter",
        lambda **kwargs: _LatestQuery(latest_calc_map.get(kwargs.get("work_order_id"))),
    )

    async def _fake_calculate(*, tenant_id, request, created_by):
        refreshed_ids.append(request.work_order_id)
        return types.SimpleNamespace(id=1)

    monkeypatch.setattr(service, "calculate_work_order_cost", _fake_calculate)

    result = await service.refresh_realtime_costs(
        tenant_id=1,
        created_by=99,
        lookback_hours=24,
        max_work_orders=50,
    )

    assert refreshed_ids == [101]
    assert result["candidate_count"] == 2
    assert result["refreshed_count"] == 1
    assert result["skipped_fresh_count"] == 1
    assert result["failed_count"] == 0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_refresh_realtime_costs_collects_failed_work_orders(monkeypatch):
    service = CostCalculationService()
    now = datetime.now()

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.cost_service.ReportingRecord.filter",
        lambda **_kwargs: _AllQuery([types.SimpleNamespace(work_order_id=201, reported_at=now)]),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.cost_service.ProductionPicking.filter",
        lambda **_kwargs: _AllQuery([]),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.cost_service.CostCalculation.filter",
        lambda **_kwargs: _LatestQuery(None),
    )

    async def _raise_error(*, tenant_id, request, created_by):
        raise RuntimeError("boom")

    monkeypatch.setattr(service, "calculate_work_order_cost", _raise_error)

    result = await service.refresh_realtime_costs(
        tenant_id=1,
        created_by=99,
        lookback_hours=24,
        max_work_orders=50,
    )

    assert result["refreshed_count"] == 0
    assert result["failed_count"] == 1
    assert result["failed_work_order_ids"] == [201]
