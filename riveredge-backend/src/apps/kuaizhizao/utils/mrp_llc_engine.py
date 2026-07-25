"""
MRP LLC + 时间分桶净算引擎（纯函数辅助）。

供 DemandComputationService._execute_mrp_computation 调用：
- 按日桶滚算预计库存
- 生成计划订单（receipt/release）
- 产出例外信息（逾期供应、提前期内短缺、计划开工已过期等）
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple

from apps.kuaizhizao.utils.mrp_scheduling_helper import normalize_schedule_direction
from apps.kuaizhizao.utils.work_calendar import add_workdays, subtract_workdays, workdays_between

# 分桶日循环上限，防止异常交期/在途日期导致跨年扫描拖垮进程
MAX_MRP_BUCKET_DAYS = 366


def _f(v: Any) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def aggregate_qty_by_date(rows: List[Dict[str, Any]], *, qty_key: str = "qty") -> Dict[date, float]:
    out: Dict[date, float] = {}
    for row in rows:
        d = row.get("date")
        if not isinstance(d, date):
            continue
        out[d] = out.get(d, 0.0) + _f(row.get(qty_key))
    return out


def _release_date_for_receipt(
    receipt_day: date,
    lead: int,
    *,
    today: date,
    holiday_dates: Optional[Set[date]],
    use_work_calendar: bool,
) -> Tuple[date, bool]:
    """倒排：返回 (release_date, clamped_to_today)。"""
    if use_work_calendar and holiday_dates is not None:
        release = subtract_workdays(receipt_day, lead, holiday_dates)
    else:
        release = receipt_day - timedelta(days=lead)
    if release < today:
        return today, True
    return release, False


def _forward_release_receipt(
    demand_day: date,
    lead: int,
    *,
    today: date,
    holiday_dates: Optional[Set[date]],
    use_work_calendar: bool,
) -> Tuple[date, date, bool]:
    """正排：返回 (release_date, receipt_date, late_vs_demand)。"""
    release = today
    if use_work_calendar and holiday_dates is not None:
        receipt = add_workdays(release, lead, holiday_dates)
    else:
        receipt = release + timedelta(days=lead)
    return release, receipt, receipt > demand_day


def _plan_order_dates(
    demand_day: date,
    lead: int,
    *,
    today: date,
    holiday_dates: Optional[Set[date]],
    use_work_calendar: bool,
    schedule_direction: str,
) -> Tuple[date, date, List[Dict[str, Any]]]:
    """
    生成计划订单 release/receipt 及对应例外。
    净算仍在 demand_day 入账；排程日期按方向计算。
    """
    extras: List[Dict[str, Any]] = []
    if schedule_direction == "forward":
        release, receipt, late = _forward_release_receipt(
            demand_day,
            lead,
            today=today,
            holiday_dates=holiday_dates,
            use_work_calendar=use_work_calendar,
        )
        if late:
            extras.append({
                "code": "LATE_VS_DEMAND",
                "severity": (
                    f"{demand_day.isoformat()} 需求按正排完工日 {receipt.isoformat()} "
                    f"晚于交期（lead={lead}{'工作日' if use_work_calendar else '天'}）"
                ),
                "bucket_date": demand_day.isoformat(),
            })
        return release, receipt, extras

    release, clamped = _release_date_for_receipt(
        demand_day,
        lead,
        today=today,
        holiday_dates=holiday_dates,
        use_work_calendar=use_work_calendar,
    )
    if clamped:
        extras.append({
            "code": "PAST_DUE_START",
            "severity": f"{demand_day.isoformat()} 短缺对应计划开工/请购日早于今天，已钳制为今天",
            "bucket_date": demand_day.isoformat(),
        })
    if _within_lead_window(
        demand_day, today, lead, holiday_dates=holiday_dates, use_work_calendar=use_work_calendar
    ):
        extras.append({
            "code": "SHORTAGE_WITHIN_LEAD_TIME",
            "severity": (
                f"{demand_day.isoformat()} 短缺发生在提前期内"
                f"（lead={lead}{'工作日' if use_work_calendar else '天'}）"
            ),
            "bucket_date": demand_day.isoformat(),
        })
    return release, demand_day, extras


def _within_lead_window(
    demand_day: date,
    today: date,
    lead: int,
    *,
    holiday_dates: Optional[Set[date]],
    use_work_calendar: bool,
) -> bool:
    if demand_day < today:
        return False
    if use_work_calendar and holiday_dates is not None:
        return workdays_between(today, demand_day, holiday_dates) < lead
    return (demand_day - today).days < lead


def time_phased_net_material(
    *,
    gross_by_date: Dict[date, float],
    receipts_by_date: Dict[date, float],
    beginning_inventory: float,
    safety_stock: float,
    reorder_point: float,
    lead_time_days: int,
    schedule_buffer_days: int,
    include_safety_stock: bool,
    include_reorder_point: bool,
    apply_lot_fn,
    suggestion_basis: str = "net",
    today: Optional[date] = None,
    holiday_dates: Optional[Set[date]] = None,
    use_work_calendar: bool = False,
    firm_planned_orders: Optional[List[Dict[str, Any]]] = None,
    frozen: bool = False,
    schedule_direction: str = "backward",
) -> Dict[str, Any]:
    """
    单物料时间分桶净算。

    apply_lot_fn: Callable[[Decimal], Decimal] 将净需求转为计划订单量。
    suggestion_basis=gross 时按毛需求生成计划（仍做分桶展示），不扣库存/在途。
    firm_planned_orders: 已确认计划订单，按 receipt_date 计入供应，并保留在输出中。
    frozen: 冻结时不再生成新的未确认计划订单。
    schedule_direction: backward=交期倒排；forward=今天起正排。
    """
    today = today or date.today()
    lead = max(0, int(lead_time_days or 0)) + max(0, int(schedule_buffer_days or 0))
    safety = max(0.0, _f(safety_stock)) if include_safety_stock else 0.0
    rop = max(0.0, _f(reorder_point)) if include_reorder_point else 0.0
    use_cal = bool(use_work_calendar)
    direction = normalize_schedule_direction(schedule_direction)

    # 已确认计划订单视同分日供应
    receipts = dict(receipts_by_date)
    firm_out: List[Dict[str, Any]] = []
    for po in firm_planned_orders or []:
        qty = _f(po.get("qty"))
        if qty <= 0:
            continue
        rd = po.get("receipt_date")
        if isinstance(rd, str):
            try:
                rd = date.fromisoformat(rd[:10])
            except ValueError:
                rd = None
        if not isinstance(rd, date):
            continue
        receipts[rd] = receipts.get(rd, 0.0) + qty
        rel = po.get("release_date")
        if isinstance(rel, str):
            try:
                rel = date.fromisoformat(rel[:10])
            except ValueError:
                rel = None
        if not isinstance(rel, date):
            rel, _ = _release_date_for_receipt(
                rd, lead, today=today, holiday_dates=holiday_dates, use_work_calendar=use_cal
            )
        firm_out.append({
            "qty": qty,
            "receipt_date": rd,
            "release_date": rel,
            "firm": True,
            "frozen": bool(po.get("frozen", frozen)),
        })

    all_days = sorted(set(gross_by_date.keys()) | set(receipts.keys()) | {today})
    if not all_days and not firm_out:
        return {
            "gross_requirement": 0.0,
            "net_requirement": 0.0,
            "planned_order_qty": 0.0,
            "planned_orders": [],
            "time_buckets": [],
            "exceptions": [],
            "earliest_demand_date": None,
            "release_date": None,
            "receipt_date": None,
        }

    start = min(all_days[0], today) if all_days else today
    end = all_days[-1] if all_days else today
    if end < start:
        end = start

    projected = _f(beginning_inventory)
    planned_orders: List[Dict[str, Any]] = list(firm_out)
    buckets: List[Dict[str, Any]] = []
    exceptions: List[Dict[str, Any]] = []
    total_gross = 0.0
    total_net = 0.0
    total_planned = sum(_f(p.get("qty")) for p in firm_out)

    span_days = (end - start).days
    if span_days > MAX_MRP_BUCKET_DAYS:
        # 以 today 为锚截断窗口，并把窗外毛需求/供应并入边界日，避免漏算又避免数年日循环
        start = max(start, today - timedelta(days=30))
        end = start + timedelta(days=MAX_MRP_BUCKET_DAYS)
        folded_gross: Dict[date, float] = {}
        for d, q in gross_by_date.items():
            key = start if d < start else (end if d > end else d)
            folded_gross[key] = folded_gross.get(key, 0.0) + _f(q)
        gross_by_date = folded_gross
        folded_receipts: Dict[date, float] = {}
        for d, q in receipts.items():
            key = start if d < start else (end if d > end else d)
            folded_receipts[key] = folded_receipts.get(key, 0.0) + _f(q)
        receipts = folded_receipts
        exceptions.append({
            "code": "BUCKET_RANGE_CLAMPED",
            "severity": (
                f"分桶日期跨度 {span_days} 天超过上限 {MAX_MRP_BUCKET_DAYS}，"
                f"已截断为 {start.isoformat()} ~ {end.isoformat()}（窗外数量并入边界日）"
            ),
            "qty": float(span_days),
        })

    # 逾期供应：到期日早于今天仍未入库的在途（不含已确认计划订单）
    past_due_supply = sum(
        qty for d, qty in receipts_by_date.items() if d < today and qty > 0
    )
    if past_due_supply > 0:
        exceptions.append({
            "code": "PAST_DUE_SUPPLY",
            "severity": f"存在逾期未到货/未完工供应 {past_due_supply:g}",
            "qty": past_due_supply,
        })

    day = start
    while day <= end:
        gross = _f(gross_by_date.get(day))
        receipt = _f(receipts.get(day))
        total_gross += gross

        if suggestion_basis == "gross":
            projected_before = projected + receipt - gross
            planned_qty = 0.0
            if gross > 0 and not frozen:
                lot = float(apply_lot_fn(Decimal(str(gross))))
                planned_qty = lot
                total_planned += lot
                total_net += gross
                release, receipt_sched, date_exc = _plan_order_dates(
                    day,
                    lead,
                    today=today,
                    holiday_dates=holiday_dates,
                    use_work_calendar=use_cal,
                    schedule_direction=direction,
                )
                for ex in date_exc:
                    ex = {**ex, "qty": lot}
                    exceptions.append(ex)
                planned_orders.append({
                    "qty": lot,
                    "receipt_date": receipt_sched,
                    "release_date": release,
                    "firm": False,
                })
            projected = projected_before + planned_qty
            buckets.append({
                "date": day.isoformat(),
                "gross": gross,
                "scheduled_receipts": receipt,
                "planned_order_receipt": planned_qty,
                "projected_on_hand": projected,
            })
            day += timedelta(days=1)
            continue

        projected = projected + receipt - gross
        target = safety
        net = 0.0
        if projected < target:
            net = target - projected
        if include_reorder_point and rop > 0 and projected < rop:
            net = max(net, rop - projected)

        planned_qty = 0.0
        if net > 0 and not frozen:
            lot = float(apply_lot_fn(Decimal(str(net))))
            planned_qty = lot
            total_net += net
            total_planned += lot
            projected += lot
            release, receipt_sched, date_exc = _plan_order_dates(
                day,
                lead,
                today=today,
                holiday_dates=holiday_dates,
                use_work_calendar=use_cal,
                schedule_direction=direction,
            )
            for ex in date_exc:
                ex = {**ex, "qty": lot}
                exceptions.append(ex)
            planned_orders.append({
                "qty": lot,
                "receipt_date": receipt_sched,
                "release_date": release,
                "firm": False,
            })
        elif net > 0 and frozen:
            total_net += net
            exceptions.append({
                "code": "FIRM_FROZEN_SHORTAGE",
                "severity": f"{day.isoformat()} 计划已冻结，仍短缺 {net:g}，未生成新计划订单",
                "bucket_date": day.isoformat(),
                "qty": net,
            })

        buckets.append({
            "date": day.isoformat(),
            "gross": gross,
            "scheduled_receipts": receipt,
            "planned_order_receipt": planned_qty,
            "projected_on_hand": projected,
        })
        day += timedelta(days=1)

    if total_gross <= 0 and projected > safety + 1e-6 and sum(receipts.values()) > 0:
        exceptions.append({
            "code": "EXCESS_SUPPLY",
            "severity": f"无毛需求但存在在途/在制，期末预计库存 {projected:g}",
            "qty": projected,
        })

    earliest_demand = min(gross_by_date.keys()) if gross_by_date else None
    first_planned = planned_orders[0] if planned_orders else None

    seen = set()
    uniq_exc: List[Dict[str, Any]] = []
    for ex in exceptions:
        key = (ex.get("code"), ex.get("bucket_date"), round(_f(ex.get("qty")), 4))
        if key in seen:
            continue
        seen.add(key)
        uniq_exc.append(ex)

    return {
        "gross_requirement": total_gross,
        "net_requirement": total_net if suggestion_basis != "gross" else total_gross,
        "planned_order_qty": total_planned,
        "planned_orders": planned_orders,
        "time_buckets": buckets,
        "exceptions": uniq_exc,
        "earliest_demand_date": earliest_demand,
        "release_date": first_planned["release_date"] if first_planned else None,
        "receipt_date": first_planned["receipt_date"] if first_planned else None,
    }


def merge_demand_meta(
    target: Dict[str, Any],
    *,
    demand_item_id: Any = None,
    parent_material_id: Any = None,
    unit: Any = None,
    material_code: Any = None,
    material_name: Any = None,
) -> None:
    if demand_item_id is not None:
        ids = target.setdefault("demand_item_ids", [])
        if demand_item_id not in ids:
            ids.append(demand_item_id)
    if parent_material_id is not None:
        parents = target.setdefault("parent_material_ids", set())
        parents.add(int(parent_material_id))
    if unit and not target.get("unit"):
        target["unit"] = unit
    if material_code and not target.get("material_code"):
        target["material_code"] = material_code
    if material_name and not target.get("material_name"):
        target["material_name"] = material_name
