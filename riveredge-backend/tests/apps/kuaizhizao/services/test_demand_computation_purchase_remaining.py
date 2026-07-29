"""需求计算采购下推剩余数量计算（部分下推后可补推）。"""

from types import SimpleNamespace

from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
from apps.kuaizhizao.utils.material_source_helper import SOURCE_TYPE_BUY


def _buy_item(material_id: int, qty: float) -> SimpleNamespace:
    return SimpleNamespace(
        material_id=material_id,
        material_source_type=SOURCE_TYPE_BUY,
        suggested_purchase_order_quantity=qty,
    )


def test_remaining_after_partial_po_push_by_material():
    items = [_buy_item(1, 100.0), _buy_item(2, 50.0)]
    exclusions = {
        "po_pushed_qty_by_material_id": {1: 40.0},
        "pr_committed_qty_by_material_id": {},
    }
    remaining = DemandComputationService._get_purchase_remaining_qty_by_material(items, exclusions)
    assert remaining[1] == 60.0
    assert remaining[2] == 50.0


def test_remaining_zero_when_fully_pushed():
    items = [_buy_item(1, 100.0)]
    exclusions = {
        "po_pushed_qty_by_material_id": {1: 100.0},
        "pr_committed_qty_by_material_id": {},
    }
    remaining = DemandComputationService._get_purchase_remaining_qty_by_material(items, exclusions)
    assert remaining == {}


def test_remaining_considers_purchase_requisition_commitment():
    items = [_buy_item(1, 80.0)]
    exclusions = {
        "po_pushed_qty_by_material_id": {},
        "pr_committed_qty_by_material_id": {1: 30.0},
    }
    remaining = DemandComputationService._get_purchase_remaining_qty_by_material(items, exclusions)
    assert remaining[1] == 50.0


def test_purchase_pushed_qty_for_material_caps_at_suggested():
    exclusions = {
        "po_pushed_qty_by_material_id": {1: 900.0},
        "pr_committed_qty_by_material_id": {},
    }
    pushed = DemandComputationService._purchase_pushed_qty_for_material(1, 750.0, exclusions)
    assert pushed == 750.0


def test_aggregate_buy_qty_sums_same_material():
    items = [_buy_item(1, 30.0), _buy_item(1, 70.0), _buy_item(2, 10.0)]
    aggregated = DemandComputationService._aggregate_buy_suggested_qty_by_material(items)
    assert aggregated[1] == 100.0
    assert aggregated[2] == 10.0


def test_fallback_purchase_order_code_increments_for_same_computation_supplier():
    first = DemandComputationService._build_fallback_purchase_order_code(
        "20260729", 1, 0, existing_count=1
    )
    second = DemandComputationService._build_fallback_purchase_order_code(
        "20260729", 1, 0, existing_count=2
    )
    assert first == "PO-20260729-1-0-2"
    assert second == "PO-20260729-1-0-3"
