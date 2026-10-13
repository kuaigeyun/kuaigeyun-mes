"""苍穹增量水位：filter / 分页体识别 / 行级过滤。"""

from datetime import datetime

from core.services.integration.kingdee_cosmic_since_filter import (
    apply_cosmic_since_filter,
    apply_cosmic_since_to_params,
    cosmic_paged_response_is_last_page,
    filter_rows_by_since,
    is_cosmic_paged_query,
    with_cosmic_page,
)


def test_is_cosmic_paged_query():
    assert is_cosmic_paged_query({"data": {}, "pageNo": 1, "pageSize": 100})
    assert not is_cosmic_paged_query({"parameters": [{"FormId": "BD_MATERIAL"}]})
    assert not is_cosmic_paged_query({})


def test_apply_cosmic_since_merges_existing_filter():
    since = datetime(2026, 10, 1, 8, 0, 0)
    body = apply_cosmic_since_filter(
        {"data": {"filter": "status EQ 'C'"}, "pageNo": 1, "pageSize": 50},
        since,
    )
    assert "modifytime GE '" in body["data"]["filter"]
    assert "status EQ 'C'" in body["data"]["filter"]


def test_apply_cosmic_since_does_not_pollute_empty_batch_data():
    since = datetime(2026, 10, 1, 8, 0, 0)
    body = apply_cosmic_since_filter(
        {"data": {}, "pageNo": 1, "pageSize": 100},
        since,
    )
    assert body["data"] == {}


def test_apply_cosmic_since_writes_start_modifytime_when_start_fields_exist():
    since = datetime(2026, 10, 1, 8, 0, 0)
    body = apply_cosmic_since_filter(
        {
            "data": {"start_createtime": "2020-01-01 00:00:00"},
            "pageNo": 1,
            "pageSize": 100,
        },
        since,
    )
    assert body["data"]["start_modifytime"]


def test_apply_cosmic_since_to_params_sys_query():
    since = datetime(2026, 10, 1, 8, 0, 0)
    params = apply_cosmic_since_to_params(
        {"select": "id,number", "page_no": 1},
        since,
        path="kapi/sys/bd_material/query",
    )
    assert "modifytime GE '" in params["filter"]


def test_apply_cosmic_since_to_params_skips_basedata_batch():
    since = datetime(2026, 10, 1, 8, 0, 0)
    params = apply_cosmic_since_to_params(
        {},
        since,
        path="kapi/v2/basedata/bd_material/batchQuery",
    )
    assert "filter" not in params


def test_with_cosmic_page():
    page = with_cosmic_page({"data": {}, "pageNo": 1, "pageSize": 100}, page_no=3)
    assert page["pageNo"] == 3
    assert page["pageSize"] == 100


def test_filter_rows_by_since_keeps_newer():
    since = datetime(2026, 10, 2, 0, 0, 0)
    rows = [
        {"number": "A", "modifytime": "2026-10-01 12:00:00"},
        {"number": "B", "modifytime": "2026-10-03 12:00:00"},
        {"number": "C"},
    ]
    kept = filter_rows_by_since(rows, since)
    assert [r["number"] for r in kept] == ["B", "C"]


def test_filter_rows_by_since_keeps_all_without_timestamps():
    since = datetime(2026, 10, 2, 0, 0, 0)
    rows = [{"number": "A"}, {"number": "B"}]
    kept = filter_rows_by_since(rows, since)
    assert len(kept) == 2


def test_cosmic_paged_response_is_last_page():
    assert cosmic_paged_response_is_last_page(
        {"data": {"rows": [{}] * 500, "lastPage": True}},
        chunk_len=500,
        page_size=500,
    )
    assert not cosmic_paged_response_is_last_page(
        {"data": {"rows": [{}] * 500, "lastPage": False}},
        chunk_len=500,
        page_size=500,
    )
    assert cosmic_paged_response_is_last_page(
        {"data": {"rows": []}},
        chunk_len=0,
        page_size=500,
    )
