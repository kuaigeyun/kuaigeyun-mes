"""MRP 数量精度与建议量取整（与前端 formatQuantity 两位小数对齐）。"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_HALF_UP
from typing import Any

MRP_QTY_STEP = Decimal("0.0001")


def mrp_qty(value: Any, *, default: Decimal = Decimal("0")) -> Decimal:
    """解析业务数量并量化到 4 位小数（与需求计算明细字段一致）。"""
    if value is None:
        return default
    if isinstance(value, Decimal):
        d = value
    else:
        if isinstance(value, str):
            s = value.strip()
            if not s or s.lower() in ("none", "null", "nan"):
                return default
        try:
            d = Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            return default
    if not d.is_finite():
        return default
    return d.quantize(MRP_QTY_STEP, rounding=ROUND_HALF_UP)


def mrp_qty_float(value: Any, *, default: float = 0.0) -> float:
    return float(mrp_qty(value, default=Decimal(str(default))))


def mrp_net_requirement(gross: Any, supply: Any) -> Decimal:
    """净需求 = max(0, 毛需求 − 可供应量)，全程 Decimal 避免 float 误差。"""
    return max(Decimal("0"), mrp_qty(gross) - mrp_qty(supply))


def mrp_suggested_integer(value: Any) -> Decimal:
    """建议工单/采购/委外量：向上取整为整数（0 保持 0）。"""
    q = mrp_qty(value)
    if q <= 0:
        return Decimal("0")
    return q.to_integral_value(rounding=ROUND_CEILING)
