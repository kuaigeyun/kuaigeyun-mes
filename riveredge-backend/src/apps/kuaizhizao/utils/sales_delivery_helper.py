"""销售出库单展示/取单辅助。"""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from core.utils.timezone_utils import to_site_date


def sales_delivery_reference_date(delivery: Any) -> Optional[date]:
    """参考日期：实际出库时间的站点日历日（SalesDelivery 无 delivery_date 字段）。"""
    delivery_time = getattr(delivery, "delivery_time", None)
    if delivery_time is None:
        return None
    return to_site_date(delivery_time)


def sales_delivery_reference_date_str(delivery: Any) -> Optional[str]:
    ref = sales_delivery_reference_date(delivery)
    return str(ref) if ref is not None else None
