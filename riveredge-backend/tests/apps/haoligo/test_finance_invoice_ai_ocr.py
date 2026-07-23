"""好力 GO 发票 AI OCR：结构化映射与 prefer_ai 跳过 RapidOCR。"""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

import pytest

from apps.haoligo.services.finance_invoice_ai_ocr import map_ai_invoice_payload
from infra.exceptions.exceptions import ValidationError


def test_map_ai_invoice_payload_maps_camel_case_lines():
    result = map_ai_invoice_payload(
        {
            "supplierName": "某某材料有限公司",
            "lines": [
                {
                    "materialCode": "010300031",
                    "materialName": "转子成品",
                    "spec": "Φ40.5",
                    "unit": "个",
                    "quantity": 100,
                    "unitPrice": "1.2500",
                    "taxAmount": 16.25,
                },
                {
                    "materialCode": "",
                    "materialName": "*橡胶制品*密封圈",
                    "spec": "NBR",
                    "unit": "件",
                    "quantity": "2.5",
                    "unitPrice": 3.2,
                },
            ],
        }
    )
    assert result["parse_source"] == "pdf_qr_ai"
    assert result["needs_lines"] is False
    assert result["supplier_name"] == "某某材料有限公司"
    assert len(result["lines"]) == 2
    first = result["lines"][0]
    assert first["material_code"] == "010300031"
    assert first["material_name"] == "转子成品"
    assert first["quantity"] == Decimal("100")
    assert first["invoice_unit_price"] == Decimal("1.2500")
    assert first["invoice_unit_price_literal"] == "1.2500"
    assert first["tax_amount"] == Decimal("16.25")
    second = result["lines"][1]
    assert second["material_code"].startswith("*橡胶制品*")
    assert second["quantity"] == Decimal("2.5")


def test_map_ai_invoice_payload_rejects_empty_lines():
    with pytest.raises(ValidationError, match="明细行"):
        map_ai_invoice_payload({"supplierName": "A", "lines": []})


def test_map_ai_invoice_payload_accepts_chinese_keys_and_amount_qty():
    result = map_ai_invoice_payload(
        {
            "销售方名称": "苏州测试材料有限公司",
            "明细": [
                {
                    "项目名称": "*塑料制品*ABS粒子",
                    "规格型号": "757",
                    "单位": "千克",
                    "数量": "100",
                    "金额": "1250.00",
                    "税额": "162.50",
                }
            ],
        }
    )
    assert result["supplier_name"] == "苏州测试材料有限公司"
    assert len(result["lines"]) == 1
    row = result["lines"][0]
    assert row["material_name"] == "*塑料制品*ABS粒子"
    assert row["quantity"] == Decimal("100")
    assert row["invoice_unit_price"] == Decimal("12.5")
    assert row["tax_amount"] == Decimal("162.50")


def test_parse_einvoice_pdf_bytes_prefer_ai_skips_rapid_ocr():
    from apps.haoligo.services.finance_einvoice_parser import parse_einvoice_pdf_bytes

    sample_qr = "01,31,,26442000004359167806,1705400.00,20260421,,8EEF"
    pdf_bytes = b"%PDF-fake"

    with (
        patch(
            "apps.haoligo.services.finance_einvoice_parser.extract_qr_texts_from_pdf_bytes",
            return_value=[sample_qr],
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_parser.extract_seller_name_from_pdf_text",
            return_value=None,
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_pdf_text.pdf_text_layer_available",
            return_value=True,
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_pdf_text.pdf_has_detail_text_layer",
            return_value=False,
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_pdf_text.extract_seller_name_from_pdf_text_layer",
            return_value=None,
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_ocr._ocr_pdf_all_pages_rows",
            return_value=[["should", "not", "run"]],
        ) as ocr_pages,
        patch(
            "apps.haoligo.services.finance_einvoice_ocr._ocr_pdf_first_page_rows",
            return_value=[["header"]],
        ) as ocr_header,
    ):
        parsed = parse_einvoice_pdf_bytes(pdf_bytes, prefer_ai_for_lines=True)

    assert parsed["invoice_no"] == "26442000004359167806"
    assert parsed["needs_lines"] is True
    assert parsed["parse_source"] == "pdf_qr"
    ocr_pages.assert_not_called()
    ocr_header.assert_not_called()


