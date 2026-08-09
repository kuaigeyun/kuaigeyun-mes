"""工单工序批量更新辅助逻辑单元测试。"""

from types import SimpleNamespace

from apps.kuaizhizao.services.work_order_service import (
    _match_existing_work_order_operation,
    _referenced_work_order_operation_ids,
    _reported_work_order_operation_content_changed,
    _work_order_operation_ids_to_remove,
)


def test_referenced_work_order_operation_ids():
    payload = [
        SimpleNamespace(id=10),
        SimpleNamespace(id=None),
        SimpleNamespace(id=20),
    ]
    assert _referenced_work_order_operation_ids(payload) == {10, 20}


def test_match_prefers_row_id():
    existing = [
        SimpleNamespace(id=1, operation_id=10, sequence=1, deleted_at=None),
        SimpleNamespace(id=2, operation_id=20, sequence=2, deleted_at=None),
    ]
    matched = _match_existing_work_order_operation(
        SimpleNamespace(id=2, operation_id=20),
        existing,
        used_existing_ids=set(),
    )
    assert matched is existing[1]


def test_match_by_operation_id_when_no_row_id():
    existing = [
        SimpleNamespace(id=1, operation_id=10, sequence=1, deleted_at=None),
        SimpleNamespace(id=2, operation_id=20, sequence=2, deleted_at=None),
        SimpleNamespace(id=3, operation_id=30, sequence=3, deleted_at=None),
    ]
    used: set[int] = set()
    first = _match_existing_work_order_operation(
        SimpleNamespace(id=None, operation_id=10),
        existing,
        used,
    )
    used.add(first.id)
    second = _match_existing_work_order_operation(
        SimpleNamespace(id=None, operation_id=30),
        existing,
        used,
    )
    used.add(second.id)
    assert first.id == 1
    assert second.id == 3
    assert _work_order_operation_ids_to_remove(existing, reported_operation_ids=set(), matched_existing_ids=used) == [2]


def test_match_unknown_row_id_does_not_fallback():
    existing = [SimpleNamespace(id=1, operation_id=10, sequence=1, deleted_at=None)]
    matched = _match_existing_work_order_operation(
        SimpleNamespace(id=999, operation_id=10),
        existing,
        used_existing_ids=set(),
    )
    assert matched is None


def test_work_order_operation_ids_to_remove_keeps_reported():
    existing = [
        SimpleNamespace(id=1, deleted_at=None),
        SimpleNamespace(id=2, deleted_at=None),
        SimpleNamespace(id=3, deleted_at=None),
    ]
    assert _work_order_operation_ids_to_remove(
        existing,
        reported_operation_ids={2},
        matched_existing_ids={1},
    ) == [3]


def test_reported_content_unchanged_allows_sequence_only_sync():
    existing = SimpleNamespace(operation_id=7, operation_code="JJ", operation_name="进检")
    payload = SimpleNamespace(operation_id=7, operation_code="JJ", operation_name="进检")
    assert _reported_work_order_operation_content_changed(existing, payload) is False


def test_reported_content_changed_detects_operation_swap():
    existing = SimpleNamespace(operation_id=7, operation_code="JJ", operation_name="进检")
    payload = SimpleNamespace(operation_id=8, operation_code="JG", operation_name="加工")
    assert _reported_work_order_operation_content_changed(existing, payload) is True
