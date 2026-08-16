"""LLC / 时间分桶净算单元测试"""

from datetime import date, timedelta
from decimal import Decimal

from apps.kuaizhizao.utils.mrp_llc_engine import (
    compare_planned_vs_open_supply,
    time_phased_net_material,
)


def test_time_phased_plans_order_on_shortage():
    today = date(2026, 7, 25)
    due = today + timedelta(days=10)
    result = time_phased_net_material(
        gross_by_date={due: 100},
        receipts_by_date={},
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=5,
        schedule_buffer_days=0,
        include_safety_stock=True,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
    )
    assert result["planned_order_qty"] == 100
    assert result["release_date"] == due - timedelta(days=5)
    assert result["receipt_date"] == due


def test_time_phased_parent_inventory_covers_demand():
    today = date(2026, 7, 25)
    due = today + timedelta(days=3)
    result = time_phased_net_material(
        gross_by_date={due: 10},
        receipts_by_date={},
        beginning_inventory=50,
        safety_stock=40,
        reorder_point=0,
        lead_time_days=0,
        schedule_buffer_days=0,
        include_safety_stock=True,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
    )
    assert result["planned_order_qty"] == 0


def test_time_phased_dated_receipt_reduces_net():
    today = date(2026, 7, 25)
    due = today + timedelta(days=7)
    result = time_phased_net_material(
        gross_by_date={due: 100},
        receipts_by_date={due: 40},
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=2,
        schedule_buffer_days=0,
        include_safety_stock=False,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
    )
    assert result["planned_order_qty"] == 60


