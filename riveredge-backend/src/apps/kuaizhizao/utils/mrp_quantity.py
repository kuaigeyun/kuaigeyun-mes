"""MRP 数量精度：净需求与建议工单/采购/委外量统一量化到 4 位小数（展示随业务配置 formatQuantity）。"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_HALF_UP
from typing import Any, Optional

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


def mrp_apply_suggested_lot_rules(
    raw: Decimal,
    min_q: Optional[Decimal],
    max_q: Optional[Decimal],
    mult: Optional[Decimal],
    fixed_q: Optional[Decimal] = None,
) -> Decimal:
    """批量规则：固定批量 FOQ → 最小 → 倍数 → 上限；结果与净需求同精度（4 位小数）。"""
    if raw <= 0:
        return Decimal(0)
    q = raw
    if fixed_q is not None and fixed_q > 0:
        units = (q / fixed_q).to_integral_value(rounding=ROUND_CEILING)
        q = units * fixed_q
    else:
        if min_q is not None:
            q = max(q, min_q)
        if mult is not None and mult > 0:
            units = (q / mult).to_integral_value(rounding=ROUND_CEILING)
            q = units * mult
    if max_q is not None and q > max_q:
        q = max_q
    return mrp_qty(q)


