"""业务数量小数位量化（与配置中心 common.quantity_decimal_places 对齐）。"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any


def quantize_business_quantity(value: Any, decimal_places: int) -> Decimal:
    """按配置数量小数位（0–4）量化，默认与库字段上限一致。"""
    places = max(0, min(4, int(decimal_places)))
    step = Decimal(1).scaleb(-places) if places > 0 else Decimal(1)
    if value is None:
        return Decimal(0)
    if isinstance(value, Decimal):
        d = value
    else:
        try:
            d = Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            return Decimal(0)
    if not d.is_finite():
        return Decimal(0)
    return d.quantize(step, rounding=ROUND_HALF_UP)
