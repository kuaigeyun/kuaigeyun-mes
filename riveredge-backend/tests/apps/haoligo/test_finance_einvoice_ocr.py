from decimal import Decimal

from apps.haoligo.services.finance_einvoice_ocr import (
    _fix_common_ocr_name_errors,
    parse_invoice_lines_from_ocr_rows,
)


def test_parse_seller_name_from_ocr_rows_fragmented_header():
    from apps.haoligo.services.finance_einvoice_ocr import parse_seller_name_from_ocr_rows

    rows = [
        ["购", "销"],
        ["名称：无锡好力泵业有限公司", "名称：广东聚石化学股份有限公司", "载"],
        ["售方", "次"],
        ["买方信", "数"],
        ["项目名称", "规格型号", "单位", "数量", "单价", "金额", "税额"],
    ]
    assert parse_seller_name_from_ocr_rows(rows) == "广东聚石化学股份有限公司"


def test_parse_seller_name_from_ocr_rows_dual_column():
    from apps.haoligo.services.finance_einvoice_ocr import parse_seller_name_from_ocr_rows

    rows = [
        ["电子发票（增值税专用发票）"],
        ["购买方信息", "销售方信息"],
        ["名称：广东好力新材料有限公司", "名称：福州市辰亿五金制品有限公司"],
        ["纳税人识别号：...", "纳税人识别号：..."],
        ["项目名称", "规格型号", "单位", "数量", "单价", "金额", "税率", "税额"],
    ]
    assert parse_seller_name_from_ocr_rows(rows) == "福州市辰亿五金制品有限公司"


def test_parse_seller_name_from_ocr_rows_seller_section():
    from apps.haoligo.services.finance_einvoice_ocr import parse_seller_name_from_ocr_rows

    rows = [
        ["销售方信息"],
        ["名称", "广州市邦程橡塑新材料有限公司"],
        ["纳税人识别号", "91440101MA..."],
        ["项目名称", "规格型号"],
    ]
    assert parse_seller_name_from_ocr_rows(rows) == "广州市邦程橡塑新材料有限公司"


def test_parse_invoice_lines_from_ocr_rows():
    rows = [
        ["项目名称", "规格型号", "单位", "数量", "单价", "金额", "税率", "税额"],
        [
            "*塑料制品*阻燃PA6",
            "4002SGO 4Y L12",
            "千克",
            "1000 26.1061946902655",
            "26106.19",
            "13%",
            "3393.81",
        ],
        ["*塑料制品*阻燃PBT", "3001C G30 3NC", "1000", "20.353982300885", "20353.98", "13%", "2646.02"],
        ["价税合计", "1705400.00"],
    ]
    lines = parse_invoice_lines_from_ocr_rows(rows)
    assert len(lines) == 2
    assert lines[0]["material_name"] == "阻燃PA6"
    assert lines[0]["material_code"] == "4002SGO 4Y L12"
    assert lines[0]["quantity"] == Decimal("1000")
    assert lines[0]["invoice_unit_price"] == Decimal("26.1061946902655")
    assert lines[0]["tax_amount"] == Decimal("3393.81")
    assert lines[1]["material_name"] == "阻燃PBT"
    assert lines[1]["unit"] is None


def test_parse_invoice_lines_merges_split_ocr_rows():
    rows = [
        ["项目名称", "规格型号", "单位", "数量", "单价", "金额", "税率", "税额"],
        ["*塑料制品*阻燃聚丙烯", "5000 B2 5GY125", "千克", "10000 14.6017699115044"],
        ["146017.70", "13%", "18980.30"],
        ["价税合计", "1705400.00"],
    ]
    lines = parse_invoice_lines_from_ocr_rows(rows)
    assert len(lines) == 1
    assert lines[0]["quantity"] == Decimal("10000")
    assert lines[0]["tax_amount"] == Decimal("18980.30")


def test_fix_common_ocr_name_errors():
    assert _fix_common_ocr_name_errors("燃PA6") == "阻燃PA6"
    assert _fix_common_ocr_name_errors("燃聚丙烯") == "阻燃聚丙烯"
    assert _fix_common_ocr_name_errors("饮性聚丙烯") == "改性聚丙烯"
    assert _fix_common_ocr_name_errors("阻燃PA6") == "阻燃PA6"


def test_split_merged_qty_price_with_amount_hint():
    from decimal import Decimal

    from apps.haoligo.services.finance_einvoice_ocr import _split_merged_qty_price

    qty, price, _, _ = _split_merged_qty_price("3900014.6017699115044", Decimal("569469.03"))
    assert qty == Decimal("39000")
    assert price == Decimal("14.6017699115044")


def test_parse_merged_qty_price_row():
    from apps.haoligo.services.finance_einvoice_ocr import _parse_invoice_detail_row

    cells = [
        "*塑料制品阻燃聚丙烯",
        "EP5001Y05WT3",
        "千克",
        "3900014.6017699115044",
        "569469.03",
        "13%",
        "74030.97",
        "59",
    ]
    parsed = _parse_invoice_detail_row(cells)
    assert parsed is not None
    assert parsed["quantity"] == Decimal("39000")
    assert parsed["invoice_unit_price"] == Decimal("14.6017699115044")
    assert parsed["line_amount"] == Decimal("569469.03")
    assert parsed["tax_amount"] == Decimal("74030.97")
    assert parsed["quantity_decimals"] == 0
    assert parsed["invoice_unit_price_decimals"] == 13
    assert parsed["line_amount_decimals"] == 2
