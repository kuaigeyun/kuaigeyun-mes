"""业务金额小数位量化/展示（与配置中心 common.amount_decimal_places 对齐）。"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

# 与 BusinessConfigService.get_amount_decimal_places(max_places=6) 一致
_AMOUNT_PLACES_CEILING = 6


def quantize_business_amount(value: Any, decimal_places: int) -> Decimal:
    """按配置金额小数位（0–6）半入舍入。"""
    places = max(0, min(_AMOUNT_PLACES_CEILING, int(decimal_places)))
    step = Decimal(1).scaleb(-places) if places > 0 else Decimal(1)
    if value is None:
        return Decimal(0)
    if isinstance(value, Decimal):
        d = value
    else:
        try:
            d = Decimal(str(value).strip().replace(",", ""))
        except (InvalidOperation, ValueError, TypeError):
            return Decimal(0)
    if not d.is_finite():
        return Decimal(0)
    return d.quantize(step, rounding=ROUND_HALF_UP)


def format_business_amount(value: Any, decimal_places: int) -> str:
    """按配置金额小数位格式化为定长小数字符串（打印/展示，禁止裸 str(Decimal)）。"""
    return format(quantize_business_amount(value, decimal_places), "f")
