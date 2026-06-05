"""保养提醒评估逻辑单元测试。"""

from datetime import datetime, timezone
from decimal import Decimal

from apps.haoligo.services.maintenance_reminder_eval import (
    evaluate_equipment_reminder,
    evaluate_mold_reminder,
    is_actionable_equipment,
    is_actionable_mold,
)


def test_equipment_setup_no_cycle_when_tracking_without_cycle():
    ev = evaluate_equipment_reminder(
        asset_code="EQ-01",
        operational_status="running",
        maintenance_cycle_by_yield=None,
        maintenance_cycle_by_days=None,
        used_yield=Decimal("10"),
        last_upkeep_by_equipment={},
    )
    assert ev is not None
    assert ev.reminder_kind == "setup_no_cycle"
    assert is_actionable_equipment(ev)


def test_equipment_setup_no_baseline_when_cycle_without_upkeep():
    ev = evaluate_equipment_reminder(
        asset_code="EQ-02",
        operational_status="running",
        maintenance_cycle_by_yield=Decimal("100"),
        maintenance_cycle_by_days=None,
        used_yield=Decimal("50"),
        last_upkeep_by_equipment={},
    )
    assert ev is not None
    assert ev.reminder_kind == "setup_no_baseline"
    assert is_actionable_equipment(ev)


def test_equipment_days_dimension_without_used_yield():
    last = datetime(2020, 1, 1, tzinfo=timezone.utc)
    ev = evaluate_equipment_reminder(
        asset_code="EQ-03",
        operational_status="running",
        maintenance_cycle_by_yield=Decimal("1000"),
        maintenance_cycle_by_days=30,
        used_yield=Decimal("0"),
        last_upkeep_by_equipment={"EQ-03": last},
    )
    assert ev is not None
    assert ev.reminder_kind == "cycle_plan"
    assert ev.dominant_dimension == "days"
    assert ev.alert_level in ("critical", "warning")


def test_mold_dual_max_uses_total_manufacture_qty():
    last = datetime(2024, 6, 1, tzinfo=timezone.utc)
    ev = evaluate_mold_reminder(
        mold_code="M-01",
        status="在用",
        maintenance_cycle_by_yield=Decimal("100"),
        used_yield=Decimal("10"),
        total_manufacture_qty=Decimal("95"),
        usable_yield=Decimal("200"),
        last_upkeep_by_mold={"M-01": last},
    )
    assert ev is not None
    assert ev.reminder_kind == "cycle_plan"
    assert ev.dominant_dimension == "yield_total"
    assert ev.alert_level == "warning"
    assert is_actionable_mold(ev)


def test_mold_manual_maintenance_status():
    ev = evaluate_mold_reminder(
        mold_code="M-02",
        status="保养",
        maintenance_cycle_by_yield=Decimal("100"),
        used_yield=Decimal("0"),
        total_manufacture_qty=Decimal("0"),
        usable_yield=None,
        last_upkeep_by_mold={},
    )
    assert ev is not None
    assert ev.reminder_kind == "manual_maintenance"
    assert is_actionable_mold(ev)
