from decimal import Decimal

from core.utils.quantity_precision import quantize_business_quantity


def test_quantize_business_quantity_respects_places():
    assert quantize_business_quantity("1.23456", 4) == Decimal("1.2346")
    assert quantize_business_quantity("1.23456", 2) == Decimal("1.23")
    assert quantize_business_quantity("1.23456", 0) == Decimal("1")


def test_quantize_business_quantity_clamps_places():
    assert quantize_business_quantity("1.23456", 99) == Decimal("1.2346")
    assert quantize_business_quantity("1.23456", -1) == Decimal("1")
