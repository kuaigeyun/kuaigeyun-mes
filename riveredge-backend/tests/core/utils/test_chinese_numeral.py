import pytest

from core.utils.chinese_numeral import int_to_chinese_simple


@pytest.mark.parametrize(
    ("n", "expected"),
    [
        (1, "一"),
        (2, "二"),
        (9, "九"),
        (10, "十"),
        (11, "十一"),
        (19, "十九"),
        (20, "二十"),
        (21, "二十一"),
        (99, "九十九"),
    ],
)
def test_int_to_chinese_simple(n, expected):
    assert int_to_chinese_simple(n) == expected


def test_int_to_chinese_simple_rejects_non_positive():
    with pytest.raises(ValueError):
        int_to_chinese_simple(0)