def test_parse_einvoice_pdf_bytes_without_prefer_ai_uses_rapid_ocr():
    from apps.haoligo.services.finance_einvoice_parser import parse_einvoice_pdf_bytes

    sample_qr = "01,31,,26442000004359167806,1705400.00,20260421,,8EEF"
    pdf_bytes = b"%PDF-fake"
    fake_line = {
        "material_code": "X1",
        "material_name": "测试物料",
        "spec": None,
        "unit": "个",
        "quantity": Decimal("1"),
        "invoice_unit_price": Decimal("10"),
        "invoice_unit_price_literal": "10",
    }

    with (
        patch(
            "apps.haoligo.services.finance_einvoice_parser.extract_qr_texts_from_pdf_bytes",
            return_value=[sample_qr],
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_parser.extract_seller_name_from_pdf_text",
            return_value=None,
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_pdf_text.pdf_text_layer_available",
            return_value=True,
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_pdf_text.pdf_has_detail_text_layer",
            return_value=False,
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_pdf_text.extract_seller_name_from_pdf_text_layer",
            return_value=None,
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_ocr.ocr_available",
            return_value=True,
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_ocr._ocr_pdf_first_page_rows",
            return_value=[],
        ),
        patch(
            "apps.haoligo.services.finance_einvoice_ocr._ocr_pdf_all_pages_rows",
            return_value=[["row"]],
        ) as ocr_pages,
        patch(
            "apps.haoligo.services.finance_einvoice_ocr.parse_invoice_lines_from_ocr_rows",
            return_value=[fake_line],
        ),
    ):
        parsed = parse_einvoice_pdf_bytes(pdf_bytes, prefer_ai_for_lines=False)

    assert parsed["parse_source"] == "pdf_qr_ocr"
    assert parsed["needs_lines"] is False
    assert len(parsed["lines"]) == 1
    ocr_pages.assert_called_once()


@pytest.mark.asyncio
async def test_review_invoice_lines_with_ai_fixes_unit():
    from apps.haoligo.services import finance_invoice_ai_ocr as mod
    from decimal import Decimal

    draft_lines = [
        {
            "material_code": "030300004",
            "material_name": "剥头保护器(130°)",
            "spec": "030300004",
            "unit": "保护",
            "quantity": Decimal("50000"),
            "invoice_unit_price": Decimal("0.52"),
            "invoice_unit_price_literal": "0.52",
            "tax_amount": Decimal("1"),
        }
    ]
    chat_json = {
        "choices": [
            {
                "message": {
                    "content": (
                        '{"supplierName":"测试","lines":['
                        '{"materialCode":"030300004","materialName":"剥头保护器(130°)",'
                        '"spec":"030300004","unit":"只","quantity":50000,'
                        '"unitPrice":"0.52","taxAmount":1}]}'
                    )
                }
            }
        ]
    }
    with (
        patch.object(mod, "PYMUPDF_AVAILABLE", True),
        patch.object(mod, "_pdf_plain_text_for_review", return_value="单位 只 剥头保护器"),
        patch.object(
            mod,
            "get_deepseek_runtime_config",
            return_value={
                "chat_api_key": "k",
                "chat_base_url": "https://api.example.com",
                "chat_model": "deepseek-chat",
                "ocr_base_url": None,
                "ocr_model": None,
                "ocr_api_key": "k",
                "ocr_configured": False,
            },
        ),
        patch.object(mod, "post_chat_completions", return_value=chat_json),
    ):
        result = await mod.review_invoice_lines_with_ai(
            tenant_id=1,
            pdf_bytes=b"%PDF-1.4",
            draft_lines=draft_lines,
            supplier_name="测试",
        )

    assert result["parse_source"] == "ai_review"
    assert result["lines"][0]["unit"] == "只"
    assert result["lines"][0]["material_name"] == "剥头保护器(130°)"


@pytest.mark.asyncio
async def test_extract_invoice_from_pdf_bytes_end_to_end_mocked():
    from apps.haoligo.services import finance_invoice_ai_ocr as mod

    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
    chat_json = {
        "choices": [
            {
                "message": {
                    "content": (
                        '{"supplierName":"供应商甲","lines":['
                        '{"materialCode":"A1","materialName":"物料A","spec":"S",'
                        '"unit":"个","quantity":2,"unitPrice":"5.00","taxAmount":1.3}]}'
                    )
                }
            }
        ]
    }

    with (
        patch.object(mod, "PYMUPDF_AVAILABLE", True),
        patch.object(mod, "_pdf_page_count", return_value=1),
        patch.object(mod, "_pdf_page_png_bytes", return_value=png),
        patch.object(
            mod,
            "get_deepseek_runtime_config",
            return_value={
                "chat_api_key": "k",
                "chat_base_url": "https://api.example.com",
                "chat_model": "deepseek-chat",
                "ocr_base_url": "https://ocr.example.com/v1",
                "ocr_model": "deepseek-ai/DeepSeek-OCR",
                "ocr_api_key": "k",
                "ocr_configured": True,
            },
        ),
        patch.object(mod, "extract_text_from_image", return_value="发票 OCR 文本 物料A"),
        patch.object(mod, "post_chat_completions", return_value=chat_json),
    ):
        result = await mod.extract_invoice_from_pdf_bytes(tenant_id=1, pdf_bytes=b"%PDF-1.4")

    assert result["parse_source"] == "pdf_qr_ai"
    assert result["supplier_name"] == "供应商甲"
    assert result["lines"][0]["material_code"] == "A1"
    assert result["lines"][0]["invoice_unit_price"] == Decimal("5.00")
