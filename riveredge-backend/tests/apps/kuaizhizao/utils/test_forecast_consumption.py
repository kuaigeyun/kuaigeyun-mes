"""预测冲销单元测试"""

from datetime import date
from decimal import Decimal

from apps.kuaizhizao.utils.forecast_consumption import (
    allocate_forecast_consumption,
    forecast_open_quantity,
    net_forecast_gross_by_sales_orders,
)


def test_forecast_open_quantity():
    assert forecast_open_quantity(100, 40) == Decimal("60")
    assert forecast_open_quantity(10, 20) == Decimal("0")


def test_allocate_fifo_within_window():
    lines = [
        {"id": 1, "material_id": 9, "forecast_date": date(2026, 8, 1), "open_qty": Decimal("50")},
        {"id": 2, "material_id": 9, "forecast_date": date(2026, 8, 10), "open_qty": Decimal("80")},
    ]
    allocs = allocate_forecast_consumption(
        so_material_id=9,
        so_qty=Decimal("60"),
        so_date=date(2026, 8, 5),
        forecast_lines=lines,
        backward_days=10,
        forward_days=30,
    )
    assert len(allocs) == 2
    assert allocs[0]["forecast_item_id"] == 1
    assert allocs[0]["qty"] == Decimal("50")
    assert allocs[1]["qty"] == Decimal("10")
    assert lines[1]["open_qty"] == Decimal("70")


def test_net_forecast_gross_by_sales_orders():
    netted, consumed = net_forecast_gross_by_sales_orders(
        forecast_rows=[(date(2026, 8, 1), 100.0)],
        sales_order_rows=[(date(2026, 8, 5), 40.0)],
        backward_days=30,
        forward_days=30,
    )
    assert consumed == 40.0
    assert netted == [(date(2026, 8, 1), 60.0)]
