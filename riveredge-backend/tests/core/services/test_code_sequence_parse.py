"""编码序号解析：必须用序号前完整前缀；流水写入 BIGINT，不因位数爆掉或截断。"""

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
    """前缀漏掉日期时，剩余数字长于规则位数，该编码不参与校准（不是截尾）。"""
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


def test_parse_twelve_digit_seq_fits_bigint():
    n = CodeGenerationService._parse_counter_suffix_int(
        "CG999999999999", "CG", digits=12
    )
    assert n == 999999999999
    assert n < CodeGenerationService._INT64_MAX


def test_parse_mashed_date_as_twelve_digit_seq_is_stored_not_rejected():
    """规则无日期、仅固定字+12 位流水时，历史 CG+日期+4 位会被读成 12 位整数并续编，不中断开单。"""
    n = CodeGenerationService._parse_counter_suffix_int("CG202608070004", "CG", digits=12)
    assert n == 202608070004
    assert n < CodeGenerationService._INT64_MAX


def test_parse_beyond_int64_is_skipped_not_truncated():
    too_big = "9" * 19
    assert (
        CodeGenerationService._parse_counter_suffix_int(f"CG{too_big}", "CG", digits=19)
        is None
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
