"""Tests for outsource operation UUID → name resolution."""

from apps.kuaizhizao.utils.outsource_operation_helper import (
    display_outsource_operation,
    is_operation_uuid,
)


def test_is_operation_uuid():
    assert is_operation_uuid("18a42a06-055d-4b72-b4b5-ee90ceb1cbb4") is True
    assert is_operation_uuid("喷涂") is False
    assert is_operation_uuid(None) is False


def test_display_outsource_operation_resolves_uuid():
    label_map = {"18a42a06-055d-4b72-b4b5-ee90ceb1cbb4": "表面喷涂"}
    assert (
        display_outsource_operation("18a42a06-055d-4b72-b4b5-ee90ceb1cbb4", label_map)
        == "表面喷涂"
    )


def test_display_outsource_operation_keeps_plain_name():
    assert display_outsource_operation("表面喷涂", {}) == "表面喷涂"
