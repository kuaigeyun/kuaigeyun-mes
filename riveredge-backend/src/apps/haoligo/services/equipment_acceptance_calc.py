"""好力 GO — 设备验收合格率计算（前后端同一公式）。"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Union

Number = Union[int, float, Decimal, str, None]


def _to_decimal(value: Number) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:
        return None


def calc_pass_rate(quantity: Number, defect_qty: Number) -> Optional[Decimal]:
    """合格率 = (数量 − 不良数量) / 数量 × 100%；数量≤0 时不计算。"""
    qty = _to_decimal(quantity)
    if qty is None or qty <= 0:
        return None
    defects = _to_decimal(defect_qty)
    if defects is None:
        defects = Decimal("0")
    rate = (qty - defects) / qty * Decimal("100")
    return rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
