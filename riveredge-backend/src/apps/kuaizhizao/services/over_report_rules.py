"""
超报规则：多层级合并后得到允许的最大累计完成数量（相对工单计划数量）。

合并顺序（后者在非 none 时覆盖前者；工艺路线序列项、工单工序行若显式传键则始终覆盖）：
物料 → 工序档案 → 路线默认 → 路线序列项 → 工单头 → 工单工序行
"""

from decimal import Decimal
from typing import Any, Optional, Tuple

OVER_REPORT_NONE = "none"
OVER_REPORT_FIXED = "fixed"
OVER_REPORT_PERCENT = "percent"


def normalize_over_report_mode(mode: Optional[str]) -> str:
    if not mode:
        return OVER_REPORT_NONE
    m = str(mode).lower().strip()
    if m in (OVER_REPORT_NONE, OVER_REPORT_FIXED, OVER_REPORT_PERCENT):
        return m
    return OVER_REPORT_NONE


def to_decimal(v: Any) -> Decimal:
    if v is None:
        return Decimal("0")
    try:
        return Decimal(str(v))
    except Exception:
        return Decimal("0")


def tuple_from_model(obj: Any, mode_attr: str = "over_report_mode", value_attr: str = "over_report_value") -> Tuple[str, Decimal]:
    if obj is None:
        return OVER_REPORT_NONE, Decimal("0")
    m = normalize_over_report_mode(getattr(obj, mode_attr, None) or OVER_REPORT_NONE)
    v = to_decimal(getattr(obj, value_attr, None))
    return m, v


def extra_has_over_report_keys(extra: Any) -> bool:
    if not isinstance(extra, dict):
        return False
    return "over_report_mode" in extra or "overReportMode" in extra


def parse_over_report_from_extra(extra: Any) -> Tuple[str, Decimal]:
    if not isinstance(extra, dict):
        return OVER_REPORT_NONE, Decimal("0")
    mode = extra.get("over_report_mode")
    if mode is None:
        mode = extra.get("overReportMode")
    raw_val = extra.get("over_report_value")
    if raw_val is None:
        raw_val = extra.get("overReportValue")
    return normalize_over_report_mode(mode), to_decimal(raw_val)


def merge_over_report_layers(
    material: Tuple[str, Decimal],
    master_op: Tuple[str, Decimal],
    route_default: Tuple[str, Decimal],
    route_step: Tuple[str, Decimal],
    route_step_explicit: bool,
    wo_header: Tuple[str, Decimal],
    line: Tuple[str, Decimal],
    line_explicit: bool,
) -> Tuple[str, Decimal]:
    m, v = normalize_over_report_mode(material[0]), to_decimal(material[1])
    for lm, lv in (master_op, route_default):
        nm = normalize_over_report_mode(lm)
        if nm != OVER_REPORT_NONE:
            m, v = nm, to_decimal(lv)
    if route_step_explicit:
        m, v = normalize_over_report_mode(route_step[0]), to_decimal(route_step[1])
    else:
        nm = normalize_over_report_mode(route_step[0])
        if nm != OVER_REPORT_NONE:
            m, v = nm, to_decimal(route_step[1])
    nm = normalize_over_report_mode(wo_header[0])
    if nm != OVER_REPORT_NONE:
        m, v = nm, to_decimal(wo_header[1])
    if line_explicit:
        m, v = normalize_over_report_mode(line[0]), to_decimal(line[1])
    else:
        nm = normalize_over_report_mode(line[0])
        if nm != OVER_REPORT_NONE:
            m, v = nm, to_decimal(line[1])
    return m, v


def max_completed_quantity_for_plan(plan_qty: Any, mode: str, value: Decimal) -> Decimal:
    plan = to_decimal(plan_qty)
    if plan < 0:
        plan = Decimal("0")
    md = normalize_over_report_mode(mode)
    if md == OVER_REPORT_NONE:
        return plan
    if md == OVER_REPORT_FIXED:
        return plan + max(to_decimal(value), Decimal("0"))
    if md == OVER_REPORT_PERCENT:
        pct = max(to_decimal(value), Decimal("0"))
        extra = plan * pct / Decimal("100")
        return plan + extra.quantize(Decimal("0.01"))
    return plan
