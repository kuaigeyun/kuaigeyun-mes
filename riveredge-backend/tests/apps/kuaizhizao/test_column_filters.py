"""column_filters 契约：高级搜索 ne / 状态别名。"""

from apps.kuaizhizao.services.report_enhancements import _match_column_filter
from apps.kuaizhizao.utils.column_filters import (
    expand_status_match_values,
    normalize_status_token,
    parse_column_filters_param,
)


def test_parse_column_filters_param_json():
    raw = '[{"field":"status","op":"ne","value":"DRAFT"}]'
    assert parse_column_filters_param(raw) == [
        {"field": "status", "op": "ne", "value": "DRAFT"}
    ]


def test_status_alias_normalize():
    assert normalize_status_token("草稿") == "DRAFT"
    assert normalize_status_token("DRAFT") == "DRAFT"
    assert "草稿" in expand_status_match_values("DRAFT")
    assert "DRAFT" in expand_status_match_values("草稿")


def test_match_column_filter_status_ne_excludes_chinese_draft():
    row = {"status": "草稿", "order_code": "PO1"}
    assert _match_column_filter(row, {"field": "status", "op": "ne", "value": "DRAFT"}) is False
    assert _match_column_filter(row, {"field": "status", "op": "eq", "value": "DRAFT"}) is True


def test_match_column_filter_status_ne_keeps_audited():
    row = {"status": "AUDITED"}
    assert _match_column_filter(row, {"field": "status", "op": "ne", "value": "DRAFT"}) is True


def test_match_column_filter_nin_and_startswith():
    row = {"order_code": "PO-100", "status": "AUDITED"}
    assert _match_column_filter(
        row, {"field": "status", "op": "nin", "value": ["DRAFT", "草稿"]}
    ) is True
    assert _match_column_filter(
        row, {"field": "order_code", "op": "startswith", "value": "PO-"}
    ) is True
    assert _match_column_filter(
        row, {"field": "order_code", "op": "endswith", "value": "100"}
    ) is True