def test_time_phased_lot_and_past_due_exception():
    today = date(2026, 7, 25)
    due = today + timedelta(days=1)

    def lot10(x: Decimal) -> Decimal:
        return ((x + Decimal("9")) // Decimal("10")) * Decimal("10")

    result = time_phased_net_material(
        gross_by_date={due: 12},
        receipts_by_date={today - timedelta(days=3): 5},
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=5,
        schedule_buffer_days=0,
        include_safety_stock=False,
        include_reorder_point=False,
        apply_lot_fn=lot10,
        today=today,
    )
    assert result["planned_order_qty"] == 10
    codes = {e["code"] for e in result["exceptions"]}
    assert "PAST_DUE_SUPPLY" in codes
    assert "PAST_DUE_START" in codes or "SHORTAGE_WITHIN_LEAD_TIME" in codes


def test_time_phased_work_calendar_release():
    today = date(2026, 7, 20)  # Mon
    due = date(2026, 7, 27)  # next Mon
    # 中间周末为非工作日
    holidays = {date(2026, 7, 25), date(2026, 7, 26)}
    result = time_phased_net_material(
        gross_by_date={due: 10},
        receipts_by_date={},
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=5,
        schedule_buffer_days=0,
        include_safety_stock=False,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
        holiday_dates=holidays,
        use_work_calendar=True,
    )
    # 5 个工作日回退：27←24←23←22←21←20
    assert result["release_date"] == date(2026, 7, 20)


def test_time_phased_firm_covers_and_frozen():
    today = date(2026, 7, 25)
    due = today + timedelta(days=5)
    result = time_phased_net_material(
        gross_by_date={due: 100},
        receipts_by_date={},
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=2,
        schedule_buffer_days=0,
        include_safety_stock=False,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
        firm_planned_orders=[{
            "qty": 100,
            "receipt_date": due,
            "release_date": today + timedelta(days=3),
            "firm": True,
        }],
        frozen=True,
    )
    assert result["planned_order_qty"] == 100
    assert all(po.get("firm") for po in result["planned_orders"])
    assert not any(not po.get("firm") for po in result["planned_orders"])


def test_time_phased_forward_release_from_today():
    today = date(2026, 7, 25)
    due = today + timedelta(days=10)
    result = time_phased_net_material(
        gross_by_date={due: 100},
        receipts_by_date={},
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=5,
        schedule_buffer_days=0,
        include_safety_stock=False,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
        schedule_direction="forward",
    )
    assert result["planned_order_qty"] == 100
    assert result["release_date"] == today
    assert result["receipt_date"] == today + timedelta(days=5)
    codes = {e["code"] for e in result["exceptions"]}
    assert "LATE_VS_DEMAND" not in codes


def test_time_phased_forward_late_vs_demand():
    today = date(2026, 7, 25)
    due = today + timedelta(days=2)
    result = time_phased_net_material(
        gross_by_date={due: 50},
        receipts_by_date={},
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=5,
        schedule_buffer_days=0,
        include_safety_stock=False,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
        schedule_direction="forward",
    )
    assert result["release_date"] == today
    assert result["receipt_date"] == today + timedelta(days=5)
    codes = {e["code"] for e in result["exceptions"]}
    assert "LATE_VS_DEMAND" in codes


def test_open_supply_covers_demand_no_new_order():
    today = date(2026, 7, 25)
    due = today + timedelta(days=10)
    open_supplies = [{"date": due, "qty": 100, "document_id": 1, "document_code": "PO001"}]
    result = time_phased_net_material(
        gross_by_date={due: 100},
        receipts_by_date={due: 100},
        open_supplies=open_supplies,
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=2,
        schedule_buffer_days=0,
        include_safety_stock=False,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
    )
    codes = {e["code"] for e in result["exceptions"]}
    assert "NEW_ORDER" not in codes
    assert result["planned_order_qty"] == 0


def test_late_open_supply_reschedule_in():
    today = date(2026, 7, 25)
    due = today + timedelta(days=10)
    supply_date = today + timedelta(days=15)
    open_supplies = [{"date": supply_date, "qty": 100, "document_id": 1, "document_code": "PO001"}]
    result = time_phased_net_material(
        gross_by_date={due: 100},
        receipts_by_date={supply_date: 100},
        open_supplies=open_supplies,
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=2,
        schedule_buffer_days=0,
        include_safety_stock=False,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
    )
    codes = {e["code"] for e in result["exceptions"]}
    assert "RESCHEDULE_IN" in codes
    assert result["planned_order_qty"] > 0


def test_early_open_supply_without_demand_cancel():
    today = date(2026, 7, 25)
    supply_date = today + timedelta(days=20)
    open_supplies = [{"date": supply_date, "qty": 50, "document_id": 2, "document_code": "WO001"}]
    result = time_phased_net_material(
        gross_by_date={},
        receipts_by_date={supply_date: 50},
        open_supplies=open_supplies,
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=2,
        schedule_buffer_days=0,
        include_safety_stock=False,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
        planning_fence_days=0,
    )
    codes = {e["code"] for e in result["exceptions"]}
    assert "CANCEL_SUPPLY" in codes


def test_planning_fence_auto_firms_new_plans():
    today = date(2026, 7, 25)
    due = today + timedelta(days=5)
    result = time_phased_net_material(
        gross_by_date={due: 100},
        receipts_by_date={},
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=5,
        schedule_buffer_days=0,
        include_safety_stock=False,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
        planning_fence_days=7,
    )
    assert result["planned_order_qty"] == 100
    assert result["planned_orders"]
    assert all(po.get("firm") for po in result["planned_orders"])
    assert not any(not po.get("firm") for po in result["planned_orders"])


def test_frozen_shortage_no_new_plans_in_fence():
    today = date(2026, 7, 25)
    due = today + timedelta(days=3)
    result = time_phased_net_material(
        gross_by_date={due: 100},
        receipts_by_date={},
        beginning_inventory=0,
        safety_stock=0,
        reorder_point=0,
        lead_time_days=2,
        schedule_buffer_days=0,
        include_safety_stock=False,
        include_reorder_point=False,
        apply_lot_fn=lambda x: x,
        today=today,
        frozen=True,
        planning_fence_days=7,
    )
    codes = {e["code"] for e in result["exceptions"]}
    assert "FIRM_FROZEN_SHORTAGE" in codes
    assert result["planned_order_qty"] == 0


def test_compare_new_order_when_no_open_supply():
    today = date(2026, 7, 25)
    due = today + timedelta(days=10)
    exc = compare_planned_vs_open_supply(
        planned_orders=[{"qty": 100, "receipt_date": due, "release_date": due - timedelta(days=2), "firm": False}],
        open_supplies=[],
        today=today,
    )
    assert len(exc) == 1
    assert exc[0]["code"] == "NEW_ORDER"
    assert exc[0]["message"]
    assert exc[0]["severity"] == "error"
