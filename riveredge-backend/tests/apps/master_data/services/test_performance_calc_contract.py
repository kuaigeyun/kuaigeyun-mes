"""绩效汇总：工时推导、周期边界、明细时间序列化契约。"""

import re
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

from apps.kuaizhizao.services.reporting_service import ReportingService
from apps.master_data.schemas.employee_performance_schemas import PerformanceDetailItem
from core.utils.timezone_utils import site_period_bounds_utc


def test_derive_work_hours_from_standard_time():
    op = MagicMock()
    op.standard_time = Decimal("0.5")
    wh = ReportingService._derive_work_hours_from_operation(
        op, Decimal("2"), Decimal("2")
    )
    assert wh == Decimal("1.00")


def test_site_period_bounds_utc_are_aware_and_ordered():
    start, end = site_period_bounds_utc("2026-08")
    assert start.tzinfo is not None
    assert end.tzinfo is not None
    assert start < end


def test_performance_detail_item_serializes_reported_at_without_iso_z():
    item = PerformanceDetailItem(
        reporting_record_id=1,
        work_order_code="WO-001",
        operation_name="装配",
        reported_at=datetime(2026, 8, 3, 5, 58, 4, 980000, tzinfo=timezone.utc),
        reported_quantity=Decimal("1"),
        qualified_quantity=Decimal("1"),
        unqualified_quantity=Decimal("0"),
        work_hours=Decimal("0.5"),
    )
    payload = item.model_dump(mode="json")
    reported_at = payload["reported_at"]
    assert "T" not in reported_at
    assert not reported_at.endswith("Z")
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}", reported_at)
