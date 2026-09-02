"""销售出库参考日期辅助。"""

from datetime import datetime, timezone
from types import SimpleNamespace

from apps.kuaizhizao.utils.sales_delivery_helper import (
    sales_delivery_reference_date,
    sales_delivery_reference_date_str,
)


def test_sales_delivery_reference_date_from_delivery_time():
    delivery = SimpleNamespace(
        delivery_time=datetime(2026, 9, 1, 15, 30, tzinfo=timezone.utc),
    )
    assert sales_delivery_reference_date_str(delivery) == "2026-09-01"
    assert sales_delivery_reference_date(delivery) is not None


def test_sales_delivery_reference_date_without_time():
    delivery = SimpleNamespace(delivery_time=None)
    assert sales_delivery_reference_date(delivery) is None
    assert sales_delivery_reference_date_str(delivery) is None
