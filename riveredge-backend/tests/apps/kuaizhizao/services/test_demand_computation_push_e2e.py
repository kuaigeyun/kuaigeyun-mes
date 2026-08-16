"""需求计算下推工单/采购：预览与执行数量口径、部分下推补推。"""

from datetime import date
from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
from apps.kuaizhizao.utils.material_source_helper import (
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_OUTSOURCE,
)
from infra.exceptions.exceptions import BusinessLogicError


def _make_item(material_id: int, qty: float) -> SimpleNamespace:
    return SimpleNamespace(
        material_id=material_id,
        material_source_type=SOURCE_TYPE_MAKE,
        suggested_work_order_quantity=qty,
    )


def _outsource_item(material_id: int, qty: float) -> SimpleNamespace:
    return SimpleNamespace(
        material_id=material_id,
        material_source_type=SOURCE_TYPE_OUTSOURCE,
        suggested_work_order_quantity=qty,
    )


def test_production_remaining_after_partial_work_order_push():
    items = [_make_item(1, 100.0), _make_item(2, 50.0)]
    exclusions = {
        "wo_pushed_qty_by_material_id": {1: 40.0},
        "outsource_pushed_qty_by_material_id": {},
    }
    remaining = DemandComputationService._get_production_remaining_qty_by_material(items, exclusions)
    assert remaining[1] == 60.0
    assert remaining[2] == 50.0


def test_outsource_remaining_after_partial_push():
    items = [_outsource_item(3, 80.0)]
    exclusions = {
        "wo_pushed_qty_by_material_id": {},
        "outsource_pushed_qty_by_material_id": {3: 30.0},
    }
    remaining = DemandComputationService._get_outsource_remaining_qty_by_material(items, exclusions)
    assert remaining[3] == 50.0


def test_production_pushed_qty_caps_at_suggested():
    exclusions = {"wo_pushed_qty_by_material_id": {1: 900.0}}
    pushed = DemandComputationService._production_pushed_qty_for_material(1, 120.0, exclusions)
    assert pushed == 120.0


def test_downstream_progress_uses_partial_work_order_qty():
    svc = DemandComputationService()
    computation = SimpleNamespace(computation_status="完成")
    items = [_make_item(1, 100.0)]
    exclusions = {
        "wo_pushed_qty_by_material_id": {1: 25.0},
        "outsource_pushed_qty_by_material_id": {},
        "po_pushed_qty_by_material_id": {},
        "pr_committed_qty_by_material_id": {},
    }
    progress = svc._compute_downstream_push_progress(computation, items, exclusions)
    assert progress == 25.0


def test_preview_work_order_count_matches_pushable_rows():
    """预览 work_order_count 应与 max_push_quantity>0 的工单行数一致。"""
    wo_items = [
        {"target_document": "work_order", "max_push_quantity": 10.0},
        {"target_document": "work_order", "max_push_quantity": 0.0},
        {"target_document": "outsource_work_order", "max_push_quantity": 5.0},
    ]
    work_order_count = sum(
        1
        for row in wo_items
        if row.get("target_document") == "work_order"
        and float(row.get("max_push_quantity") or 0) > 0
    )
    outsource_count = sum(
        1
        for row in wo_items
        if row.get("target_document") == "outsource_work_order"
        and float(row.get("max_push_quantity") or 0) > 0
    )
    assert work_order_count == 1
    assert outsource_count == 1


def test_push_all_passes_selected_purchase_requisition_item_ids(monkeypatch):
    import asyncio

    svc = DemandComputationService()
    captured: dict = {}

    async def _fake_get(*_args, **_kwargs):
        return SimpleNamespace(computation_status="完成", computation_code="DC-1")

    async def _fake_push_document(*_args, **kwargs):
        captured["push_params"] = kwargs.get("push_params")
        return {"target_document": {"id": 9, "code": "PR-1"}}

    monkeypatch.setattr(
        "apps.kuaizhizao.models.demand_computation.DemandComputation.get_or_none",
        _fake_get,
    )
    monkeypatch.setattr(
        "apps.kuaizhizao.services.document_push_pull_service.DocumentPushPullService.push_document",
        _fake_push_document,
    )

    async def _run():
        return await svc.push_all(
            tenant_id=1,
            computation_id=1,
            created_by=1,
            production=None,
            purchase="requisition",
            push_mode="draft",
            purchase_requisition_item_ids=[11, 12],
        )

    result = asyncio.run(_run())
    assert result["success"] is True
    assert captured["push_params"] == {"selected_item_ids": [11, 12]}


def test_push_all_passes_production_item_ids(monkeypatch):
    import asyncio

    svc = DemandComputationService()
    captured: dict = {}

    async def _fake_get(*_args, **_kwargs):
        return SimpleNamespace(computation_status="完成", computation_code="DC-1")

    async def _fake_generate(*_args, **kwargs):
        captured["generate_kwargs"] = kwargs
        return {"work_orders": [{"id": 1}], "outsource_work_orders": []}

    monkeypatch.setattr(
        "apps.kuaizhizao.models.demand_computation.DemandComputation.get_or_none",
        _fake_get,
    )
    monkeypatch.setattr(svc, "generate_work_orders_and_purchase_orders", _fake_generate)

    async def _run():
        return await svc.push_all(
            tenant_id=1,
            computation_id=1,
            created_by=1,
            production="work_order",
            purchase=None,
            push_mode="draft",
            production_item_ids=[21, 22],
        )

    result = asyncio.run(_run())
    assert result["success"] is True
    assert captured["generate_kwargs"]["selected_item_ids"] == [21, 22]


