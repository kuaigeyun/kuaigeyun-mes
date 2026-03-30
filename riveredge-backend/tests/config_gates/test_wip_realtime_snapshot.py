import sys
import types
from datetime import datetime, timedelta
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaicaiwu.services.management_report_service import ManagementReportService


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
async def test_get_wip_valuation_uses_work_order_cost_and_progress(monkeypatch):
    service = ManagementReportService()
    now = datetime.now()

    active_orders = [
        types.SimpleNamespace(
            id=1,
            code="WO-001",
            product_id=11,
            product_code="P-11",
            product_name="产品A",
            status="in_progress",
            quantity=Decimal("100"),
            completed_quantity=Decimal("40"),
            updated_at=now - timedelta(minutes=30),
        )
    ]
    reporting_rows = [
        types.SimpleNamespace(
            work_order_id=1,
            qualified_quantity=Decimal("30"),
            unqualified_quantity=Decimal("2"),
            work_hours=Decimal("8"),
            reported_at=now - timedelta(minutes=5),
        )
    ]
    latest_calc = types.SimpleNamespace(unit_cost=Decimal("12.50"), created_at=now - timedelta(minutes=10))

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.management_report_service.WorkOrder.filter",
        lambda **_kwargs: _AllQuery(active_orders),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.management_report_service.ReportingRecord.filter",
        lambda **_kwargs: _AllQuery(reporting_rows),
    )
    monkeypatch.setattr(
        "apps.kuaicaiwu.services.management_report_service.CostCalculation.filter",
        lambda **_kwargs: _LatestQuery(latest_calc),
    )

    result = await service.get_wip_valuation(tenant_id=1)

    assert result["active_work_orders_count"] == 1
    assert result["estimated_wip_value"] == 750.0  # (100 - 40) * 12.5
    assert result["realtime_visible_ratio"] == 1.0
    assert len(result["items"]) == 1
    assert result["items"][0]["wip_quantity"] == 60.0
    assert result["items"][0]["unit_cost"] == 12.5


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_wip_valuation_handles_empty_active_orders(monkeypatch):
    service = ManagementReportService()

    monkeypatch.setattr(
        "apps.kuaicaiwu.services.management_report_service.WorkOrder.filter",
        lambda **_kwargs: _AllQuery([]),
    )

    result = await service.get_wip_valuation(tenant_id=1)

    assert result["active_work_orders_count"] == 0
    assert result["estimated_wip_value"] == 0.0
    assert result["items"] == []
