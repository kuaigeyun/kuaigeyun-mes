"""数电发票折行末字串行回归：名称「器」、规格「头」不得落入下一行。"""

from __future__ import annotations

from collections import defaultdict

from apps.haoligo.services.finance_einvoice_pdf_text import (
    _group_bands_into_items,
    _peel_leading_name_wrap,
    _peel_leading_spec_wrap,
    _redistribute_y_merged_wrap_fragments,
)


def _band(**fields: list[tuple[float, float, str]]) -> dict:
    out: dict = defaultdict(list)
    for key, tokens in fields.items():
        out[key] = list(tokens)
    return out


def test_peel_leading_name_and_spec_wrap():
    assert _peel_leading_name_wrap("器*家用电器配件*温度保护") == (
        "器",
        "*家用电器配件*温度保护",
    )
    assert _peel_leading_spec_wrap("头 140度特厚剥线") == ("头", "140度特厚剥线")
    assert _peel_leading_spec_wrap("头140度特厚剥线") == ("头", "140度特厚剥线")
    assert _peel_leading_name_wrap("*家用电器配件*温度保护") == (
        "",
        "*家用电器配件*温度保护",
    )


def test_redistribute_y_merged_wrap_fragments():
    items = [
        [
            "*家用电器配件*温度保护",
            "125度塑壳剥线",
            "个",
            "300000",
            "0.01",
            "3000",
            "13%",
            "390",
        ],
        [
            "器*家用电器配件*温度保护",
            "头 140度特厚剥线",
            "个",
            "150000",
            "0.01",
            "1500",
            "13%",
            "195",
        ],
    ]
    fixed = _redistribute_y_merged_wrap_fragments(items)
    assert fixed[0][0] == "*家用电器配件*温度保护器"
    assert fixed[0][1] == "125度塑壳剥线头"
    assert fixed[1][0] == "*家用电器配件*温度保护"
    assert fixed[1][1] == "140度特厚剥线"


def test_group_bands_attaches_name_and_spec_wrap_to_previous_row():
    """两行金额之间的「器」「头」折行属于上一行，不得并入下一行。"""
    bands = [
        (
            0,
            100.0,
            _band(
                name=[(100.0, 50.0, "*家用电器配件*温度保护")],
                spec=[(100.0, 130.0, "125度塑壳剥线")],
                unit=[(100.0, 200.0, "个")],
                quantity=[(100.0, 240.0, "300000")],
                price=[(100.0, 300.0, "0.007")],
                amount=[(100.0, 380.0, "2123.89")],
                tax_rate=[(100.0, 450.0, "13%")],
                tax=[(100.0, 500.0, "276.11")],
            ),
        ),
        (0, 112.0, _band(name=[(112.0, 50.0, "器")], spec=[(112.0, 130.0, "头")])),
        (
            0,
            124.0,
            _band(
                name=[(124.0, 50.0, "*家用电器配件*温度保护")],
                spec=[(124.0, 130.0, "140度特厚剥线")],
                unit=[(124.0, 200.0, "个")],
                quantity=[(124.0, 240.0, "150000")],
                price=[(124.0, 300.0, "0.007")],
                amount=[(124.0, 380.0, "1061.95")],
                tax_rate=[(124.0, 450.0, "13%")],
                tax=[(124.0, 500.0, "138.05")],
            ),
        ),
        (0, 136.0, _band(name=[(136.0, 50.0, "器")], spec=[(136.0, 130.0, "头")])),
        (
            0,
            148.0,
            _band(
                name=[(148.0, 50.0, "*家用电器配件*温度保护")],
                spec=[(148.0, 130.0, "130度卡插片")],
                unit=[(148.0, 200.0, "个")],
                quantity=[(148.0, 240.0, "30000")],
                price=[(148.0, 300.0, "0.5445")],
                amount=[(148.0, 380.0, "14442.48")],
                tax_rate=[(148.0, 450.0, "13%")],
                tax=[(148.0, 500.0, "1877.52")],
            ),
        ),
        (0, 160.0, _band(name=[(160.0, 50.0, "器")])),
    ]

    items = _group_bands_into_items(bands)
    assert len(items) == 3
    assert items[0][0].endswith("温度保护器")
    assert items[0][1] == "125度塑壳剥线头"
    assert items[1][0].endswith("温度保护器")
    assert items[1][1] == "140度特厚剥线头"
    assert not items[1][0].startswith("器")
    assert not items[1][1].startswith("头")
    assert items[2][0].endswith("温度保护器")
    assert items[2][1] == "130度卡插片"
    assert not items[2][0].startswith("器")
    assert not items[2][1].startswith("头")
