"""编码序号解析：必须用序号前完整前缀，禁止把日期段当成流水。"""

import pytest

from infra.exceptions.exceptions import ValidationError
from core.services.business.code_generation_service import (
    CodeGenerationService,
    _resolve_scan_prefix_for_sequence,
)


def test_parse_counter_with_full_date_prefix():
    n = CodeGenerationService._parse_counter_suffix_int(
        "CG202608120004", "CG20260812", digits=4
    )
    assert n == 4
    n12 = CodeGenerationService._parse_counter_suffix_int(
        "CG20260812000000000026", "CG20260812", digits=12
    )
    assert n12 == 26


def test_parse_counter_incomplete_prefix_is_not_a_match():
    """前缀漏掉日期时，剩余数字长于规则位数，该编码不参与校准（不是截尾、也不是丢弃溢出）。"""
    assert (
        CodeGenerationService._parse_counter_suffix_int(
            "CG20260812000000000026", "CG", digits=12
        )
        is None
    )
    assert (
        CodeGenerationService._parse_counter_suffix_int("CG202608120004", "CG", digits=4)
        is None
    )


def test_parse_counter_without_digits_still_returns_mashed_date():
    """未配 digits 时解析器按「前缀后全数字」取值；错误前缀会得到超大整数，由校准入口报错。"""
    n = CodeGenerationService._parse_counter_suffix_int("CG202608120004", "CG")
    assert n == 202608120004
    assert n > CodeGenerationService._INT32_MAX


def test_recalibrate_raises_when_parsed_seq_exceeds_int32():
    with pytest.raises(ValidationError, match="超出序号表容量"):
        CodeGenerationService._assert_parsed_seq_fits_storage(
            202608120004, "PURCHASE_ORDER_CODE", "CG"
        )


def test_scan_prefix_none_when_form_field_missing():
    components = [
        {"text": "CG", "type": "fixed_text", "order": 0},
        {"type": "form_field", "field_name": "group_code", "order": 1},
        {"type": "date", "order": 2, "format_type": "preset", "preset_format": "YYYYMMDD"},
        {"type": "auto_counter", "order": 3, "digits": 4},
    ]
    assert _resolve_scan_prefix_for_sequence(components, {}, "", "CG") is None


def test_scan_prefix_includes_date_for_purchase_order_rule():
    components = [
        {"text": "CG", "type": "fixed_text", "order": 0},
        {"type": "date", "order": 1, "format_type": "preset", "preset_format": "YYYYMMDD"},
        {"type": "auto_counter", "order": 2, "digits": 4, "fixed_width": True},
    ]
    prefix = _resolve_scan_prefix_for_sequence(components, {}, "", "CG")
    assert prefix is not None
    assert prefix.startswith("CG")
    assert len(prefix) == len("CG") + 8
