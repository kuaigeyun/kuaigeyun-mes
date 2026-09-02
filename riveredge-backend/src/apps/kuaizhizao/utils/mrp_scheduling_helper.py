"""MRP/LRP 排程辅助：交期锚定倒排 / 尽早开工正排、需求交期解析与合并。"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, Literal, Optional

ScheduleDirection = Literal["backward", "forward"]


def normalize_schedule_direction(value: Any) -> ScheduleDirection:
    if isinstance(value, str) and value.strip().lower() == "forward":
        return "forward"
    return "backward"


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


def _lead_buffer_days(lead_days: int, buffer_days: int) -> int:
    try:
        lt = max(0, int(lead_days))
    except (TypeError, ValueError):
        lt = 0
    try:
        buf = max(0, int(buffer_days))
    except (TypeError, ValueError):
        buf = 0
    return lt + buf


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
    span = _lead_buffer_days(lead_days, buffer_days)
    completion = due
    start = completion - timedelta(days=span)
    if start < anchor_today:
        start = anchor_today
    return start, completion


def compute_forward_production_schedule(
    delivery_date: Any,
    lead_days: int,
    buffer_days: int = 0,
    *,
    today: Optional[date] = None,
) -> tuple[Optional[date], Optional[date], bool]:
    """
    尽早开工正排：开工日 = 今天；完工日 = 开工 + 提前期 + 缓冲。
    返回 (start, completion, late_vs_demand)；late 表示完工晚于原需求交期。
    delivery_date 仅用于判断是否晚于交期；缺省时 late=False。
    """
    anchor_today = today or date.today()
    span = _lead_buffer_days(lead_days, buffer_days)
    start = anchor_today
    completion = start + timedelta(days=span)
    due = normalize_planning_date(delivery_date)
    late = bool(due is not None and completion > due)
    return start, completion, late


def compute_production_schedule(
    delivery_date: Any,
    lead_days: int,
    buffer_days: int = 0,
    *,
    today: Optional[date] = None,
    schedule_direction: Any = "backward",
) -> tuple[Optional[date], Optional[date], bool]:
    """统一入口。返回 (start, end, late_vs_demand)；倒排时 late 恒为 False。"""
    if normalize_schedule_direction(schedule_direction) == "forward":
        return compute_forward_production_schedule(
            delivery_date, lead_days, buffer_days, today=today,
        )
    start, end = compute_backward_production_schedule(
        delivery_date, lead_days, buffer_days, today=today,
    )
    return start, end, False


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


def should_prefer_source_document_planned_dates(
    item: Any,
    *,
    source_end: Optional[date],
) -> bool:
    """
    成品/顶层需求：用来源单据起止替代 MRP 分桶 release/receipt。
    BOM 子件（完工日早于需求交期）：保留 MRP 挂接结果。
    """
    if source_end is None:
        return False
    mrp_end = normalize_planning_date(getattr(item, "production_completion_date", None))
    item_delivery = normalize_planning_date(getattr(item, "delivery_date", None))
    if mrp_end and item_delivery and mrp_end < item_delivery:
        return False
    return True


def resolve_work_order_planned_dates_for_push(
    *,
    source_start: Optional[date],
    source_end: Optional[date],
    mrp_start: Optional[date],
    mrp_end: Optional[date],
    schedule_direction: Any = "backward",
    prefer_source: bool = False,
) -> tuple[Optional[datetime], Optional[datetime]]:
    """MRP 下推工单计划时间：来源单据优先，否则回落 MRP production 日期。"""
    if prefer_source and (source_start or source_end):
        use_start = source_start or mrp_start
        use_end = source_end or mrp_end
    else:
        use_start = mrp_start or source_start
        use_end = mrp_end or source_end

    if use_start and use_end and use_start > use_end:
        use_start, use_end = use_end, use_start

    planned_start = planning_date_to_work_order_start(use_start) if use_start else None
    if normalize_schedule_direction(schedule_direction) == "forward":
        planned_end = None
    else:
        planned_end = planning_date_to_work_order_end(use_end) if use_end else None
    return planned_start, planned_end


async def resolve_source_production_window(
    tenant_id: int,
    *,
    computation: Any,
    item: Any,
) -> tuple[Optional[date], Optional[date]]:
    """解析来源需求/销售订单的计划窗口（start/end 日历日）。"""
    from apps.kuaizhizao.models.demand import Demand
    from apps.kuaizhizao.models.demand_item import DemandItem

    start_dates: list[date] = []
    end_dates: list[date] = []

    raw_ids = getattr(item, "demand_item_ids", None) or []
    demand_item_id = getattr(item, "demand_item_id", None)
    demand_item_ids: list[int] = []
    if demand_item_id is not None:
        try:
            demand_item_ids.append(int(demand_item_id))
        except (TypeError, ValueError):
            pass
    if isinstance(raw_ids, list):
        for raw in raw_ids:
            try:
                demand_item_ids.append(int(raw))
            except (TypeError, ValueError):
                continue

    if demand_item_ids:
        demand_items = await DemandItem.filter(
            tenant_id=tenant_id, id__in=list(set(demand_item_ids))
        ).all()
        demand_hdr_ids = {int(di.demand_id) for di in demand_items if di.demand_id}
        demands = {
            d.id: d
            for d in await Demand.filter(tenant_id=tenant_id, id__in=list(demand_hdr_ids)).all()
        }
        for di in demand_items:
            dd = resolve_demand_item_delivery_date(di, demands)
            nd = normalize_planning_date(dd)
            if nd:
                end_dates.append(nd)
            hdr = demands.get(int(di.demand_id)) if di.demand_id else None
            if hdr:
                ns = normalize_planning_date(getattr(hdr, "start_date", None))
                if ns:
                    start_dates.append(ns)
                for attr in ("end_date", "delivery_date"):
                    ne = normalize_planning_date(getattr(hdr, attr, None))
                    if ne:
                        end_dates.append(ne)
                        break

    demand_id = getattr(computation, "demand_id", None)
    if demand_id and not start_dates and not end_dates:
        demand = await Demand.get_or_none(tenant_id=tenant_id, id=int(demand_id))
        if demand:
            ns = normalize_planning_date(getattr(demand, "start_date", None))
            if ns:
                start_dates.append(ns)
            for attr in ("end_date", "delivery_date"):
                ne = normalize_planning_date(getattr(demand, attr, None))
                if ne:
                    end_dates.append(ne)
                    break

    item_dd = normalize_planning_date(getattr(item, "delivery_date", None))
    if item_dd:
        end_dates.append(item_dd)

    start = min(start_dates) if start_dates else None
    end = max(end_dates) if end_dates else None
    if start and end and start > end:
        start, end = end, start
    return start, end


def apply_bom_pegged_production_schedules(
    rows: Dict[int, Dict[str, Any]],
    *,
    today: Optional[date] = None,
    schedule_direction: Any = "backward",
) -> None:
    """
    BOM 子件挂接：
    - 倒排：子件计划完工锚定父件计划开工（父件开工前子件须齐套）；
    - 正排：子件开工 = 父件开工 − 子件提前期，再推子件完工（必要时开工钳到今天）。
    按 bom_level 升序处理，确保父件排程先于子件。
    """
    anchor_today = today or date.today()
    direction = normalize_schedule_direction(schedule_direction)
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
            # Buy 父件无 production_start 时用采购开始日
            if ps is None:
                ps = normalize_planning_date(parent_row.get("procurement_start_date"))
                if ps is not None:
                    parent_starts.append(ps)
        if not parent_starts:
            continue
        peg_due = min(parent_starts)
        source_type = row.get("source_type")
        buffer_days = int(row.get("schedule_buffer_days") or 0)
        planning_qty = float(row.get("planning_qty") or 0)
        if planning_qty <= 0:
            continue

        if source_type == "Make":
            lead = int(row.get("production_lead_time") or 0)
            start, end, _late = _peg_child_schedule(
                peg_due, lead, buffer_days, today=anchor_today, direction=direction,
            )
            row["production_start_date"] = start
            row["production_completion_date"] = end
        elif source_type == "Outsource":
            lead = int(row.get("outsource_lead_time") or 0)
            start, end, _late = _peg_child_schedule(
                peg_due, lead, buffer_days, today=anchor_today, direction=direction,
            )
            row["production_start_date"] = start
            row["production_completion_date"] = end
        elif source_type == "Buy":
            lead = int(row.get("purchase_lead_time") or 0)
            start, end, _late = _peg_child_schedule(
                peg_due, lead, buffer_days, today=anchor_today, direction=direction,
            )
            row["procurement_start_date"] = start
            row["procurement_completion_date"] = end


def _peg_child_schedule(
    parent_start: date,
    lead_days: int,
    buffer_days: int,
    *,
    today: date,
    direction: ScheduleDirection,
) -> tuple[Optional[date], Optional[date], bool]:
    """子件相对父件开工的挂接排程。"""
    span = _lead_buffer_days(lead_days, buffer_days)
    if direction == "forward":
        # 子件开工 = 父件开工 − 提前期；再推完工
        start = parent_start - timedelta(days=span)
        if start < today:
            start = today
        end = start + timedelta(days=span)
        late = end > parent_start
        return start, end, late
    # 倒排：完工锚定父件开工
    return (
        *compute_backward_production_schedule(
            parent_start, lead_days, buffer_days, today=today,
        ),
        False,
    )
