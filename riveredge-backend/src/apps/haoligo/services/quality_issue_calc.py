"""好力 GO — 品质问题不良率计算（前后端同一公式）。"""

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


def calc_defect_rate(completed_qty: Number, defect_qty: Number) -> Optional[Decimal]:
    """不良率 = 不良数量 / 完成数量 × 100%；完成数量≤0 时不计算。"""
    completed = _to_decimal(completed_qty)
    if completed is None or completed <= 0:
        return None
    defects = _to_decimal(defect_qty)
    if defects is None:
        defects = Decimal("0")
    rate = defects / completed * Decimal("100")
    return rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
