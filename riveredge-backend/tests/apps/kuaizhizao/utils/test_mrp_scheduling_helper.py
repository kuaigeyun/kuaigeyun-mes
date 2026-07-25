"""MRP 交期锚定倒排 / 正排辅助函数测试。"""

from datetime import date

from apps.kuaizhizao.utils.mrp_scheduling_helper import (
    apply_bom_pegged_production_schedules,
    compute_backward_production_schedule,
    compute_forward_production_schedule,
    merge_requirement_delivery_date,
    normalize_schedule_direction,
    planning_date_to_work_order_end,
    planning_date_to_work_order_start,
    resolve_demand_item_delivery_date,
)
from apps.kuaizhizao.utils.work_order_operation_scheduling import (
    build_operation_time_slots,
    operation_total_hours,
)


class _Item:
    def __init__(self, delivery_date=None, demand_id=None):
        self.delivery_date = delivery_date
        self.demand_id = demand_id


class _Demand:
    def __init__(self, delivery_date=None, end_date=None):
        self.delivery_date = delivery_date
        self.end_date = end_date


def test_compute_backward_production_schedule_anchors_completion():
    start, end = compute_backward_production_schedule(
        date(2026, 7, 31),
        lead_days=3,
        buffer_days=0,
        today=date(2026, 7, 10),
    )
    assert end == date(2026, 7, 31)
    assert start == date(2026, 7, 28)


def test_compute_backward_production_schedule_clamps_start_not_due():
    start, end = compute_backward_production_schedule(
        date(2026, 7, 31),
        lead_days=30,
        buffer_days=0,
        today=date(2026, 7, 10),
    )
    assert end == date(2026, 7, 31)
    assert start == date(2026, 7, 10)


def test_compute_forward_production_schedule_from_today():
    start, end, late = compute_forward_production_schedule(
        date(2026, 7, 31),
        lead_days=5,
        buffer_days=0,
        today=date(2026, 7, 10),
    )
    assert start == date(2026, 7, 10)
    assert end == date(2026, 7, 15)
    assert late is False


def test_compute_forward_production_schedule_late_vs_demand():
    start, end, late = compute_forward_production_schedule(
        date(2026, 7, 12),
        lead_days=10,
        buffer_days=0,
        today=date(2026, 7, 10),
    )
    assert start == date(2026, 7, 10)
    assert end == date(2026, 7, 20)
    assert late is True


def test_normalize_schedule_direction():
    assert normalize_schedule_direction(None) == "backward"
    assert normalize_schedule_direction("forward") == "forward"
    assert normalize_schedule_direction("FORWARD") == "forward"
    assert normalize_schedule_direction("backward") == "backward"


def test_resolve_demand_item_delivery_date_falls_back_to_demand_header():
    item = _Item(delivery_date=None, demand_id=1)
    demand = _Demand(delivery_date=date(2026, 7, 31))
    resolved = resolve_demand_item_delivery_date(item, {1: demand})
    assert resolved == date(2026, 7, 31)


def test_merge_requirement_delivery_date_takes_earlier():
    merged = merge_requirement_delivery_date(date(2026, 7, 31), date(2026, 7, 20))
    assert merged == date(2026, 7, 20)


def test_build_operation_time_slots_backward_from_due_anchor():
    due = planning_date_to_work_order_end(date(2026, 7, 31))
    slots = build_operation_time_slots(
        [8.0, 16.0, 24.0],
        planned_end=due,
    )
    assert len(slots) == 3
    assert slots[-1][1].date() == date(2026, 7, 31)
    assert slots[0][0] < slots[-1][1]


def test_operation_total_hours_includes_setup_and_run():
    assert operation_total_hours(1, 0.5, 100) == 51.0


def test_apply_bom_pegged_production_schedules_child_anchors_to_parent_start():
    """半成品完工日应挂接父件开工日，而非与订单交期同一天。"""
    fg_id = 100
    mb_id = 101
    rows = {
        fg_id: {
            "bom_level": 0,
            "parent_material_ids": set(),
            "source_type": "Make",
            "planning_qty": 100,
            "production_lead_time": 7,
            "schedule_buffer_days": 0,
            "production_start_date": date(2026, 7, 24),
            "production_completion_date": date(2026, 7, 31),
        },
        mb_id: {
            "bom_level": 1,
            "parent_material_ids": {fg_id},
            "source_type": "Make",
            "planning_qty": 100,
            "production_lead_time": 0,
            "schedule_buffer_days": 0,
            "production_start_date": date(2026, 7, 31),
            "production_completion_date": date(2026, 7, 31),
        },
    }
    apply_bom_pegged_production_schedules(rows, today=date(2026, 7, 10))
    assert rows[mb_id]["production_completion_date"] == date(2026, 7, 24)
    assert rows[mb_id]["production_start_date"] == date(2026, 7, 24)
    assert rows[fg_id]["production_completion_date"] == date(2026, 7, 31)


def test_apply_bom_pegged_forward_child_starts_before_parent():
    fg_id = 100
    mb_id = 101
    rows = {
        fg_id: {
            "bom_level": 0,
            "parent_material_ids": set(),
            "source_type": "Make",
            "planning_qty": 100,
            "production_lead_time": 7,
            "schedule_buffer_days": 0,
            "production_start_date": date(2026, 7, 10),
            "production_completion_date": date(2026, 7, 17),
        },
        mb_id: {
            "bom_level": 1,
            "parent_material_ids": {fg_id},
            "source_type": "Make",
            "planning_qty": 100,
            "production_lead_time": 3,
            "schedule_buffer_days": 0,
            "production_start_date": date(2026, 7, 10),
            "production_completion_date": date(2026, 7, 13),
        },
    }
    apply_bom_pegged_production_schedules(
        rows, today=date(2026, 7, 1), schedule_direction="forward",
    )
    assert rows[mb_id]["production_start_date"] == date(2026, 7, 7)
    assert rows[mb_id]["production_completion_date"] == date(2026, 7, 10)


def test_build_operation_time_slots_forward_from_start():
    start = planning_date_to_work_order_start(date(2026, 7, 10))
    slots = build_operation_time_slots(
        [8.0, 16.0],
        planned_start=start,
        planned_end=None,
    )
    assert len(slots) == 2
    assert slots[0][0].date() == date(2026, 7, 10)
    assert slots[-1][1] > slots[0][0]
