from decimal import Decimal
from pathlib import Path

import pytest

from apps.haoligo.services.finance_einvoice_parser import (
    parse_china_einvoice_qr_csv,
    parse_einvoice_pdf_bytes,
    parse_einvoice_qr_text,
)

SAMPLE_QR = "01,31,,26442000004359167806,1705400.00,20260421,,8EEF"
SAMPLE_PDF = Path(r"f:\xwechat_files\lu_dingjie_67dc\msg\file\2026-07\好力4.21.pdf")


def test_parse_china_einvoice_qr_csv():
    parsed = parse_china_einvoice_qr_csv(SAMPLE_QR)
    assert parsed["invoice_no"] == "26442000004359167806"
    assert parsed["total_amount"] == Decimal("1705400.00")
    assert str(parsed["invoice_date"]) == "2026-04-21"
    assert parsed["needs_lines"] is True
    assert parsed["lines"] == []


def test_parse_einvoice_qr_text_accepts_csv():
    parsed = parse_einvoice_qr_text(SAMPLE_QR)
    assert parsed["invoice_no"] == "26442000004359167806"


@pytest.mark.skipif(not SAMPLE_PDF.is_file(), reason="customer sample PDF not available")
def test_parse_einvoice_pdf_bytes_from_sample():
    parsed = parse_einvoice_pdf_bytes(SAMPLE_PDF.read_bytes())
    assert parsed["invoice_no"] == "26442000004359167806"
    assert parsed["parse_source"] in ("pdf_qr_text", "pdf_qr_ocr")
    assert parsed["needs_lines"] is False
    assert len(parsed["lines"]) >= 10
    first = parsed["lines"][0]
    assert first.get("material_name")
    assert first.get("material_code")
