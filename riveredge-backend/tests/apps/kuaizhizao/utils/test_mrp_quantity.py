from decimal import Decimal

from apps.kuaizhizao.utils.mrp_quantity import (
    mrp_apply_suggested_lot_rules,
    mrp_net_requirement,
    mrp_qty,
    mrp_qty_float,
)


def test_mrp_net_requirement_three_decimals():
    assert mrp_net_requirement("3.333", "2.02") == Decimal("1.3130")


def test_mrp_net_requirement_two_decimals():
    assert mrp_net_requirement("3.03", "2.02") == Decimal("1.0100")


def test_mrp_qty_float_quantize():
    assert mrp_qty_float("3.333") == 3.333


def test_mrp_apply_suggested_lot_rules_preserves_fractional_qty():
    assert mrp_apply_suggested_lot_rules(Decimal("1.313"), None, None, None, None) == Decimal("1.3130")
    assert mrp_apply_suggested_lot_rules(Decimal("0.236"), None, None, None, None) == Decimal("0.2360")
    assert mrp_apply_suggested_lot_rules(Decimal("0"), None, None, None, None) == Decimal("0")


def test_mrp_apply_suggested_lot_rules_respects_min_multiple_without_integer_ceiling():
    assert mrp_apply_suggested_lot_rules(Decimal("1.01"), Decimal("2"), None, None, None) == Decimal("2.0000")
    assert mrp_apply_suggested_lot_rules(Decimal("1.01"), None, None, Decimal("0.5"), None) == Decimal("1.5000")
