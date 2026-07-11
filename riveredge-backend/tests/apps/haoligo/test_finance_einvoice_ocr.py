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


def test_parse_invoice_lines_temperature_protector_merged_name_spec():
    """常州鑫都电器样票：OCR 将项目名称与规格型号粘连在同一格。"""
    rows = [
        ["项目名称", "规格型号", "单位", "数量", "单价", "金额", "税率", "税额"],
        ["*家用电器配件*温度保护器125度塑壳", "个", "1000", "1.23", "1230.00", "13%", "159.90"],
        ["*家用电器配件*温度保护器140度特厚", "个", "2000", "2.34", "4680.00", "13%", "608.40"],
        ["*家用电器配件*温度保护器125度塑壳剥线头", "个", "3000", "3.45", "10350.00", "13%", "1345.50"],
        ["价税合计", "313886.70"],
    ]
    lines = parse_invoice_lines_from_ocr_rows(rows)
    assert len(lines) == 3
    assert lines[0]["material_name"] == "温度保护器"
    assert lines[0]["spec"] == "125度塑壳"
    assert lines[1]["material_name"] == "温度保护器"
    assert lines[1]["spec"] == "140度特厚"
    assert lines[2]["material_name"] == "温度保护器"
    assert lines[2]["spec"] == "125度塑壳剥线头"


def test_parse_invoice_lines_rubber_tube_with_numeric_spec_and_gen_unit():
    """浙江韦氏电器样票：纯数字规格 074300021 + 单位「根」。"""
    rows = [
        ["项目名称", "规格型号", "单位", "数量", "单价", "金额", "税率", "税额"],
        [
            "*橡胶制品*倍科橡胶管 (2000610200)",
            "074300021",
            "根",
            "23400",
            "0.95",
            "22230.00",
            "13%",
            "2889.90",
        ],
        ["价税合计", "25119.90"],
    ]
    lines = parse_invoice_lines_from_ocr_rows(rows)
    assert len(lines) == 1
    assert lines[0]["material_name"] == "倍科橡胶管 (2000610200)"
    assert lines[0]["material_code"] == "074300021"
    assert lines[0]["spec"] == "074300021"
    assert lines[0]["unit"] == "根"
    assert lines[0]["quantity"] == Decimal("23400")
    assert lines[0]["invoice_unit_price"] == Decimal("0.95")
    assert lines[0]["line_amount"] == Decimal("22230.00")
    assert lines[0]["tax_amount"] == Decimal("2889.90")


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
