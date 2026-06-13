"""

可视排产服务：冲突检测、资源负荷、拖拽校验（只读，不写回计划）。

"""



from __future__ import annotations



from collections import defaultdict

from datetime import date, datetime, timedelta

from decimal import Decimal

from typing import Any, Dict, List, Optional, Tuple



from apps.kuaizhizao.models.work_order import WorkOrder

from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation

from apps.kuaizhizao.schemas.scheduling_constraints import SchedulingConstraints

from apps.kuaizhizao.services.scheduling_config_service import SchedulingConfigService

from core.utils.timezone_utils import make_aware

from infra.config.infra_config import infra_settings

from apps.kuaizhizao.services.scheduling_freeze import (

    freeze_lock_reason,

    is_planned_start_in_freeze_window,

    work_order_is_scheduling_locked,

)

from core.services.base import BaseService





def _intervals_overlap(s1: datetime, e1: datetime, s2: datetime, e2: datetime) -> bool:

    return s1 < e2 and s2 < e1





def _parse_dt(value: Any) -> Optional[datetime]:

    if value is None:

        return None

    if isinstance(value, datetime):

        return value

    try:

        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))

    except ValueError:

        return None





def _schedule_minute(dt: datetime) -> datetime:

    """工序顺序校验精确到分钟。"""

    return dt.replace(second=0, microsecond=0)





def _operation_start_before_prev_start(cur_start: datetime, prev_start: datetime) -> bool:

    """下道工序开始早于上道工序开始（允许结束/开始重叠，转序并行）。"""

    return _schedule_minute(cur_start) < _schedule_minute(prev_start)





def _effective_operation_planned_start(

    op: WorkOrderOperation,

    pending_by_id: Optional[Dict[int, Dict[str, Any]]],

) -> Optional[datetime]:

    patch = (pending_by_id or {}).get(int(op.id))

    if patch and patch.get("planned_start_date"):

        return _parse_dt(patch.get("planned_start_date"))

    return op.planned_start_date





def _effective_operation_planned_end(

    op: WorkOrderOperation,

    pending_by_id: Optional[Dict[int, Dict[str, Any]]],

) -> Optional[datetime]:

    patch = (pending_by_id or {}).get(int(op.id))

    if patch and patch.get("planned_end_date"):

        return _parse_dt(patch.get("planned_end_date"))

    return op.planned_end_date





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
        tz_name = infra_settings.TIMEZONE or "Asia/Shanghai"
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

        daily_capacity = float(constraints.get("daily_capacity_hours", 24.0))

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

            "load_by_work_center": load_by_work_center,

            "load_by_station": load_by_station,

            "conflict_count": len(conflicts),

            "unscheduled_count": len(unscheduled),

            "material_issue_count": len(material_issues),

            "overloaded_station_count": overloaded_station_count,

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



        return {

            "valid": len(conflicts) == 0,

            "conflicts": conflicts,

            "conflict_count": len(conflicts),

        }



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

    ) -> List[Dict[str, Any]]:

        conflicts: List[Dict[str, Any]] = []

        station_id = int(op.assigned_station_id or 0) if resource_field == "assigned_station_id" else None

        others = await WorkOrderOperation.filter(

            tenant_id=tenant_id,

            **{resource_field: resource_id},

            deleted_at__isnull=True,

            planned_start_date__isnull=False,

            planned_end_date__isnull=False,

        ).exclude(id=op.id).all()

        for other in others:

            if other.id in update_by_id:

                o_patch = update_by_id[other.id]

                o_start_dt = _parse_dt(o_patch.get("planned_start_date"))

                o_end_dt = _parse_dt(o_patch.get("planned_end_date"))

                if o_start_dt and o_end_dt and _intervals_overlap(start_dt, end_dt, o_start_dt, o_end_dt):

                    conflicts.append(

                        _conflict_item(

                            conflict_type=conflict_type,

                            work_order_id=int(op.work_order_id),

                            work_order_code=op.work_order_code or str(op.work_order_id),

                            operation_id=int(op.id),

                            station_id=station_id,

                            resource_id=resource_id,

                            message=f"与工单 {other.work_order_code or other.work_order_id} 在{resource_label} 时间重叠",

                        )

                    )

            elif other.planned_start_date and other.planned_end_date:

                if _intervals_overlap(start_dt, end_dt, other.planned_start_date, other.planned_end_date):

                    conflicts.append(

                        _conflict_item(

                            conflict_type=conflict_type,

                            work_order_id=int(op.work_order_id),

                            work_order_code=op.work_order_code or str(op.work_order_id),

                            operation_id=int(op.id),

                            station_id=station_id,

                            resource_id=resource_id,

                            message=f"与工单 {other.work_order_code or other.work_order_id} 在{resource_label} 时间重叠",

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

        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

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

        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

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


