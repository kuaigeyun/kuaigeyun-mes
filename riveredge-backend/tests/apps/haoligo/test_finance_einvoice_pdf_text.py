from decimal import Decimal
from pathlib import Path

import pytest

from apps.haoligo.services.finance_einvoice_parser import parse_einvoice_pdf_bytes
from apps.haoligo.services.finance_einvoice_pdf_text import (
    extract_invoice_lines_from_pdf_text_layer,
    pdf_has_detail_text_layer,
    pdf_text_layer_available,
)

SAMPLE_PDF = Path(
    r"f:\xwechat_files\lu_dingjie_67dc\msg\file\2026-07"
    r"\dzfp_26322000002396686546_宜兴市森兴橡塑制品有限公司_20260623164922.pdf"
)


@pytest.mark.skipif(not pdf_text_layer_available(), reason="pymupdf not installed")
@pytest.mark.skipif(not SAMPLE_PDF.is_file(), reason="customer sample PDF not available")
def test_pdf_has_detail_text_layer_sample():
    data = SAMPLE_PDF.read_bytes()
    assert pdf_has_detail_text_layer(data) is True


@pytest.mark.skipif(not pdf_text_layer_available(), reason="pymupdf not installed")
@pytest.mark.skipif(not SAMPLE_PDF.is_file(), reason="customer sample PDF not available")
def test_extract_invoice_lines_from_pdf_text_layer_sample():
    lines = extract_invoice_lines_from_pdf_text_layer(SAMPLE_PDF.read_bytes())
    assert len(lines) >= 28
    assert lines[0]["material_name"] == "橡胶圈13.6*1"
    assert lines[0]["spec"] == "071700003"
    assert lines[0]["quantity"] == Decimal("1700000")
    assert lines[-1]["material_name"] == "小天鹅减震垫"
    assert lines[-1]["spec"] == "071800025"
    nbr = next((ln for ln in lines if ln.get("spec") == "071200010"), None)
    assert nbr is not None
    assert "NBR" in nbr["material_name"] and "PASH" in nbr["material_name"]
    assert nbr["quantity"] == Decimal("60000")
    assert nbr["invoice_unit_price"] == Decimal("0.076")


@pytest.mark.skipif(not pdf_text_layer_available(), reason="pymupdf not installed")
def test_text_layer_uses_column_anchors_not_material_keywords():
    """规格/名称拆分依赖列锚点，不依赖 NBR/PASH 等关键字表。"""
    from apps.haoligo.services.finance_einvoice_pdf_text import _column_anchors_from_words, _field_for_x

    words = [
        (45.0, 150.0, 80.0, 160.0, "项目名称", 0, 0, 0),
        (119.0, 150.0, 150.0, 160.0, "规格型号", 0, 0, 0),
        (190.0, 150.0, 200.0, 160.0, "单", 0, 0, 0),
        (12.0, 160.0, 80.0, 170.0, "NBR-", 0, 0, 0),
        (119.0, 160.0, 150.0, 170.0, "071200010", 0, 0, 0),
    ]
    anchors = _column_anchors_from_words(words)
    assert anchors is not None
    assert _field_for_x(12.0, anchors) == "name"
    assert _field_for_x(89.0, anchors) == "name"
    assert _field_for_x(119.0, anchors) == "spec"


@pytest.mark.skipif(not SAMPLE_PDF.is_file(), reason="customer sample PDF not available")
def test_parse_einvoice_pdf_bytes_prefers_text_layer():
    parsed = parse_einvoice_pdf_bytes(SAMPLE_PDF.read_bytes())
    assert parsed["invoice_no"] == "26322000002396686546"
    assert parsed["needs_lines"] is False
    if pdf_text_layer_available() and pdf_has_detail_text_layer(SAMPLE_PDF.read_bytes()):
        assert parsed["parse_source"] == "pdf_qr_text"
        assert len(parsed["lines"]) >= 28
        assert parsed["lines"][0]["spec"] == "071700003"
    else:
        assert parsed["parse_source"] in ("pdf_qr_ocr", "pdf_qr")
