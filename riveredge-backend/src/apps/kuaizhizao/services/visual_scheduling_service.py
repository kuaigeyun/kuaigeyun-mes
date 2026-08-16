"""

可视排产服务：冲突检测、资源负荷、拖拽校验（只读，不写回计划）。

"""



from __future__ import annotations



from collections import defaultdict

from datetime import date, datetime, timedelta

from decimal import Decimal

from typing import Any, Dict, List, Optional, Tuple

from tortoise.expressions import Q



from apps.kuaizhizao.models.work_order import WorkOrder

from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation

from apps.kuaizhizao.schemas.scheduling_constraints import SchedulingConstraints
from apps.kuaizhizao.utils.working_time import is_within_working_hours, load_scheduling_work_context

from apps.kuaizhizao.services.scheduling_config_service import SchedulingConfigService

from core.utils.timezone_utils import (
    coerce_business_datetime_to_utc,
    make_aware,
    resolve_business_datetime,
    site_timezone_name,
    to_site_date,
    to_site_timezone,
)

from apps.kuaizhizao.services.scheduling_freeze import (

    freeze_lock_reason,

    is_planned_start_in_freeze_window,

    work_order_is_scheduling_locked,

)

from core.services.base import BaseService





def _parse_dt(value: Any) -> Optional[datetime]:
    """业务墙钟 / ISO / datetime → UTC aware，与 ORM DatetimeField 同一口径再比较。"""
    if value is None:
        return None
    parsed: Optional[datetime]
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    return coerce_business_datetime_to_utc(parsed)


def _intervals_overlap(s1: datetime, e1: datetime, s2: datetime, e2: datetime) -> bool:
    a1, b1, a2, b2 = _parse_dt(s1), _parse_dt(e1), _parse_dt(s2), _parse_dt(e2)
    if not a1 or not b1 or not a2 or not b2:
        return False
    return a1 < b2 and a2 < b1


def _schedule_minute(dt: datetime) -> datetime:
    """工序顺序校验精确到分钟。"""
    return dt.replace(second=0, microsecond=0)


def _operation_start_before_prev_start(cur_start: datetime, prev_start: datetime) -> bool:
    """下道工序开始早于上道工序开始（允许结束/开始重叠，转序并行）。"""
    cur = _parse_dt(cur_start)
    prev = _parse_dt(prev_start)
    if not cur or not prev:
        return False
    return _schedule_minute(cur) < _schedule_minute(prev)


def _effective_operation_planned_start(
    op: WorkOrderOperation,
    pending_by_id: Optional[Dict[int, Dict[str, Any]]],
) -> Optional[datetime]:
    patch = (pending_by_id or {}).get(int(op.id))
    if patch and patch.get("planned_start_date"):
        return _parse_dt(patch.get("planned_start_date"))
    return _parse_dt(op.planned_start_date)


def _effective_operation_planned_end(
    op: WorkOrderOperation,
    pending_by_id: Optional[Dict[int, Dict[str, Any]]],
) -> Optional[datetime]:
    patch = (pending_by_id or {}).get(int(op.id))
    if patch and patch.get("planned_end_date"):
        return _parse_dt(patch.get("planned_end_date"))
    return _parse_dt(op.planned_end_date)





def _conflict_item(

    *,

    conflict_type: str,

    message: str,

    work_order_id: Optional[int] = None,

    work_order_code: Optional[str] = None,

    operation_id: Optional[int] = None,

    station_id: Optional[int] = None,

    resource_id: Optional[int] = None,

) -> Dict[str, Any]:

    item: Dict[str, Any] = {

        "type": conflict_type,

        "message": message,

        "work_order_id": work_order_id,

        "work_order_code": work_order_code,

        "operation_id": operation_id,

        "station_id": station_id,

        "resource_id": resource_id,

    }

    if operation_id:

        item["task_id"] = f"op-{operation_id}"

    return item





