"""
高级排产服务模块

提供有限产能启发式排程与优化入口。
"""

from typing import List, Optional, Dict, Any, Tuple, Set
from datetime import datetime, date, timedelta
from collections import defaultdict
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.schemas.scheduling_constraints import SchedulingConstraints
from core.services.base import BaseService


DEFAULT_CONSTRAINTS: Dict[str, Any] = SchedulingConstraints().model_dump()


class AdvancedSchedulingService(BaseService):
    """高级排产服务类（有限产能 MVP）。"""

    def __init__(self):
        super().__init__(WorkOrder)

    def _build_constraints(self, constraints: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        merged = dict(DEFAULT_CONSTRAINTS)
        if constraints:
            merged.update(constraints)
        return SchedulingConstraints.model_validate(merged).model_dump()

    @staticmethod
    def _normalize_shift_start(dt: datetime) -> datetime:
        return dt.replace(minute=0, second=0, microsecond=0)

    @staticmethod
    def _estimate_work_order_hours(work_order: WorkOrder, operations: List[WorkOrderOperation]) -> float:
        quantity = float(work_order.quantity or 1)
        op_hours = 0.0
        for op in operations:
            std = float(op.standard_time or 0)
            setup = float(op.setup_time or 0)
            if std > 0:
                op_hours += std * max(quantity, 1.0)
            op_hours += max(setup, 0.0)
        if op_hours > 0:
            return max(op_hours, 0.1)
        if work_order.planned_start_date and work_order.planned_end_date:
            delta_h = (work_order.planned_end_date - work_order.planned_start_date).total_seconds() / 3600.0
            if delta_h > 0:
                return delta_h
        return max(quantity * 0.1, 0.1)

    @staticmethod
    def _add_work_hours(start_dt: datetime, duration_hours: float, daily_capacity_hours: float) -> datetime:
        if daily_capacity_hours >= 24:
            return start_dt + timedelta(hours=duration_hours)

        day_start = start_dt.replace(hour=8, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(hours=daily_capacity_hours)
        cur = start_dt
        remaining = duration_hours

        while remaining > 0:
            if cur < day_start:
                cur = day_start
            if cur >= day_end:
                day_start = (day_start + timedelta(days=1)).replace(hour=8, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(hours=daily_capacity_hours)
                cur = day_start
                continue
            available_today = (day_end - cur).total_seconds() / 3600.0
            consume = min(remaining, available_today)
            cur = cur + timedelta(hours=consume)
            remaining -= consume
        return cur

    @staticmethod
    def _calc_total_tardiness_hours(rows: List[Dict[str, Any]]) -> float:
        total = 0.0
        for row in rows:
            due = row.get("due_date")
            end = row.get("planned_end_date")
            if due and end and end > due:
                total += (end - due).total_seconds() / 3600.0
        return round(total, 3)

    @staticmethod
    def _derive_setup_family(work_order: WorkOrder, operations: List[WorkOrderOperation]) -> str:
        """换型族：优先用产品编码前缀，其次首工序编码。"""
        product_code = str(getattr(work_order, "product_code", "") or "").strip()
        if product_code:
            for sep in ("-", "_", "/"):
                if sep in product_code:
                    return product_code.split(sep)[0].upper()
            return product_code[:6].upper()
        for op in operations:
            op_code = str(getattr(op, "operation_code", "") or "").strip()
            if op_code:
                return op_code[:6].upper()
        return "DEFAULT"

    @staticmethod
    def _is_in_freeze_window(work_order: WorkOrder, freeze_anchor: datetime) -> bool:
        if not work_order.planned_start_date:
            return False
        return work_order.planned_start_date <= freeze_anchor

    @staticmethod
    def _infer_bottleneck_centers(work_orders: List[WorkOrder], top_n: int = 1) -> Set[int]:
        counts: Dict[int, int] = defaultdict(int)
        for wo in work_orders:
            wc = int(wo.work_center_id or wo.workshop_id or 0)
            if wc > 0:
                counts[wc] += 1
        ranked = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        return {wc for wc, _ in ranked[:top_n]}

    async def intelligent_scheduling(
        self,
        tenant_id: int,
        work_order_ids: Optional[List[int]] = None,
        constraints: Optional[Dict[str, Any]] = None,
        apply_results: bool = True,
        updated_by: Optional[int] = None,
    ) -> Dict[str, Any]:
        """智能排产（有限产能 MVP）。"""
        status_filter = ["draft", "released"]
        query = WorkOrder.filter(tenant_id=tenant_id, status__in=status_filter, deleted_at__isnull=True)
        if work_order_ids:
            query = query.filter(id__in=work_order_ids)
        work_orders = await query.all()
        if not work_orders:
            return {
                "scheduled_orders": [],
                "unscheduled_orders": [],
                "conflicts": [],
                "statistics": {
                    "total_orders": 0,
                    "scheduled_count": 0,
                    "unscheduled_count": 0,
                    "scheduling_rate": 0.0,
                },
            }

        normalized_constraints = self._build_constraints(constraints)
        wo_ids = [wo.id for wo in work_orders]
        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id__in=wo_ids,
            deleted_at__isnull=True,
        ).order_by("work_order_id", "sequence").all()
        ops_by_wo: Dict[int, List[WorkOrderOperation]] = defaultdict(list)
        for op in ops:
            ops_by_wo[int(op.work_order_id)].append(op)

        result = await self._execute_finite_capacity_scheduling(
            tenant_id=tenant_id,
            work_orders=work_orders,
            operations_by_work_order=ops_by_wo,
            constraints=normalized_constraints,
        )

        if apply_results and result.get("scheduled_orders") and updated_by:
            await self.apply_scheduling_results(
                tenant_id=tenant_id,
                results=result["scheduled_orders"],
                updated_by=updated_by,
            )
        return result

    async def _execute_finite_capacity_scheduling(
        self,
        tenant_id: int,
        work_orders: List[WorkOrder],
        operations_by_work_order: Dict[int, List[WorkOrderOperation]],
        constraints: Dict[str, Any],
    ) -> Dict[str, Any]:
        """有限产能启发式排程：工作中心 + 设备 + 模具/工装 + 冻结语义。"""
        from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService

        score_service = WorkOrderScoreService()
        score_map = await score_service.batch_get_or_compute(
            tenant_id,
            [wo.id for wo in work_orders],
            "scheduling",
            refresh_if_stale=True,
            include_kitting=False,
        )

        objective = constraints.get("optimize_objective", "min_makespan")
        horizon_days = int(constraints.get("scheduling_window_days", 14))
        rolling_horizon_days = int(constraints.get("rolling_horizon_days", horizon_days))
        freeze_horizon_days = int(constraints.get("freeze_horizon_days", 2))
        daily_capacity_hours = float(constraints.get("daily_capacity_hours", 24.0))
        setup_changeover_hours = float(constraints.get("setup_changeover_hours", 1.0))
        consider_setup_family = bool(constraints.get("consider_setup_family", True))
        bottleneck_first = bool(constraints.get("bottleneck_first", True))
        explicit_bottlenecks = {
            int(x) for x in (constraints.get("bottleneck_work_center_ids") or []) if int(x) > 0
        }
        bottleneck_centers = explicit_bottlenecks or self._infer_bottleneck_centers(work_orders, top_n=1)
        freeze_anchor = self._normalize_shift_start(datetime.now() + timedelta(days=freeze_horizon_days))

        def _sort_tuple(wo: WorkOrder) -> Tuple:
            wc_id = int(wo.work_center_id or wo.workshop_id or 0)
            bottleneck_rank = 0 if (bottleneck_first and wc_id in bottleneck_centers) else 1
            if wo.is_frozen or self._is_in_freeze_window(wo, freeze_anchor):
                return (-1, wo.planned_start_date or datetime.min, 0.0)
            score = float(score_map.get(wo.id) or self._get_priority_score(wo, constraints))
            due = wo.planned_end_date or datetime.max
            if objective == "min_tardiness":
                return (bottleneck_rank, due, -score)
            return (bottleneck_rank, -score, due)

        sorted_orders = sorted(work_orders, key=_sort_tuple)
        resource_next_available: Dict[str, datetime] = {}
        work_center_daily_usage: Dict[Tuple[int, date], float] = defaultdict(float)
        work_center_last_family: Dict[int, str] = {}
        scheduled_orders: List[Dict[str, Any]] = []
        unscheduled_orders: List[Dict[str, Any]] = []
        conflicts: List[Dict[str, Any]] = []
        setup_changeover_count = 0

        now_anchor = self._normalize_shift_start(datetime.now())

        for work_order in sorted_orders:
            operations = operations_by_work_order.get(int(work_order.id), [])
            estimated_hours = self._estimate_work_order_hours(work_order, operations)
            due_date = work_order.planned_end_date
            base_start = self._normalize_shift_start(work_order.planned_start_date or now_anchor)

            if work_order.is_frozen or self._is_in_freeze_window(work_order, freeze_anchor):
                if not (work_order.planned_start_date and work_order.planned_end_date):
                    unscheduled_orders.append(
                        {
                            "work_order_id": work_order.id,
                            "work_order_code": work_order.code,
                            "reason": "冻结窗口内工单缺少计划起止时间，无法参与排程",
                        }
                    )
                    continue
                scheduled_orders.append(
                    {
                        "work_order_id": work_order.id,
                        "work_order_code": work_order.code,
                        "planned_start_date": work_order.planned_start_date,
                        "planned_end_date": work_order.planned_end_date,
                        "scheduled_date": work_order.planned_start_date.date(),
                        "delay_days": 0,
                        "estimated_hours": estimated_hours,
                        "due_date": due_date,
                        "frozen": bool(work_order.is_frozen),
                        "frozen_window_locked": bool(not work_order.is_frozen),
                    }
                )
                continue

            work_center_id = int(work_order.work_center_id or work_order.workshop_id or 0)
            setup_family = self._derive_setup_family(work_order, operations)
            resource_keys = [f"wc:{work_center_id}"]
            if constraints.get("consider_equipment", True):
                for op in operations:
                    if op.assigned_equipment_id:
                        resource_keys.append(f"eq:{int(op.assigned_equipment_id)}")
                        break
            if constraints.get("consider_human", True):
                for op in operations:
                    if op.assigned_worker_id:
                        resource_keys.append(f"hr:{int(op.assigned_worker_id)}")
                        break
            if constraints.get("consider_mold_tool", True):
                for op in operations:
                    if op.assigned_mold_id:
                        resource_keys.append(f"mold:{int(op.assigned_mold_id)}")
                    if op.assigned_tool_id:
                        resource_keys.append(f"tool:{int(op.assigned_tool_id)}")
            resource_keys = sorted(set(resource_keys))

            candidate_start = max(base_start, freeze_anchor)
            window_end = freeze_anchor + timedelta(days=rolling_horizon_days)
            placed = False
            while candidate_start <= window_end:
                max_resource_start = max([candidate_start] + [resource_next_available.get(k, candidate_start) for k in resource_keys])
                slot_start = self._normalize_shift_start(max_resource_start)
                effective_hours = estimated_hours
                if consider_setup_family:
                    last_family = work_center_last_family.get(work_center_id)
                    if last_family and last_family != setup_family:
                        effective_hours += setup_changeover_hours
                slot_end = self._add_work_hours(slot_start, effective_hours, daily_capacity_hours)

                # 工作中心日负荷约束（24h 时等价无限，不额外限制）
                if daily_capacity_hours < 24:
                    day_cursor = slot_start
                    overflow = False
                    while day_cursor < slot_end:
                        day = day_cursor.date()
                        day_start = day_cursor.replace(hour=8, minute=0, second=0, microsecond=0)
                        day_end = day_start + timedelta(hours=daily_capacity_hours)
                        segment_end = min(slot_end, day_end)
                        segment_hours = max((segment_end - day_cursor).total_seconds() / 3600.0, 0.0)
                        used = work_center_daily_usage[(work_center_id, day)]
                        if used + segment_hours > daily_capacity_hours + 1e-6:
                            overflow = True
                            break
                        day_cursor = segment_end
                        if day_cursor >= day_end:
                            day_cursor = (day_start + timedelta(days=1)).replace(hour=8, minute=0, second=0, microsecond=0)
                    if overflow:
                        candidate_start = slot_start + timedelta(hours=1)
                        continue

                # 命中可用槽位
                for key in resource_keys:
                    resource_next_available[key] = slot_end
                if consider_setup_family:
                    prev_family = work_center_last_family.get(work_center_id)
                    if prev_family and prev_family != setup_family:
                        setup_changeover_count += 1
                    work_center_last_family[work_center_id] = setup_family
                if daily_capacity_hours < 24:
                    day_cursor = slot_start
                    while day_cursor < slot_end:
                        day = day_cursor.date()
                        day_start = day_cursor.replace(hour=8, minute=0, second=0, microsecond=0)
                        day_end = day_start + timedelta(hours=daily_capacity_hours)
                        segment_end = min(slot_end, day_end)
                        segment_hours = max((segment_end - day_cursor).total_seconds() / 3600.0, 0.0)
                        work_center_daily_usage[(work_center_id, day)] += segment_hours
                        day_cursor = segment_end
                        if day_cursor >= day_end:
                            day_cursor = (day_start + timedelta(days=1)).replace(hour=8, minute=0, second=0, microsecond=0)

                delay_days = max((slot_start.date() - base_start.date()).days, 0)
                scheduled_orders.append(
                    {
                        "work_order_id": work_order.id,
                        "work_order_code": work_order.code,
                        "planned_start_date": slot_start,
                        "planned_end_date": slot_end,
                        "scheduled_date": slot_start.date(),
                        "delay_days": delay_days,
                        "estimated_hours": estimated_hours,
                        "effective_hours": effective_hours,
                        "setup_family": setup_family,
                        "due_date": due_date,
                    }
                )
                placed = True
                break

            if not placed:
                reason = f"滚动窗口 {rolling_horizon_days} 天内无可用产能或关键资源"
                unscheduled_orders.append(
                    {
                        "work_order_id": work_order.id,
                        "work_order_code": work_order.code,
                        "reason": reason,
                    }
                )
                conflicts.append(
                    {
                        "type": "capacity_window_exhausted",
                        "work_order_id": work_order.id,
                        "work_order_code": work_order.code,
                        "work_center_id": work_center_id,
                        "resource_keys": resource_keys,
                        "setup_family": setup_family,
                        "message": reason,
                    }
                )

        return {
            "scheduled_orders": scheduled_orders,
            "unscheduled_orders": unscheduled_orders,
            "conflicts": conflicts,
            "statistics": {
                "total_orders": len(work_orders),
                "scheduled_count": len(scheduled_orders),
                "unscheduled_count": len(unscheduled_orders),
                "scheduling_rate": len(scheduled_orders) / len(work_orders) if work_orders else 0.0,
                "bottleneck_work_centers": sorted(list(bottleneck_centers)),
                "freeze_horizon_days": freeze_horizon_days,
                "rolling_horizon_days": rolling_horizon_days,
                "setup_changeover_count": setup_changeover_count,
            },
        }

    async def _check_mold_tool_conflicts(self, tenant_id: int) -> List[Dict[str, Any]]:
        """
        检测模具/工装占用冲突
        
        同一模具/工装在同一时间段只能被一个工单工序使用。
        """
        conflicts = []
        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).filter(
            planned_start_date__isnull=False,
            planned_end_date__isnull=False
        ).all()
        
        # 按模具分组
        mold_slots: Dict[int, List[Tuple[datetime, datetime, int, str, str]]] = {}
        tool_slots: Dict[int, List[Tuple[datetime, datetime, int, str, str]]] = {}
        
        for op in ops:
            wo_code = op.work_order_code or str(op.work_order_id)
            op_name = op.operation_name or f"工序{op.sequence}"
            start_dt = op.planned_start_date
            end_dt = op.planned_end_date
            if not start_dt or not end_dt:
                continue
            
            if op.assigned_mold_id:
                mold_slots.setdefault(op.assigned_mold_id, []).append(
                    (start_dt, end_dt, op.work_order_id, wo_code, op_name)
                )
            if op.assigned_tool_id:
                tool_slots.setdefault(op.assigned_tool_id, []).append(
                    (start_dt, end_dt, op.work_order_id, wo_code, op_name)
                )
        
        def _find_overlaps(
            slots_dict: Dict[int, List[Tuple[datetime, datetime, int, str, str]]],
            resource_type: str
        ) -> None:
            for resource_id, slots in slots_dict.items():
                for i, (s1, e1, wo1, code1, name1) in enumerate(slots):
                    for j, (s2, e2, wo2, code2, name2) in enumerate(slots):
                        if i >= j:
                            continue
                        if s1 < e2 and s2 < e1:
                            conflicts.append({
                                "type": resource_type,
                                "resource_id": resource_id,
                                "work_order_id": wo1,
                                "work_order_code": code1,
                                "operation_name": name1,
                                "conflict_with_work_order_id": wo2,
                                "conflict_with_work_order_code": code2,
                                "conflict_with_operation_name": name2,
                                "message": f"{resource_type} ID={resource_id} 与工单 {code2} 工序 {name2} 时间重叠"
                            })
        
        _find_overlaps(mold_slots, "mold")
        _find_overlaps(tool_slots, "tool")
        return conflicts

    def _get_priority_score(self, work_order: WorkOrder, constraints: Dict[str, Any]) -> float:
        """计算工单优先级得分"""
        score = 0.0
        
        # 优先级得分
        priority_map = {"low": 1, "normal": 2, "high": 3, "urgent": 4}
        priority_score = priority_map.get(work_order.priority or "normal", 2)
        score += priority_score * constraints.get("priority_weight", 0.3)
        
        # 交期得分（交期越近，得分越高）
        if work_order.planned_end_date:
            days_until_due = (work_order.planned_end_date.date() - date.today()).days
            due_date_score = max(0, 10 - days_until_due) / 10  # 10天内交期得分最高
            score += due_date_score * constraints.get("due_date_weight", 0.3)
            
        # 计划一致性得分（工单开始日期越接近计划建议日期，得分越高）
        if work_order.planned_start_date:
            # 这里的思路是：排程系统应当尽量满足生产计划给出的建议日期，减少计划震荡
            # 如果没有建议日期，该权重则不生效
            score += 1.0 * constraints.get("plan_fidelity_weight", 0.2)
        
        return score
    
    async def apply_scheduling_results(
        self,
        tenant_id: int,
        results: List[Dict[str, Any]],
        updated_by: int
    ) -> bool:
        """
        应用排产结果
        
        将排产建议的具体日期更新到工单模型中，并推算工序级计划时间。
        """
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
            dispatch_work_order_score_recalc,
        )

        updated_ids: List[int] = []
        async with in_transaction():
            for res in results:
                wo_id = res.get("work_order_id")
                scheduled_date = res.get("scheduled_date")
                planned_start_date = res.get("planned_start_date")
                planned_end_date = res.get("planned_end_date")

                if not wo_id:
                    continue

                wo = await WorkOrder.get_or_none(id=wo_id, tenant_id=tenant_id)
                if wo:
                    dt_start = planned_start_date
                    dt_end = planned_end_date
                    if not dt_start and scheduled_date:
                        dt_start = datetime.combine(scheduled_date, datetime.min.time().replace(hour=8))
                    if not dt_end and scheduled_date:
                        dt_end = datetime.combine(scheduled_date, datetime.min.time().replace(hour=17))
                    if not dt_start:
                        continue
                    wo.planned_start_date = dt_start
                    if dt_end:
                        wo.planned_end_date = dt_end
                    wo.updated_by = updated_by
                    await wo.save()
                    updated_ids.append(wo_id)

                    operations = await WorkOrderOperation.filter(
                        tenant_id=tenant_id,
                        work_order_id=wo_id,
                        deleted_at__isnull=True,
                    ).order_by("sequence").all()
                    if operations:
                        wo_service = WorkOrderService()
                        await wo_service.compute_and_apply_operation_planned_times(
                            tenant_id=tenant_id,
                            work_order=wo,
                            operations=operations,
                            updated_by=updated_by,
                        )
                    else:
                        await WorkOrder.filter(tenant_id=tenant_id, id=wo_id).update(
                            planned_end_date=dt_end or datetime.combine(scheduled_date, datetime.min.time().replace(hour=17)),
                        )

        for wo_id in updated_ids:
            await dispatch_work_order_score_recalc(wo_id, include_kitting=False)
        return True

    async def optimize_schedule(
        self,
        tenant_id: int,
        schedule_id: Optional[int] = None,
        optimization_params: Optional[Dict[str, Any]] = None,
        updated_by: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        优化排产计划
        """
        params = optimization_params or {}
        objective = params.get("optimization_objective") or "min_makespan"
        max_iterations = int(params.get("max_iterations") or 100)

        from apps.kuaizhizao.services.scheduling_config_service import SchedulingConfigService

        default_cfg = await SchedulingConfigService().get_default_config(tenant_id)
        merged_constraints = self._build_constraints(default_cfg.constraints if default_cfg else None)
        merged_constraints["optimize_objective"] = objective
        merged_constraints["scheduling_window_days"] = min(90, max(7, int(max_iterations / 10)))

        status_filter = ["draft", "released"]
        before_work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=status_filter,
            deleted_at__isnull=True,
        ).all()
        before_rows: List[Dict[str, Any]] = []
        for wo in before_work_orders:
            before_rows.append(
                {
                    "work_order_id": wo.id,
                    "planned_start_date": wo.planned_start_date,
                    "planned_end_date": wo.planned_end_date,
                    "due_date": wo.planned_end_date,
                }
            )

        before_completion = max(
            [r["planned_end_date"] for r in before_rows if r.get("planned_end_date")],
            default=None,
        )
        before_tardiness = self._calc_total_tardiness_hours(before_rows)

        result = await self.intelligent_scheduling(
            tenant_id=tenant_id,
            constraints=merged_constraints,
            apply_results=True,
            updated_by=updated_by,
        )
        scheduled_rows = result.get("scheduled_orders", [])
        after_completion = max(
            [r.get("planned_end_date") for r in scheduled_rows if r.get("planned_end_date")],
            default=None,
        )
        after_tardiness = self._calc_total_tardiness_hours(scheduled_rows)

        if objective == "min_tardiness":
            base = before_tardiness or 1.0
            improvement = max((before_tardiness - after_tardiness) / base, 0.0)
        else:
            before_span = (
                (before_completion - min([r["planned_start_date"] for r in before_rows if r.get("planned_start_date")])).total_seconds()
                / 3600.0
            ) if before_completion and any(r.get("planned_start_date") for r in before_rows) else 0.0
            after_span = (
                (after_completion - min([r["planned_start_date"] for r in scheduled_rows if r.get("planned_start_date")])).total_seconds()
                / 3600.0
            ) if after_completion and any(r.get("planned_start_date") for r in scheduled_rows) else 0.0
            base = before_span or 1.0
            improvement = max((before_span - after_span) / base, 0.0)

        return {
            "optimized": True,
            "improvement": round(float(improvement), 6),
            "iterations": max_iterations,
            "objective": objective,
            "before_metrics": {
                "total_tardiness_hours": before_tardiness,
                "completion_time": before_completion.isoformat() if before_completion else None,
            },
            "after_metrics": {
                "total_tardiness_hours": after_tardiness,
                "completion_time": after_completion.isoformat() if after_completion else None,
            },
            "conflict_count": len(result.get("conflicts") or []),
            "unscheduled_count": len(result.get("unscheduled_orders") or []),
        }

    async def reschedule_impacted_orders(
        self,
        tenant_id: int,
        trigger_type: str,
        seed_work_order_ids: List[int],
        updated_by: Optional[int] = None,
        lookahead_hours: Optional[int] = None,
        apply_results: bool = True,
    ) -> Dict[str, Any]:
        """异常驱动局部重排：仅重排受影响工作中心在短窗口内的工单。"""
        seeds = [int(x) for x in seed_work_order_ids if int(x) > 0]
        if not seeds:
            return {
                "trigger_type": trigger_type,
                "seed_work_order_ids": [],
                "impacted_work_order_ids": [],
                "result": {
                    "scheduled_orders": [],
                    "unscheduled_orders": [],
                    "conflicts": [],
                    "statistics": {
                        "total_orders": 0,
                        "scheduled_count": 0,
                        "unscheduled_count": 0,
                        "scheduling_rate": 0.0,
                    },
                },
            }

        from apps.kuaizhizao.services.scheduling_config_service import SchedulingConfigService

        cfg = await SchedulingConfigService().get_default_config(tenant_id)
        constraints = self._build_constraints(cfg.constraints if cfg else None)
        local_hours = int(lookahead_hours or constraints.get("local_reschedule_hours", 72))
        window_end = datetime.now() + timedelta(hours=local_hours)

        seed_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=seeds,
            deleted_at__isnull=True,
        ).all()
        impacted_wcs = {
            int(wo.work_center_id or wo.workshop_id or 0)
            for wo in seed_orders
            if int(wo.work_center_id or wo.workshop_id or 0) > 0
        }
        if not impacted_wcs:
            impacted_wcs = {0}
        impacted_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=["draft", "released"],
            work_center_id__in=list(impacted_wcs),
            deleted_at__isnull=True,
        ).filter(
            planned_start_date__isnull=True
        ).all()
        timed_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=["draft", "released"],
            work_center_id__in=list(impacted_wcs),
            planned_start_date__isnull=False,
            planned_start_date__lte=window_end,
            deleted_at__isnull=True,
        ).all()
        impacted_map = {int(wo.id): wo for wo in impacted_orders + timed_orders}
        impacted_ids = sorted(list(impacted_map.keys()))
        if not impacted_ids:
            return {
                "trigger_type": trigger_type,
                "seed_work_order_ids": seeds,
                "impacted_work_order_ids": [],
                "result": {
                    "scheduled_orders": [],
                    "unscheduled_orders": [],
                    "conflicts": [],
                    "statistics": {
                        "total_orders": 0,
                        "scheduled_count": 0,
                        "unscheduled_count": 0,
                        "scheduling_rate": 0.0,
                    },
                },
            }

        result = await self.intelligent_scheduling(
            tenant_id=tenant_id,
            work_order_ids=impacted_ids,
            constraints=constraints,
            apply_results=apply_results,
            updated_by=updated_by,
        )
        result.setdefault("statistics", {})
        result["statistics"]["trigger_type"] = trigger_type
        result["statistics"]["seed_count"] = len(seeds)
        result["statistics"]["impacted_count"] = len(impacted_ids)
        result["statistics"]["lookahead_hours"] = local_hours
        return {
            "trigger_type": trigger_type,
            "seed_work_order_ids": seeds,
            "impacted_work_order_ids": impacted_ids,
            "result": result,
        }
