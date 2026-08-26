"""生产领料防超发 Decimal 比较单元测试。"""

from decimal import Decimal

from apps.kuaizhizao.utils.picking_posting import (
    exceeds_work_order_pick_limit,
    format_pick_limit_qty,
)


def test_exceeds_pick_limit_equal_decimal_qty_not_blocked():
    assert exceeds_work_order_pick_limit(Decimal("0.29"), Decimal("0.29")) is False
    assert exceeds_work_order_pick_limit(Decimal("1.71"), Decimal("1.71")) is False


def test_exceeds_pick_limit_float_bom_drift_not_blocked_when_display_equal():
    # BOM float 乘 1.01 曾导致 0.29 误拦；量化后应放行
    allowed = Decimal(str(0.287128712871287))
    total = Decimal("0.29")
    assert exceeds_work_order_pick_limit(total, allowed) is False


def test_exceeds_pick_limit_blocks_material_over_cap():
    assert exceeds_work_order_pick_limit(Decimal("1.00"), Decimal("0.50")) is True


def test_format_pick_limit_qty_strips_trailing_zeros():
    assert format_pick_limit_qty(Decimal("0.2900")) == "0.29"
    assert format_pick_limit_qty(Decimal("1.7100")) == "1.71"
