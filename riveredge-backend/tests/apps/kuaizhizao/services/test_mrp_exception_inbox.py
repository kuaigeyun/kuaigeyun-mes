"""MRP 例外收件箱聚合辅助逻辑单元测试。"""

from datetime import datetime, timezone

from apps.kuaizhizao.services.demand_computation_service import DemandComputationService


def test_resolve_supply_document_type_by_id():
    detail = {
        "dated_supply": [
            {"source_type": "work_order", "document_id": 10, "document_code": "WO001"},
            {"source_type": "purchase_order", "document_id": 20, "document_code": "PO001"},
        ]
    }
    assert DemandComputationService._resolve_supply_document_type(detail, document_id=20) == "purchase_order"


def test_resolve_supply_document_type_by_code():
    detail = {
        "dated_supply": [
            {"source_type": "work_order", "document_id": 10, "document_code": "WO001"},
        ]
    }
    assert DemandComputationService._resolve_supply_document_type(detail, document_code="WO001") == "work_order"


def test_resolve_supply_document_type_missing():
    assert DemandComputationService._resolve_supply_document_type({}, document_id=1) is None


def test_exception_inbox_sort_key_error_first():
    now = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
    earlier = datetime(2026, 3, 1, 10, 0, tzinfo=timezone.utc)
    warning_row = {
        "severity": "warning",
        "code": "RESCHEDULE_IN",
        "computation_end_time": now,
    }
    error_row = {
        "severity": "error",
        "code": "NEW_ORDER",
        "computation_end_time": earlier,
    }
    rows = [warning_row, error_row]
    rows.sort(key=DemandComputationService._exception_inbox_sort_key)
    assert rows[0]["severity"] == "error"


def test_exception_inbox_sort_key_newer_computation_first_within_same_severity():
    newer = datetime(2026, 3, 2, 12, 0, tzinfo=timezone.utc)
    older = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
    rows = [
        {"severity": "error", "code": "NEW_ORDER", "computation_end_time": older},
        {"severity": "error", "code": "NEW_ORDER", "computation_end_time": newer},
    ]
    rows.sort(key=DemandComputationService._exception_inbox_sort_key)
    assert rows[0]["computation_end_time"] == newer
