from decimal import Decimal
from types import SimpleNamespace

from apps.kuaizhizao.utils.material_unit_utils import (
    build_work_order_unit_fields,
    convert_from_base_quantity,
    convert_to_base_quantity,
    resolve_material_scenario_unit,
)


def _material():
    return SimpleNamespace(
        base_unit="箱",
        units={
            "units": [
                {"unit": "瓶", "numerator": 1, "denominator": 8, "scenarios": ["production"]},
            ],
            "scenarios": {"production": "瓶", "inventory": "箱"},
        },
    )


def test_resolve_production_unit():
    mat = _material()
    assert resolve_material_scenario_unit(mat, "production") == "瓶"
    assert resolve_material_scenario_unit(mat, "inventory") == "箱"


def test_convert_box_to_bottle_and_back():
    mat = _material()
    base_qty = convert_to_base_quantity(mat, Decimal("80"), from_unit="瓶")
    assert base_qty == Decimal("10")
    display_qty = convert_from_base_quantity(mat, Decimal("10"), to_unit="瓶")
    assert display_qty == Decimal("80")


def test_build_work_order_unit_fields():
    mat = _material()
    wo = SimpleNamespace(
        quantity=Decimal("10"),
        completed_quantity=Decimal("2"),
        split_remaining_quantity=None,
        qualified_quantity=Decimal("2"),
        unqualified_quantity=Decimal("0"),
    )
    fields = build_work_order_unit_fields(mat, wo)
    assert fields["base_unit"] == "箱"
    assert fields["product_unit"] == "瓶"
    assert fields["display_quantity"] == Decimal("80")
    assert fields["display_completed_quantity"] == Decimal("16")


def test_purchase_box_to_base_piece():
    """验收：1 箱 = 10 件，采购入库 1 箱 → 库存 +10 件（基础单位）"""
    mat = SimpleNamespace(
        base_unit="件",
        units={
            "units": [
                {"unit": "箱", "numerator": 10, "denominator": 1},
            ],
            "scenarios": {"purchase": "箱", "sale": "箱", "production": "件", "inventory": "件"},
        },
    )
    assert convert_to_base_quantity(mat, Decimal("1"), from_unit="箱") == Decimal("10")
    assert convert_from_base_quantity(mat, Decimal("10"), to_unit="箱") == Decimal("1")
    assert convert_from_base_quantity(mat, Decimal("2"), to_unit="件") == Decimal("2")
