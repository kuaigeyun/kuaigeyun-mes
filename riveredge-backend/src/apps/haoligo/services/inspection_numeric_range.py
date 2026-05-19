"""点检数值型取值范围与实测判定。"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, Optional, Tuple


def _to_decimal(raw: Any) -> Optional[Decimal]:
    if raw is None:
        return None
    if isinstance(raw, Decimal):
        return raw
    s = str(raw).strip()
    if not s:
        return None
    try:
        return Decimal(s.replace(",", ""))
    except (InvalidOperation, ValueError, TypeError):
        return None


def normalize_numeric_range_bounds(
    value_type: str,
    numeric_min: Any,
    numeric_max: Any,
) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """规范化点检项数值上下限；非 numeric 类型一律清空。"""
    vt = (value_type or "numeric").strip().lower()
    if vt != "numeric":
        return None, None
    lo = _to_decimal(numeric_min)
    hi = _to_decimal(numeric_max)
    if lo is not None and hi is not None and lo > hi:
        raise ValueError("取值范围下限不能大于上限")
    return lo, hi


def numeric_measured_out_of_range(
    measured_value: Optional[str],
    numeric_min: Optional[Decimal],
    numeric_max: Optional[Decimal],
) -> Optional[bool]:
    """
    判断数值实测是否超出范围（闭区间）。
    返回 None 表示未配置范围或无法判定；True 超出；False 在范围内。
    """
    if numeric_min is None and numeric_max is None:
        return None
    if not measured_value or not str(measured_value).strip():
        return None
    val = _to_decimal(measured_value)
    if val is None:
        return None
    if numeric_min is not None and val < numeric_min:
        return True
    if numeric_max is not None and val > numeric_max:
        return True
    return False


def spot_check_result_from_numeric_range(
    measured_value: Optional[str],
    numeric_min: Optional[Decimal],
    numeric_max: Optional[Decimal],
) -> Optional[str]:
    """根据数值范围推断点检行结果；无法推断时返回 None。"""
    oor = numeric_measured_out_of_range(measured_value, numeric_min, numeric_max)
    if oor is None:
        return None
    return "abnormal" if oor else "normal"
