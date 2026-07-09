"""BOM 基准数量展开公式单元测试。"""

from decimal import Decimal

import pytest

from apps.kuaizhizao.utils.bom_helper import (
    bom_line_unit_quantity,
    bom_line_required_quantity,
    bom_line_required_quantity_decimal,
)
from infra.exceptions.exceptions import ValidationError


def test_unit_quantity_default_base_is_one():
    assert bom_line_unit_quantity(Decimal("5")) == Decimal("5")


def test_unit_quantity_with_base_100():
    assert bom_line_unit_quantity(Decimal("5"), Decimal("100")) == Decimal("0.05")


def test_required_quantity_produce_1000_from_base_100():
    actual = bom_line_required_quantity(
        Decimal("5"),
        Decimal("100"),
        1000,
        Decimal("0"),
    )
    assert actual == pytest.approx(50.0)


def test_required_quantity_with_waste_rate():
    actual = bom_line_required_quantity(
        Decimal("5"),
        Decimal("100"),
        1000,
        Decimal("10"),
    )
    assert actual == pytest.approx(55.0)


def test_required_quantity_decimal_matches_float():
    dec = bom_line_required_quantity_decimal(
        Decimal("5"),
        Decimal("100"),
        Decimal("1000"),
        Decimal("10"),
    )
    assert float(dec) == pytest.approx(55.0)


def test_base_quantity_must_be_positive():
    with pytest.raises(ValidationError):
        bom_line_unit_quantity(Decimal("5"), Decimal("0"))