class VisualSchedulingService(BaseService):

    """可视排产诊断与校验。"""

    @staticmethod
    def _plan_day_bounds(plan_date: date) -> Tuple[datetime, datetime]:
        tz_name = site_timezone_name()
        start = make_aware(datetime.combine(plan_date, datetime.min.time()), tz_name)
        end = make_aware(datetime.combine(plan_date, datetime.max.time()), tz_name)
        return start, end

    def __init__(self):

        super().__init__(WorkOrder)



    async def _load_constraints(self, tenant_id: int) -> Dict[str, Any]:

        cfg = await SchedulingConfigService().get_default_config(tenant_id)

        raw = cfg.constraints if cfg else None

        if hasattr(raw, "model_dump"):

            return SchedulingConstraints.model_validate(raw.model_dump()).model_dump()

        if isinstance(raw, dict):

            return SchedulingConstraints.model_validate(raw).model_dump()

        return SchedulingConstraints().model_dump()



    async def scan_board(

        self,

        tenant_id: int,

        *,

        work_order_ids: Optional[List[int]] = None,

        work_center_id: Optional[int] = None,

        horizon_days: int = 14,

        plan_date: Optional[date] = None,

    ) -> Dict[str, Any]:

        constraints = await self._load_constraints(tenant_id)

        holidays_cap, work_hours_cap, _ot_cap = await load_scheduling_work_context(
            tenant_id, around=plan_date
        )
        daily_capacity = max(1.0, work_hours_cap.daily_net_hours())

        horizon_days = max(1, min(horizon_days, 90))

        freeze_days = int(constraints.get("freeze_horizon_days", 0))



        query = WorkOrder.filter(

            tenant_id=tenant_id,

            status__in=["draft", "released", "in_progress"],

            deleted_at__isnull=True,

        )

        if work_order_ids:

            query = query.filter(id__in=work_order_ids)

        if work_center_id:

            query = query.filter(work_center_id=work_center_id)

        if plan_date:
            day_start, day_end = self._plan_day_bounds(plan_date)
            query = query.filter(
                planned_start_date__gte=day_start,
                planned_start_date__lte=day_end,
            )
        elif not work_order_ids:
            now = resolve_business_datetime()
            horizon_start = now - timedelta(days=horizon_days)
            horizon_end = now + timedelta(days=horizon_days)
            query = query.filter(
                Q(planned_start_date__isnull=True)
                | (
                    Q(planned_start_date__gte=horizon_start)
                    & Q(planned_start_date__lte=horizon_end)
                )
            )

        work_orders = await query.all()

        wo_ids = [wo.id for wo in work_orders]



        ops: List[WorkOrderOperation] = []

        if wo_ids:

            ops = await WorkOrderOperation.filter(

                tenant_id=tenant_id,

                work_order_id__in=wo_ids,

                deleted_at__isnull=True,

                planned_start_date__isnull=False,

                planned_end_date__isnull=False,

            ).order_by("work_order_id", "sequence").all()



        conflicts = self._detect_conflicts(ops, constraints)

        unscheduled = [

            {

                "work_order_id": wo.id,

                "work_order_code": wo.code or str(wo.id),

                "reason": "未设置计划起止时间",

            }

            for wo in work_orders

            if not wo.planned_start_date or not wo.planned_end_date

        ]

        material_issues = self._material_issues(work_orders, constraints)

        missing_settings = await self._collect_missing_settings(tenant_id, work_orders)

        load_by_work_center = self._aggregate_load_by_work_center(

            ops, work_orders, daily_capacity, horizon_days

        )

        load_by_station = self._aggregate_load_by_station(ops, daily_capacity, horizon_days)

        overloaded_station_count = len(

            {r["station_id"] for r in load_by_station if r.get("overloaded")}

        )



        return {
            "conflicts": conflicts,
            "unscheduled_orders": unscheduled,
            "material_issues": material_issues,
            "missing_settings": missing_settings,
            "load_by_work_center": load_by_work_center,
            "load_by_station": load_by_station,
            "conflict_count": len(conflicts),
            "unscheduled_count": len(unscheduled),
            "material_issue_count": len(material_issues),
            "missing_settings_count": len(missing_settings),
            "overloaded_station_count": overloaded_station_count,
        }

    async def _collect_missing_settings(
        self,
        tenant_id: int,
        work_orders: List[WorkOrder],
    ) -> List[Dict[str, Any]]:
        from apps.master_data.models.factory import Workstation
        from apps.kuaizhizao.utils.work_order_operation_scheduling import has_operation_hours

        if not work_orders:
            return []
        wo_map = {int(wo.id): wo for wo in work_orders}
        all_ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id__in=list(wo_map.keys()),
            deleted_at__isnull=True,
        ).order_by("work_order_id", "sequence").all()

        # 预取工作中心下可用工位
        wc_ids = {int(op.work_center_id) for op in all_ops if op.work_center_id}
        stations_by_wc: Dict[int, List[Any]] = defaultdict(list)
        if wc_ids:
            stations = await Workstation.filter(
                tenant_id=tenant_id,
                work_center_id__in=list(wc_ids),
                deleted_at__isnull=True,
                is_active=True,
            ).order_by("id").all()
            for st in stations:
                stations_by_wc[int(st.work_center_id)].append(st)

        gaps: List[Dict[str, Any]] = []
        for op in all_ops:
            if op.status in {"completed", "cancelled"}:
                continue
            wo = wo_map.get(int(op.work_order_id))
            if not wo:
                continue
            wo_code = wo.code or str(wo.id)
            op_name = op.operation_name or op.operation_code or str(op.id)
            if not has_operation_hours(op.setup_time, op.standard_time):
                gaps.append(
                    {
                        "work_order_id": int(wo.id),
                        "work_order_code": wo_code,
                        "operation_id": int(op.id),
                        "operation_name": op_name,
                        "field": "standard_time",
                        "label": "标准工时(小时/件)",
                        "current": float(op.standard_time) if op.standard_time is not None else None,
                        "suggested": 1.0,
                        "work_center_id": int(op.work_center_id) if op.work_center_id else None,
                    }
                )
                if op.setup_time is None:
                    gaps.append(
                        {
                            "work_order_id": int(wo.id),
                            "work_order_code": wo_code,
                            "operation_id": int(op.id),
                            "operation_name": op_name,
                            "field": "setup_time",
                            "label": "准备工时(小时)",
                            "current": None,
                            "suggested": 0.0,
                            "work_center_id": int(op.work_center_id) if op.work_center_id else None,
                        }
                    )
            station_id = int(op.assigned_station_id or 0)
            if station_id <= 0:
                wc_id = int(op.work_center_id or 0)
                candidates = stations_by_wc.get(wc_id, []) if wc_id > 0 else []
                if not candidates:
                    gaps.append(
                        {
                            "work_order_id": int(wo.id),
                            "work_order_code": wo_code,
                            "operation_id": int(op.id),
                            "operation_name": op_name,
                            "field": "assigned_station_id",
                            "label": "工位",
                            "current": None,
                            "suggested": None,
                            "work_center_id": wc_id or None,
                        }
                    )
        return gaps

    async def backfill_operation_settings(
        self,
        tenant_id: int,
        items: List[Dict[str, Any]],
        *,
        updated_by: int,
    ) -> Dict[str, Any]:
        """回写工单工序工时/工位，并重算计划时长。"""
        from decimal import Decimal as Dec
        from tortoise.transactions import in_transaction
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.utils.work_order_operation_scheduling import has_operation_hours
        from infra.exceptions.exceptions import NotFoundError, ValidationError

        if not items:
            raise ValidationError("补齐项不能为空")

        by_op: Dict[int, Dict[str, Any]] = {}
        for raw in items:
            op_id = int(raw.get("operation_id") or 0)
            if op_id <= 0:
                raise ValidationError("operation_id 无效")
            by_op[op_id] = raw

        updated_ops: List[int] = []
        touched_wo: set[int] = set()
        async with in_transaction():
            for op_id, patch in by_op.items():
                op = await WorkOrderOperation.get_or_none(
                    tenant_id=tenant_id, id=op_id, deleted_at__isnull=True
                )
                if not op:
                    raise NotFoundError(f"工序不存在: {op_id}")
                if "setup_time" in patch and patch.get("setup_time") is not None:
                    op.setup_time = Dec(str(patch["setup_time"]))
                if "standard_time" in patch and patch.get("standard_time") is not None:
                    op.standard_time = Dec(str(patch["standard_time"]))
                if "assigned_station_id" in patch and patch.get("assigned_station_id") is not None:
                    op.assigned_station_id = int(patch["assigned_station_id"])
                if not has_operation_hours(op.setup_time, op.standard_time) and (
                    "setup_time" in patch or "standard_time" in patch
                ):
                    raise ValidationError(
                        f"工序 {op.operation_name or op_id} 补齐后仍无有效工时，请填写准备工时或标准工时"
                    )
                op.updated_by = updated_by
                await op.save()
                updated_ops.append(op_id)
                touched_wo.add(int(op.work_order_id))

            wo_svc = WorkOrderService()
            for wo_id in touched_wo:
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=wo_id, deleted_at__isnull=True)
                if not wo:
                    continue
                ops = await WorkOrderOperation.filter(
                    tenant_id=tenant_id,
                    work_order_id=wo_id,
                    deleted_at__isnull=True,
                ).order_by("sequence").all()
                await wo_svc.compute_and_apply_operation_planned_times(
                    tenant_id, wo, ops, updated_by=updated_by
                )

        return {
            "updated_operation_ids": updated_ops,
            "updated_work_order_ids": sorted(touched_wo),
            "updated_count": len(updated_ops),
        }



    async def validate_adjustments(

        self,

        tenant_id: int,

        *,

        work_order_updates: Optional[List[Dict[str, Any]]] = None,

        operation_updates: Optional[List[Dict[str, Any]]] = None,

        operation_station_updates: Optional[List[Dict[str, Any]]] = None,

    ) -> Dict[str, Any]:

        constraints = await self._load_constraints(tenant_id)

        freeze_days = int(constraints.get("freeze_horizon_days", 0))

        holiday_dates: list = []
        for item in (operation_updates or []):
            for key in ("planned_start_date", "planned_end_date"):
                dt = _parse_dt(item.get(key))
                if dt:
                    holiday_dates.append(to_site_date(dt))
        around = min(holiday_dates) if holiday_dates else None
        holidays, work_hours, overtime = await load_scheduling_work_context(
            tenant_id, around=around
        )

        conflicts: List[Dict[str, Any]] = []



        wo_updates = work_order_updates or []

        op_updates = operation_updates or []

        station_updates = operation_station_updates or []

        pending_by_id = {

            int(item.get("operation_id") or 0): item

            for item in op_updates

            if int(item.get("operation_id") or 0) > 0

        }



        for item in op_updates:

            op_id = int(item.get("operation_id") or 0)

            start = item.get("planned_start_date")

            end = item.get("planned_end_date")

            if not op_id or not start or not end:

                continue

            op = await WorkOrderOperation.get_or_none(tenant_id=tenant_id, id=op_id, deleted_at__isnull=True)

            if not op:

                continue

            wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=op.work_order_id, deleted_at__isnull=True)

            if wo:

                conflicts.extend(await self._freeze_conflicts_for_wo(wo, start, freeze_days))

            start_dt = _parse_dt(start)

            end_dt = _parse_dt(end)

            if not start_dt or not end_dt:

                continue

            if not is_within_working_hours(
                to_site_timezone(start_dt), holidays=holidays, config=work_hours, overtime=overtime
            ):
                conflicts.append(
                    _conflict_item(
                        conflict_type="outside_working_hours",
                        message=(
                            f"工序开工时间不在工作时段内（{work_hours.start.strftime('%H:%M')}-"
                            f"{work_hours.end.strftime('%H:%M')}，或加班窗口；且须为工作日/加班日）"
                        ),
                        work_order_id=int(op.work_order_id) if op.work_order_id else None,
                        work_order_code=wo.code if wo else None,
                        operation_id=op_id,
                    )
                )


            changeover_hours = float(constraints.get("setup_changeover_hours") or 0.0)
            material_hard = bool(constraints.get("material_hard_constraint"))
            if material_hard and wo is not None:
                try:
                    rate = float(wo.readiness_rate) if wo.readiness_rate is not None else 100.0
                except (TypeError, ValueError):
                    rate = 100.0
                if rate < 100.0:
                    conflicts.append(
                        _conflict_item(
                            conflict_type="material_not_ready",
                            message=f"物料未齐套（{rate:.0f}%），硬约束禁止排产",
                            work_order_id=int(op.work_order_id) if op.work_order_id else None,
                            work_order_code=wo.code if wo else None,
                            operation_id=op_id,
                        )
                    )

            seq_conflicts = await self._check_operation_sequence(

                tenant_id, op, start_dt, end_dt, pending_by_id=pending_by_id

            )

            conflicts.extend(seq_conflicts)



        if op_updates:

            overlap_conflicts = await self._check_operation_overlaps_for_updates(tenant_id, op_updates, constraints)

            conflicts.extend(overlap_conflicts)



        for item in wo_updates:

            wo_id = int(item.get("work_order_id") or 0)

            wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=wo_id, deleted_at__isnull=True)

            if not wo:

                continue

            conflicts.extend(

                await self._freeze_conflicts_for_wo(wo, item.get("planned_start_date"), freeze_days)

            )



        for item in station_updates:

            op_id = int(item.get("operation_id") or 0)

            if not op_id:

                continue

            op = await WorkOrderOperation.get_or_none(tenant_id=tenant_id, id=op_id, deleted_at__isnull=True)

            if not op:

                continue

            wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=op.work_order_id, deleted_at__isnull=True)

            if wo and wo.is_frozen:

                conflicts.append(

                    _conflict_item(

                        conflict_type="frozen",

                        work_order_id=wo.id,

                        work_order_code=wo.code or str(wo.id),

                        operation_id=op_id,

                        message="工单已冻结，禁止改派工位",

                    )

                )



        if op_updates and float(constraints.get("setup_changeover_hours") or 0) > 0:
            conflicts.extend(
                await self._check_changeover_for_updates(
                    tenant_id, op_updates, constraints, holidays, work_hours, overtime
                )
            )

        return {

            "valid": len(conflicts) == 0,

            "conflicts": conflicts,

            "conflict_count": len(conflicts),

        }



    async def _check_changeover_for_updates(
        self,
        tenant_id: int,
        op_updates: List[Dict[str, Any]],
        constraints: Dict[str, Any],
        holidays,
        work_hours,
        overtime,
    ) -> List[Dict[str, Any]]:
        from apps.kuaizhizao.utils.working_time import add_working_hours

        changeover_hours = float(constraints.get("setup_changeover_hours") or 0.0)
        if changeover_hours <= 0:
            return []
        update_by_id = {
            int(u["operation_id"]): u
            for u in op_updates
            if int(u.get("operation_id") or 0) > 0
        }
        op_ids = list(update_by_id.keys())
        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id, id__in=op_ids, deleted_at__isnull=True
        ).all()
        wo_ids = list({int(o.work_order_id) for o in ops if o.work_order_id})
        product_by_wo = {}
        if wo_ids:
            for row in await WorkOrder.filter(tenant_id=tenant_id, id__in=wo_ids).values(
                "id", "product_id", "code"
            ):
                product_by_wo[int(row["id"])] = (
                    int(row.get("product_id") or 0),
                    row.get("code"),
                )
        # Build proposed intervals by station
        by_station: Dict[int, List[Dict[str, Any]]] = {}
        for op in ops:
            patch = update_by_id.get(op.id) or {}
            start_dt = _parse_dt(patch.get("planned_start_date"))
            end_dt = _parse_dt(patch.get("planned_end_date"))
            if not start_dt or not end_dt:
                continue
            sid = int(op.assigned_station_id or 0)
            if sid <= 0:
                continue
            pid, code = product_by_wo.get(int(op.work_order_id or 0), (0, None))
            by_station.setdefault(sid, []).append(
                {
                    "op_id": int(op.id),
                    "wo_id": int(op.work_order_id or 0),
                    "wo_code": code,
                    "product_id": pid,
                    "start": start_dt,
                    "end": end_dt,
                }
            )
        # Also load neighboring fixed ops on same stations
        station_ids = list(by_station.keys())
        if station_ids:
            others = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                assigned_station_id__in=station_ids,
                deleted_at__isnull=True,
                planned_start_date__isnull=False,
                planned_end_date__isnull=False,
            ).exclude(id__in=op_ids).all()
            other_wo_ids = list({int(o.work_order_id) for o in others if o.work_order_id})
            if other_wo_ids:
                for row in await WorkOrder.filter(
                    tenant_id=tenant_id, id__in=other_wo_ids
                ).values("id", "product_id", "code"):
                    product_by_wo.setdefault(
                        int(row["id"]),
                        (int(row.get("product_id") or 0), row.get("code")),
                    )
            for op in others:
                sid = int(op.assigned_station_id or 0)
                pid, code = product_by_wo.get(int(op.work_order_id or 0), (0, None))
                other_start = _parse_dt(op.planned_start_date)
                other_end = _parse_dt(op.planned_end_date)
                if not other_start or not other_end:
                    continue
                by_station.setdefault(sid, []).append(
                    {
                        "op_id": int(op.id),
                        "wo_id": int(op.work_order_id or 0),
                        "wo_code": code,
                        "product_id": pid,
                        "start": other_start,
                        "end": other_end,
                    }
                )
        conflicts: List[Dict[str, Any]] = []
        touched = set(op_ids)
        for sid, items in by_station.items():
            items.sort(key=lambda x: x["start"])
            for i in range(len(items) - 1):
                a, b = items[i], items[i + 1]
                if a["product_id"] <= 0 or b["product_id"] <= 0:
                    continue
                if a["product_id"] == b["product_id"]:
                    continue
                if a["op_id"] not in touched and b["op_id"] not in touched:
                    continue
                ready = add_working_hours(
                    to_site_timezone(a["end"]),
                    changeover_hours,
                    holidays=holidays,
                    config=work_hours,
                    overtime=overtime,
                )
                if to_site_timezone(b["start"]) < ready:
                    target = b if b["op_id"] in touched else a
                    conflicts.append(
                        _conflict_item(
                            conflict_type="insufficient_changeover",
                            message=f"同工位跨产品换型不足（需净工时 {changeover_hours:g}h）",
                            work_order_id=target["wo_id"] or None,
                            work_order_code=target["wo_code"],
                            operation_id=target["op_id"],
                            station_id=sid,
                        )
                    )
        return conflicts


    async def _freeze_conflicts_for_wo(

        self,

        wo: WorkOrder,

        planned_start: Any,

        freeze_horizon_days: int,

    ) -> List[Dict[str, Any]]:

        out: List[Dict[str, Any]] = []

        if wo.is_frozen:

            out.append(

                _conflict_item(

                    conflict_type="frozen",

                    work_order_id=wo.id,

                    work_order_code=wo.code or str(wo.id),

                    message="工单已冻结，禁止调整计划日期",

                )

            )

            return out

        if is_planned_start_in_freeze_window(planned_start, freeze_horizon_days):

            out.append(

                _conflict_item(

                    conflict_type="freeze_window",

                    work_order_id=wo.id,

                    work_order_code=wo.code or str(wo.id),

                    message=f"计划开始落在冻结窗内（{freeze_horizon_days} 天），禁止调整",

                )

            )

        return out



    @staticmethod

    def _material_issues(work_orders: List[WorkOrder], constraints: Dict[str, Any]) -> List[Dict[str, Any]]:

        if not constraints.get("consider_material", True):

            return []

        out: List[Dict[str, Any]] = []

        for wo in work_orders:

            rate = wo.readiness_rate

            if rate is None:

                continue

            try:

                pct = float(rate)

            except (TypeError, ValueError):

                continue

            if pct >= 100:

                continue

            out.append(

                {

                    "work_order_id": wo.id,

                    "work_order_code": wo.code or str(wo.id),

                    "readiness_rate": pct,

                    "message": f"齐套率 {pct:.0f}% 不足，排产前请确认物料",

                }

            )

        return out



    def _detect_conflicts(

        self,

        ops: List[WorkOrderOperation],

        constraints: Dict[str, Any],

    ) -> List[Dict[str, Any]]:

        conflicts: List[Dict[str, Any]] = []

        if constraints.get("consider_human", True):

            conflicts.extend(self._station_overlaps(ops))

        if constraints.get("consider_equipment", True):

            conflicts.extend(self._equipment_overlaps(ops))

        if constraints.get("consider_mold_tool", True):

            conflicts.extend(self._mold_tool_overlaps(ops))

        conflicts.extend(self._sequence_violations(ops))

        return conflicts



    @staticmethod

    def _station_overlaps(ops: List[WorkOrderOperation]) -> List[Dict[str, Any]]:

        by_station: Dict[int, List[Tuple[datetime, datetime, WorkOrderOperation]]] = defaultdict(list)

        for op in ops:

            station_id = int(op.assigned_station_id or 0)

            if station_id <= 0 or not op.planned_start_date or not op.planned_end_date:

                continue

            by_station[station_id].append((op.planned_start_date, op.planned_end_date, op))

        out: List[Dict[str, Any]] = []

        for station_id, slots in by_station.items():

            for i, (s1, e1, op1) in enumerate(slots):

                for j, (s2, e2, op2) in enumerate(slots):

                    if i >= j:

                        continue

                    if _intervals_overlap(s1, e1, s2, e2):

                        station_label = op1.assigned_station_name or str(station_id)

                        out.append(

                            _conflict_item(

                                conflict_type="station_overlap",

                                resource_id=station_id,

                                station_id=station_id,

                                work_order_id=int(op1.work_order_id),

                                work_order_code=op1.work_order_code or str(op1.work_order_id),

                                operation_id=int(op1.id),

                                message=(

                                    f"工位 {station_label}：工单 {op1.work_order_code or op1.work_order_id} "

                                    f"与工单 {op2.work_order_code or op2.work_order_id} 时间重叠"

                                ),

                            )

                        )

        return out



    @staticmethod

    def _equipment_overlaps(ops: List[WorkOrderOperation]) -> List[Dict[str, Any]]:

        by_eq: Dict[int, List[Tuple[datetime, datetime, WorkOrderOperation]]] = defaultdict(list)

        for op in ops:

            eq_id = int(op.assigned_equipment_id or 0)

            if eq_id <= 0 or not op.planned_start_date or not op.planned_end_date:

                continue

            by_eq[eq_id].append((op.planned_start_date, op.planned_end_date, op))

        out: List[Dict[str, Any]] = []

        for eq_id, slots in by_eq.items():

            for i, (s1, e1, op1) in enumerate(slots):

                for j, (s2, e2, op2) in enumerate(slots):

                    if i >= j:

                        continue

                    if _intervals_overlap(s1, e1, s2, e2):

                        out.append(

                            _conflict_item(

                                conflict_type="equipment_overlap",

                                resource_id=eq_id,

                                work_order_id=int(op1.work_order_id),

                                work_order_code=op1.work_order_code or str(op1.work_order_id),

                                operation_id=int(op1.id),

                                message=(

                                    f"设备 {eq_id}：工单 {op1.work_order_code or op1.work_order_id} "

                                    f"与工单 {op2.work_order_code or op2.work_order_id} 工序时间重叠"

                                ),

                            )

                        )

        return out



    @staticmethod

    def _mold_tool_overlaps(ops: List[WorkOrderOperation]) -> List[Dict[str, Any]]:

        def _scan(resource_key: str, resource_type: str) -> List[Dict[str, Any]]:

            grouped: Dict[int, List[Tuple[datetime, datetime, WorkOrderOperation]]] = defaultdict(list)

            for op in ops:

                rid = int(getattr(op, resource_key) or 0)

                if rid <= 0 or not op.planned_start_date or not op.planned_end_date:

                    continue

                grouped[rid].append((op.planned_start_date, op.planned_end_date, op))

            found: List[Dict[str, Any]] = []

            label = "模具" if resource_type == "mold" else "工装"

            for rid, slots in grouped.items():

                for i, (s1, e1, op1) in enumerate(slots):

                    for j, (s2, e2, op2) in enumerate(slots):

                        if i >= j:

                            continue

                        if _intervals_overlap(s1, e1, s2, e2):

                            found.append(

                                _conflict_item(

                                    conflict_type=f"{resource_type}_overlap",

                                    resource_id=rid,

                                    work_order_id=int(op1.work_order_id),

                                    work_order_code=op1.work_order_code or str(op1.work_order_id),

                                    operation_id=int(op1.id),

                                    message=(

                                        f"{label} {rid}：工单 {op1.work_order_code or op1.work_order_id} "

                                        f"与工单 {op2.work_order_code or op2.work_order_id} 时间重叠"

                                    ),

                                )

                            )

            return found



        return _scan("assigned_mold_id", "mold") + _scan("assigned_tool_id", "tool")



    @staticmethod

    def _sequence_violations(ops: List[WorkOrderOperation]) -> List[Dict[str, Any]]:

        by_wo: Dict[int, List[WorkOrderOperation]] = defaultdict(list)

        for op in ops:

            by_wo[int(op.work_order_id)].append(op)

        out: List[Dict[str, Any]] = []

        for wo_id, wo_ops in by_wo.items():

            ordered = sorted(wo_ops, key=lambda o: int(o.sequence or 0))

            for idx in range(1, len(ordered)):

                prev, cur = ordered[idx - 1], ordered[idx]

                if not prev.planned_start_date or not cur.planned_start_date:

                    continue

                if _operation_start_before_prev_start(cur.planned_start_date, prev.planned_start_date):

                    out.append(

                        _conflict_item(

                            conflict_type="sequence_violation",

                            work_order_id=wo_id,

                            work_order_code=cur.work_order_code or str(wo_id),

                            operation_id=int(cur.id),

                            message=f"工序 {cur.operation_name or cur.sequence} 开始早于前序工序开始",

                        )

                    )

        return out



    async def _check_operation_sequence(

        self,

        tenant_id: int,

        op: WorkOrderOperation,

        start_dt: datetime,

        end_dt: datetime,

        pending_by_id: Optional[Dict[int, Dict[str, Any]]] = None,

    ) -> List[Dict[str, Any]]:

        siblings = await WorkOrderOperation.filter(

            tenant_id=tenant_id,

            work_order_id=op.work_order_id,

            deleted_at__isnull=True,

        ).order_by("sequence").all()

        ordered = sorted(siblings, key=lambda o: int(o.sequence or 0))

        conflicts: List[Dict[str, Any]] = []

        for other in ordered:

            if other.id == op.id:

                continue

            other_start = _effective_operation_planned_start(other, pending_by_id)

            if int(other.sequence or 0) < int(op.sequence or 0) and other_start:

                if _operation_start_before_prev_start(start_dt, other_start):

                    conflicts.append(

                        _conflict_item(

                            conflict_type="sequence_violation",

                            work_order_id=int(op.work_order_id),

                            work_order_code=op.work_order_code or str(op.work_order_id),

                            operation_id=int(op.id),

                            message="工序开始时间早于前序工序开始时间",

                        )

                    )

            if int(other.sequence or 0) > int(op.sequence or 0) and other_start:

                if _operation_start_before_prev_start(other_start, start_dt):

                    conflicts.append(

                        _conflict_item(

                            conflict_type="sequence_violation",

                            work_order_id=int(op.work_order_id),

                            work_order_code=op.work_order_code or str(op.work_order_id),

                            operation_id=int(op.id),

                            message="后续工序开始时间早于本道工序开始时间",

                        )

                    )

        return conflicts



    async def _check_operation_overlaps_for_updates(

        self,

        tenant_id: int,

        op_updates: List[Dict[str, Any]],

        constraints: Dict[str, Any],

    ) -> List[Dict[str, Any]]:

        check_station = bool(constraints.get("consider_human", True))

        check_equipment = bool(constraints.get("consider_equipment", True))

        check_mold_tool = bool(constraints.get("consider_mold_tool", True))

        if not check_station and not check_equipment and not check_mold_tool:

            return []

        update_by_id = {

            int(u["operation_id"]): u

            for u in op_updates

            if int(u.get("operation_id") or 0) > 0

        }

        op_ids = list(update_by_id.keys())

        ops = await WorkOrderOperation.filter(tenant_id=tenant_id, id__in=op_ids, deleted_at__isnull=True).all()

        conflicts: List[Dict[str, Any]] = []

        for op in ops:

            patch = update_by_id.get(op.id)

            if not patch:

                continue

            start_dt = _parse_dt(patch.get("planned_start_date"))

            end_dt = _parse_dt(patch.get("planned_end_date"))

            if not start_dt or not end_dt:

                continue



            if check_station:

                station_id = int(op.assigned_station_id or 0)

                if station_id > 0:
                    from apps.master_data.models.factory import Workstation
                    ws = await Workstation.get_or_none(tenant_id=tenant_id, id=station_id, deleted_at__isnull=True)
                    capacity = max(1, int(getattr(ws, "max_parallel", 1) or 1)) if ws else 1

                    conflicts.extend(

                        await self._overlap_conflicts_for_resource(

                            tenant_id=tenant_id,

                            op=op,

                            resource_field="assigned_station_id",

                            resource_id=station_id,

                            resource_label=op.assigned_station_name or f"工位{station_id}",

                            conflict_type="station_overlap",

                            start_dt=start_dt,

                            end_dt=end_dt,

                            update_by_id=update_by_id,

                            max_parallel=capacity,

                        )

                    )



            if check_equipment:

                eq_id = int(op.assigned_equipment_id or 0)

                if eq_id > 0:

                    conflicts.extend(

                        await self._overlap_conflicts_for_resource(

                            tenant_id=tenant_id,

                            op=op,

                            resource_field="assigned_equipment_id",

                            resource_id=eq_id,

                            resource_label=f"设备{eq_id}",

                            conflict_type="equipment_overlap",

                            start_dt=start_dt,

                            end_dt=end_dt,

                            update_by_id=update_by_id,

                        )

                    )



            if check_mold_tool:

                mold_id = int(op.assigned_mold_id or 0)

                if mold_id > 0:

                    conflicts.extend(

                        await self._overlap_conflicts_for_resource(

                            tenant_id=tenant_id,

                            op=op,

                            resource_field="assigned_mold_id",

                            resource_id=mold_id,

                            resource_label=f"模具{mold_id}",

                            conflict_type="mold_overlap",

                            start_dt=start_dt,

                            end_dt=end_dt,

                            update_by_id=update_by_id,

                        )

                    )

                tool_id = int(op.assigned_tool_id or 0)

                if tool_id > 0:

                    conflicts.extend(

                        await self._overlap_conflicts_for_resource(

                            tenant_id=tenant_id,

                            op=op,

                            resource_field="assigned_tool_id",

                            resource_id=tool_id,

                            resource_label=f"工装{tool_id}",

                            conflict_type="tool_overlap",

                            start_dt=start_dt,

                            end_dt=end_dt,

                            update_by_id=update_by_id,

                        )

                    )

        return conflicts



    async def _overlap_conflicts_for_resource(
        self,
        *,
        tenant_id: int,
        op: WorkOrderOperation,
        resource_field: str,
        resource_id: int,
        resource_label: str,
        conflict_type: str,
        start_dt: datetime,
        end_dt: datetime,
        update_by_id: Dict[int, Dict[str, Any]],
        max_parallel: int = 1,
    ) -> List[Dict[str, Any]]:
        conflicts: List[Dict[str, Any]] = []
        station_id = int(op.assigned_station_id or 0) if resource_field == "assigned_station_id" else None
        capacity = max(1, int(max_parallel or 1))
        others = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            **{resource_field: resource_id},
            deleted_at__isnull=True,
            planned_start_date__isnull=False,
            planned_end_date__isnull=False,
        ).exclude(id=op.id).all()
        overlapping = []
        for other in others:
            if other.id in update_by_id:
                o_patch = update_by_id[other.id]
                o_start_dt = _parse_dt(o_patch.get("planned_start_date"))
                o_end_dt = _parse_dt(o_patch.get("planned_end_date"))
                if o_start_dt and o_end_dt and _intervals_overlap(start_dt, end_dt, o_start_dt, o_end_dt):
                    overlapping.append(other)
            elif other.planned_start_date and other.planned_end_date:
                if _intervals_overlap(start_dt, end_dt, other.planned_start_date, other.planned_end_date):
                    overlapping.append(other)
        if len(overlapping) < capacity:
            return conflicts
        # 超出并行度时提示与最早重叠工序冲突
        for other in overlapping[: max(1, len(overlapping) - capacity + 1)]:
            conflicts.append(
                _conflict_item(
                    conflict_type=conflict_type,
                    work_order_id=int(op.work_order_id),
                    work_order_code=op.work_order_code or str(op.work_order_id),
                    operation_id=int(op.id),
                    station_id=station_id,
                    resource_id=resource_id,
                    message=f"与工单 {other.work_order_code or other.work_order_id} 在{resource_label} 时间重叠（并行度 {capacity}）",
                )
            )
        return conflicts


    @staticmethod
    def _aggregate_load_by_work_center(

        ops: List[WorkOrderOperation],

        work_orders: List[WorkOrder],

        daily_capacity_hours: float,

        horizon_days: int,

    ) -> List[Dict[str, Any]]:

        today = resolve_business_datetime().replace(hour=0, minute=0, second=0, microsecond=0)

        wc_names: Dict[int, str] = {}

        for wo in work_orders:

            wc_id = int(wo.work_center_id or 0)

            if wc_id > 0:

                wc_names[wc_id] = wo.work_center_name or f"WC-{wc_id}"



        load: Dict[Tuple[int, str], float] = defaultdict(float)

        for op in ops:

            if not op.planned_start_date:

                continue

            wc_id = int(op.work_center_id or 0)

            day_key = op.planned_start_date.strftime("%Y-%m-%d")

            hours = 0.0

            if op.planned_start_date and op.planned_end_date:

                hours = max((op.planned_end_date - op.planned_start_date).total_seconds() / 3600.0, 0.1)

            load[(wc_id, day_key)] += hours



        wo_ids_with_ops = {int(op.work_order_id) for op in ops}

        for wo in work_orders:

            if wo.id in wo_ids_with_ops or not wo.planned_start_date:

                continue

            wc_id = int(wo.work_center_id or 0)

            day_key = wo.planned_start_date.strftime("%Y-%m-%d")

            if wo.planned_start_date and wo.planned_end_date:

                hours = max((wo.planned_end_date - wo.planned_start_date).total_seconds() / 3600.0, 0.1)

                load[(wc_id, day_key)] += hours



        rows: List[Dict[str, Any]] = []

        for day_offset in range(horizon_days):

            day = (today + timedelta(days=day_offset)).strftime("%Y-%m-%d")

            seen_wc = set(wc_names.keys()) or {0}

            for wc_id in seen_wc:

                hours = round(load.get((wc_id, day), 0.0), 2)

                rate = min(100, round((hours / daily_capacity_hours) * 100)) if daily_capacity_hours > 0 else 0

                rows.append({

                    "work_center_id": wc_id,

                    "work_center_name": wc_names.get(wc_id, "未分配"),

                    "day": day,

                    "hours": hours,

                    "rate": rate,

                    "overloaded": rate > 100,

                })

        return rows



    @staticmethod

    def _aggregate_load_by_station(

        ops: List[WorkOrderOperation],

        daily_capacity_hours: float,

        horizon_days: int,

    ) -> List[Dict[str, Any]]:

        today = resolve_business_datetime().replace(hour=0, minute=0, second=0, microsecond=0)

        station_names: Dict[int, str] = {}

        load: Dict[Tuple[int, str], float] = defaultdict(float)

        for op in ops:

            station_id = int(op.assigned_station_id or 0)

            if station_id <= 0 or not op.planned_start_date:

                continue

            station_names[station_id] = op.assigned_station_name or f"工位{station_id}"

            day_key = op.planned_start_date.strftime("%Y-%m-%d")

            hours = 0.0

            if op.planned_start_date and op.planned_end_date:

                hours = max((op.planned_end_date - op.planned_start_date).total_seconds() / 3600.0, 0.1)

            load[(station_id, day_key)] += hours



        rows: List[Dict[str, Any]] = []

        for day_offset in range(horizon_days):

            day = (today + timedelta(days=day_offset)).strftime("%Y-%m-%d")

            seen = set(station_names.keys()) or {0}

            for station_id in seen:

                hours = round(load.get((station_id, day), 0.0), 2)

                rate = min(100, round((hours / daily_capacity_hours) * 100)) if daily_capacity_hours > 0 else 0

                rows.append({

                    "station_id": station_id,

                    "station_name": station_names.get(station_id, "未分配"),

                    "day": day,

                    "hours": hours,

                    "rate": rate,

                    "overloaded": rate > 100,

                })

        return rows


