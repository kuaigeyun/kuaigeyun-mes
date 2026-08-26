from decimal import Decimal

from apps.kuaizhizao.utils.mrp_quantity import (
    mrp_net_requirement,
    mrp_qty,
    mrp_qty_float,
    mrp_suggested_integer,
)


def test_mrp_net_requirement_three_decimals():
    assert mrp_net_requirement("3.333", "2.02") == Decimal("1.3130")


def test_mrp_net_requirement_two_decimals():
    assert mrp_net_requirement("3.03", "2.02") == Decimal("1.0100")


def test_mrp_suggested_integer_ceiling():
    assert mrp_suggested_integer("1.01") == Decimal("2")
    assert mrp_suggested_integer("1.313") == Decimal("2")
    assert mrp_suggested_integer("0") == Decimal("0")


def test_mrp_qty_float_quantize():
    assert mrp_qty_float("3.333") == 3.333
