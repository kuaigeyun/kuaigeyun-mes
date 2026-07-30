"""财务数量/单价原文精度契约。"""

from decimal import Decimal

from apps.haoligo.utils.finance_decimal import (
    normalize_quantity_literal,
    parse_quantity_decimal,
    resolve_quantity_literal,
)


def test_quantity_literal_keeps_trailing_zeros():
    assert normalize_quantity_literal("12.5000") == "12.5000"
    assert parse_quantity_decimal("12.5000") == Decimal("12.5000")
    assert resolve_quantity_literal(Decimal("12.5000"), "12.5000") == "12.5000"


def test_quantity_literal_rejects_padding_via_format():
    # 无原文时从 Decimal 还原，不得补固定位数
    assert resolve_quantity_literal(Decimal("12.5")) == "12.5"


def test_structured_invoice_keeps_quantity_literal():
    from apps.haoligo.services.finance_einvoice_parser import parse_structured_invoice_payload

    parsed = parse_structured_invoice_payload(
        {
            "invoice_no": "TESTQTY001",
            "lines": [
                {
                    "material_code": "M1",
                    "material_name": "物料",
                    "quantity": "12.5000",
                    "invoice_unit_price": "1.2500",
                }
            ],
        }
    )
    line = parsed["lines"][0]
    assert line["quantity"] == Decimal("12.5000")
    assert line["quantity_literal"] == "12.5000"
    assert line["invoice_unit_price_literal"] == "1.2500"
