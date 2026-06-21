"""追溯 serial_match 单元测试。"""

from apps.kuaizhizao.services.traceability.serial_match import (
    parse_serial_numbers,
    serial_numbers_contain,
)


def test_parse_serial_numbers_list():
    assert parse_serial_numbers(["A-001", "A-002"]) == ["A-001", "A-002"]


def test_parse_serial_numbers_json_string():
    assert parse_serial_numbers('["SN-1", "SN-2"]') == ["SN-1", "SN-2"]


def test_parse_serial_numbers_comma_string():
    assert parse_serial_numbers("SN-1, SN-2") == ["SN-1", "SN-2"]


def test_parse_serial_numbers_empty():
    assert parse_serial_numbers(None) == []
    assert parse_serial_numbers("") == []


def test_serial_numbers_contain():
    assert serial_numbers_contain(["KG-001"], "KG-001")
    assert not serial_numbers_contain(["KG-001"], "KG-002")
    assert not serial_numbers_contain(None, "KG-001")
