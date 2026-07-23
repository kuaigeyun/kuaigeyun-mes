"""数电发票折行末字串行回归：名称「器」、规格「头」不得落入下一行。"""

from __future__ import annotations

from collections import defaultdict

from apps.haoligo.services.finance_einvoice_pdf_text import (
    _clip_band_non_name_columns,
    _group_bands_into_items,
    _peel_leading_name_wrap,
    _peel_leading_spec_wrap,
    _redistribute_y_merged_wrap_fragments,
    _wrap_continuation_band_to_absorb,
)


def _band(**fields: list[tuple[float, float, str]]) -> dict:
    out: dict = defaultdict(list)
    for key, tokens in fields.items():
        out[key] = list(tokens)
    return out


def test_join_name_parts_inserts_space_between_latin_segments():
    from apps.haoligo.services.finance_einvoice_pdf_text import _join_name_parts

    assert _join_name_parts(["*塑料制品*DPP", "PPC20(黑）塑料粒子"]) == (
        "*塑料制品*DPP PPC20(黑）塑料粒子"
    )


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


def test_clip_band_drops_tokens_outside_column_x_bounds():
    """名称折行溢出到单位列左侧 x 时，不得并入单位（结构性 x 区间，非词表）。"""
    anchors = {
        "name": 50.0,
        "spec": 150.0,
        "unit": 200.0,
        "quantity": 240.0,
        "price": 300.0,
        "amount": 380.0,
        "tax_rate": 450.0,
        "tax": 500.0,
    }
    band = _band(
        name=[(100.0, 50.0, "剥头")],
        spec=[(100.0, 152.0, "030300007")],
        # x=164 落在 name/spec 与 unit 中点附近，属名称溢出，不应进单位列
        unit=[(100.0, 164.0, "保护"), (100.0, 198.0, "只")],
        quantity=[(100.0, 245.0, "50000")],
        price=[(100.0, 305.0, "0.01")],
        amount=[(100.0, 385.0, "500")],
        tax_rate=[(100.0, 455.0, "13%")],
        tax=[(100.0, 505.0, "65")],
    )
    clipped = _clip_band_non_name_columns(band, anchors)
    assert [t for *_xy, t in clipped["unit"]] == ["只"]
    assert [t for *_xy, t in clipped["spec"]] == ["030300007"]


def test_wrap_continuation_drops_spec_when_same_y_name_duplicate():
    """同 y 规格列「器130°」与名称列「(130°)」交叉重复 → 丢弃规格。"""
    wrap = _band(
        name=[(112.0, 50.0, "(130°)")],
        spec=[(112.0, 160.0, "器130°")],
    )
    absorb = _wrap_continuation_band_to_absorb(wrap)
    assert absorb == {"name": [(112.0, 50.0, "(130°)")]}
    assert "spec" not in absorb


def test_wrap_continuation_keeps_legitimate_name_and_spec_wrap():
    """名称「器」与规格「头」同 y 合法折行，与名称列无共享字符，须同时保留。"""
    wrap = _band(
        name=[(112.0, 50.0, "器")],
        spec=[(112.0, 130.0, "头")],
    )
    absorb = _wrap_continuation_band_to_absorb(wrap)
    assert absorb.get("name") == [(112.0, 50.0, "器")]
    assert absorb.get("spec") == [(112.0, 130.0, "头")]


def test_group_bands_name_overflow_does_not_pollute_spec_or_unit():
    """金额行单位列左侧溢出 + 折行名称溢出规格列 → 单位/规格仍取列内真值。"""
    bands = [
        (
            0,
            100.0,
            _band(
                name=[(100.0, 50.0, "*电子元件*剥头保护")],
                spec=[(100.0, 152.0, "030300007")],
                unit=[(100.0, 198.0, "只")],
                quantity=[(100.0, 245.0, "90000")],
                price=[(100.0, 305.0, "0.01")],
                amount=[(100.0, 385.0, "900")],
                tax_rate=[(100.0, 455.0, "13%")],
                tax=[(100.0, 505.0, "117")],
            ),
        ),
        (
            0,
            112.0,
            _band(
                name=[(112.0, 50.0, "器(130°)")],
                spec=[(112.0, 160.0, "器130°")],
            ),
        ),
    ]
    items = _group_bands_into_items(bands)
    assert len(items) == 1
    assert items[0][0].endswith("剥头保护器(130°)")
    assert items[0][1] == "030300007"
    assert items[0][2] == "只"
