"""银行流水摘要修复辅助逻辑测试。"""

from apps.kuaicaiwu.services.bank_transaction_summary_repair import _is_blank


def test_is_blank():
    assert _is_blank(None) is True
    assert _is_blank("") is True
    assert _is_blank("   ") is True
    assert _is_blank("-") is False
    assert _is_blank("合并收款 SK1") is False
