import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaizhizao.services.sales_order_service import SalesOrderService


@pytest.mark.unit
def test_total_proration_should_match_target_with_rounding():
    out = SalesOrderService._allocate_total_amount_with_proration(
        source_amounts=[Decimal("33.33"), Decimal("33.33"), Decimal("33.34")],
        target_total=Decimal("100.01"),
    )
    assert sum(out, Decimal("0")) == Decimal("100.01")
    assert all(v.as_tuple().exponent >= -2 for v in out)


@pytest.mark.unit
def test_total_proration_should_support_order_level_override():
    # 原行合计 150，目标总额覆盖为 120，应按比例缩放并保持总额一致
    out = SalesOrderService._allocate_total_amount_with_proration(
        source_amounts=[Decimal("50"), Decimal("100")],
        target_total=Decimal("120"),
    )
    assert out == [Decimal("40"), Decimal("80")]
    assert sum(out, Decimal("0")) == Decimal("120")


@pytest.mark.unit
def test_total_proration_should_put_amount_on_first_row_when_source_zero():
    out = SalesOrderService._allocate_total_amount_with_proration(
        source_amounts=[Decimal("0"), Decimal("0")],
        target_total=Decimal("18.88"),
    )
    assert out == [Decimal("18.88"), Decimal("0.00")]

