"""报价版本：编码与系列工具（无 DB）。"""

from apps.kuaizhizao.services.quotation_service import QuotationService


def test_next_revision_quotation_code_short_series():
    assert QuotationService._next_revision_quotation_code("QT-2026-001", 2) == "QT-2026-001-V2"


def test_next_revision_quotation_code_truncates_long_series():
    long = "A" * 200
    out = QuotationService._next_revision_quotation_code(long, 99)
    assert out.endswith("-V99")
    assert len(out) <= 120