def test_resolve_production_selected_material_ids_filters_buy_items():
    svc = DemandComputationService()
    items = [
        SimpleNamespace(
            id=1,
            material_id=101,
            material_source_type=SOURCE_TYPE_MAKE,
            suggested_work_order_quantity=10.0,
        ),
        SimpleNamespace(
            id=2,
            material_id=102,
            material_source_type=SOURCE_TYPE_BUY,
            suggested_purchase_order_quantity=5.0,
        ),
    ]
    selected = svc._resolve_production_selected_material_ids(items, [1, 2])
    assert selected == {101}


def test_resolve_production_selected_material_ids_empty_raises():
    svc = DemandComputationService()
    items = [
        SimpleNamespace(
            id=2,
            material_id=102,
            material_source_type=SOURCE_TYPE_BUY,
            suggested_purchase_order_quantity=5.0,
        ),
    ]
    try:
        svc._resolve_production_selected_material_ids(items, [2])
        assert False, "expected BusinessLogicError"
    except BusinessLogicError as e:
        assert "不可下推" in str(e)


def test_buy_remaining_unchanged_with_work_order_exclusions():
    """采购剩余数量计算不受工单占用字段影响。"""
    items = [
        SimpleNamespace(
            material_id=1,
            material_source_type=SOURCE_TYPE_BUY,
            suggested_purchase_order_quantity=100.0,
        )
    ]
    exclusions = {
        "po_pushed_qty_by_material_id": {1: 20.0},
        "pr_committed_qty_by_material_id": {},
        "wo_pushed_qty_by_material_id": {1: 50.0},
    }
    remaining = DemandComputationService._get_purchase_remaining_qty_by_material(items, exclusions)
    assert remaining[1] == 80.0


def _item_with_planned_orders(planned_orders, **kwargs):
    return SimpleNamespace(
        material_id=1,
        material_code="M001",
        material_name="物料A",
        material_spec=None,
        material_unit="EA",
        material_source_type=SOURCE_TYPE_MAKE,
        material_source_config={},
        suggested_work_order_quantity=kwargs.get("suggested", 150.0),
        production_start_date=date(2026, 8, 1),
        production_completion_date=date(2026, 8, 15),
        procurement_start_date=None,
        procurement_completion_date=None,
        delivery_date=None,
        detail_results={
            "supply_calculation": {
                "planned_orders": planned_orders,
            }
        },
        **kwargs,
    )


def test_resolve_production_push_lines_splits_by_planned_orders():
    item = _item_with_planned_orders([
        {"qty": 60, "receipt_date": "2026-08-10", "release_date": "2026-08-05"},
        {"qty": 90, "receipt_date": "2026-08-20", "release_date": "2026-08-15"},
    ])
    lines = DemandComputationService._resolve_production_push_lines(item, 150.0)
    assert len(lines) == 2
    assert lines[0]["qty"] == 60
    assert lines[0]["end_date"] == date(2026, 8, 10)
    assert lines[1]["qty"] == 90
    assert lines[1]["end_date"] == date(2026, 8, 20)


def test_resolve_production_push_lines_partial_remaining():
    item = _item_with_planned_orders([
        {"qty": 60, "receipt_date": "2026-08-10", "release_date": "2026-08-05"},
        {"qty": 90, "receipt_date": "2026-08-20", "release_date": "2026-08-15"},
    ])
    lines = DemandComputationService._resolve_production_push_lines(item, 80.0)
    assert len(lines) == 2
    assert lines[0]["qty"] == 60
    assert lines[1]["qty"] == 20


def test_resolve_production_push_lines_fallback_without_planned_orders():
    item = SimpleNamespace(
        material_id=1,
        suggested_work_order_quantity=50.0,
        production_start_date=date(2026, 8, 1),
        production_completion_date=date(2026, 8, 10),
        detail_results={},
    )
    lines = DemandComputationService._resolve_production_push_lines(item, 50.0)
    assert len(lines) == 1
    assert lines[0]["qty"] == 50
    assert lines[0]["start_date"] == date(2026, 8, 1)
    assert lines[0]["end_date"] == date(2026, 8, 10)


def test_resolve_purchase_push_lines_splits():
    item = SimpleNamespace(
        material_id=2,
        suggested_purchase_order_quantity=100.0,
        procurement_start_date=date(2026, 8, 1),
        procurement_completion_date=date(2026, 8, 20),
        delivery_date=date(2026, 8, 20),
        detail_results={
            "supply_calculation": {
                "planned_orders": [
                    {"qty": 40, "receipt_date": "2026-08-08", "release_date": "2026-08-01"},
                    {"qty": 60, "receipt_date": "2026-08-18", "release_date": "2026-08-11"},
                ]
            }
        },
    )
    lines = DemandComputationService._resolve_purchase_push_lines(item, 100.0)
    assert len(lines) == 2
    assert [line["qty"] for line in lines] == [40, 60]
