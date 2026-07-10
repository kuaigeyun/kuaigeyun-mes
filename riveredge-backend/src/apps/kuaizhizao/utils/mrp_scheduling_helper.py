"""MRP/LRP 排程辅助：交期锚定倒排、需求交期解析与合并。"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional


def normalize_planning_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if hasattr(value, "date"):
        try:
            return value.date()
        except Exception:
            return None
    return None


def merge_requirement_delivery_date(existing: Any, incoming: Any) -> Optional[date]:
    """合并需求交期：取更早者（更紧迫）。"""
    ex = normalize_planning_date(existing)
    inc = normalize_planning_date(incoming)
    if ex is None:
        return inc
    if inc is None:
        return ex
    return min(ex, inc)


def resolve_demand_item_delivery_date(
    demand_item: Any,
    demand_by_id: Optional[Dict[int, Any]] = None,
) -> Optional[date]:
    """需求明细交期；明细为空时回落需求头/订单交期。"""
    dd = normalize_planning_date(getattr(demand_item, "delivery_date", None))
    if dd is not None:
        return dd
    demand_id = getattr(demand_item, "demand_id", None)
    if demand_id is None or not demand_by_id:
        return None
    demand = demand_by_id.get(int(demand_id))
    if not demand:
        return None
    for attr in ("delivery_date", "end_date"):
        head = normalize_planning_date(getattr(demand, attr, None))
        if head is not None:
            return head
    return None


def compute_backward_production_schedule(
    delivery_date: Any,
    lead_days: int,
    buffer_days: int = 0,
    *,
    today: Optional[date] = None,
) -> tuple[Optional[date], Optional[date]]:
    """
    交期锚定倒排：完工日 = 需求交期；开工日 = 交期 - 提前期 - 缓冲。
    开工日早于今天时不后移交期，仅将开工 clamp 到今天（交期风险由 is_overdue_risk 提示）。
    """
    due = normalize_planning_date(delivery_date)
    if due is None:
        return None, None
    anchor_today = today or date.today()
    try:
        lt = max(0, int(lead_days))
    except (TypeError, ValueError):
        lt = 0
    try:
        buf = max(0, int(buffer_days))
    except (TypeError, ValueError):
        buf = 0
    completion = due
    start = completion - timedelta(days=lt + buf)
    if start < anchor_today:
        start = anchor_today
    return start, completion


def planning_date_to_work_order_start(value: Any) -> Optional[datetime]:
    d = normalize_planning_date(value)
    if d is None:
        return None
    return datetime.combine(d, datetime.min.time())


def planning_date_to_work_order_end(value: Any) -> Optional[datetime]:
    """工单交期锚点：计划结束日取当日末，供工序倒排对齐。"""
    d = normalize_planning_date(value)
    if d is None:
        return None
    return datetime.combine(d, datetime.max.time().replace(microsecond=0))


def apply_bom_pegged_production_schedules(
    rows: Dict[int, Dict[str, Any]],
    *,
    today: Optional[date] = None,
) -> None:
    """
    BOM 子件挂接：子件计划完工锚定父件计划开工（父件开工前子件须齐套）。
    按 bom_level 升序处理，确保父件排程先于子件。
    """
    anchor_today = today or date.today()
    ordered_ids = sorted(
        rows.keys(),
        key=lambda mid: (rows[mid].get("bom_level", 0), mid),
    )
    for material_id in ordered_ids:
        row = rows[material_id]
        parent_ids = row.get("parent_material_ids") or set()
        if not parent_ids:
            continue
        parent_starts: list[date] = []
        for pid in parent_ids:
            parent_row = rows.get(int(pid))
            if not parent_row:
                continue
            ps = normalize_planning_date(parent_row.get("production_start_date"))
            if ps is not None:
                parent_starts.append(ps)
        if not parent_starts:
            continue
        peg_due = min(parent_starts)
        source_type = row.get("source_type")
        buffer_days = int(row.get("schedule_buffer_days") or 0)
        if source_type == "Make" and float(row.get("planning_qty") or 0) > 0:
            lead = int(row.get("production_lead_time") or 0)
            start, end = compute_backward_production_schedule(
                peg_due, lead, buffer_days, today=anchor_today,
            )
            row["production_start_date"] = start
            row["production_completion_date"] = end
        elif source_type == "Outsource" and float(row.get("planning_qty") or 0) > 0:
            lead = int(row.get("outsource_lead_time") or 0)
            start, end = compute_backward_production_schedule(
                peg_due, lead, buffer_days, today=anchor_today,
            )
            row["production_start_date"] = start
            row["production_completion_date"] = end
        elif source_type == "Buy" and float(row.get("planning_qty") or 0) > 0:
            lead = int(row.get("purchase_lead_time") or 0)
            start, end = compute_backward_production_schedule(
                peg_due, lead, buffer_days, today=anchor_today,
            )
            row["procurement_start_date"] = start
            row["procurement_completion_date"] = end

