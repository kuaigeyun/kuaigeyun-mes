"""手工开单派工默认：路线 step / 工序档案回落解析。"""

from apps.kuaizhizao.services.work_order_service import (
    _first_positive_int,
    _parse_assigned_worker_ids,
    _route_step_by_operation_id,
)


def test_parse_assigned_worker_ids_prefers_list_then_fallback():
    assert _parse_assigned_worker_ids([3, 3, 5], 9) == [3, 5]
    assert _parse_assigned_worker_ids(None, 9) == [9]
    assert _parse_assigned_worker_ids([], None) == []


def test_route_step_by_operation_id_indexes_payload():
    seq = {
        "operations": [
            {"operation_id": 11, "operator_ids": [101, 102]},
            {"operationId": "12", "assigned_worker_id": 201},
            {"operation_name": "skip-me"},
        ]
    }
    mapped = _route_step_by_operation_id(seq)
    assert set(mapped.keys()) == {11, 12}
    assert mapped[11]["operator_ids"] == [101, 102]
    assert mapped[12]["assigned_worker_id"] == 201


def test_first_positive_int_from_list_or_scalar():
    assert _first_positive_int(None, [], [0, 7], 9) == 7
    assert _first_positive_int("8") == 8
    assert _first_positive_int(None, "x", 0) is None
