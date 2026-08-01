from apps.master_data.services.material_product_process_service import (
    _merge_stored_lines_with_route,
)


def test_merge_does_not_restore_route_ops_removed_from_product_process():
    route_rows = [
        {"uuid": "op-a", "code": "GX001", "name": "下料"},
        {"uuid": "op-b", "code": "GX002", "name": "装配"},
    ]
    stored = [{"uuid": "op-a", "code": "GX001", "name": "下料", "standard_time": 60}]

    merged = _merge_stored_lines_with_route(stored, route_rows)

    assert [row["uuid"] for row in merged] == ["op-a"]


def test_merge_follows_route_order_and_keeps_stored_only_ops_at_end():
    route_rows = [
        {"uuid": "op-a", "code": "GX001", "name": "下料"},
        {"uuid": "op-b", "code": "GX002", "name": "装配"},
    ]
    stored = [
        {"uuid": "op-b", "code": "GX002", "name": "装配", "standard_time": 30},
        {"uuid": "op-a", "code": "GX001", "name": "下料", "standard_time": 60},
        {"uuid": "op-c", "code": "GX003", "name": "检验", "standard_time": 10},
    ]

    merged = _merge_stored_lines_with_route(stored, route_rows)

    assert [row["uuid"] for row in merged] == ["op-a", "op-b", "op-c"]
    assert merged[0]["standard_time"] == 60
    assert merged[1]["standard_time"] == 30


def test_merge_applies_stored_over_route_defaults():
    route_rows = [{"uuid": "op-a", "code": "GX001", "name": "模板名", "standard_time": 10}]
    stored = [{"uuid": "op-a", "code": "GX001", "name": "产品名", "standard_time": 99}]

    merged = _merge_stored_lines_with_route(stored, route_rows)

    assert merged[0]["name"] == "产品名"
    assert merged[0]["standard_time"] == 99
