"""
滚动计划服务

关账、生成候选、发布写回工单计划日；与可视排产分工：日派工 vs 工位细排。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple
from zoneinfo import ZoneInfo

from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.rolling_schedule_plan import (
    RollingSchedulePlan,
    RollingSchedulePlanLine,
)
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.schemas.rolling_schedule import (
    RollingScheduleCapacityAdvisory,
    RollingScheduleLineInput,
    RollingSchedulePlanResponse,
)
from apps.kuaizhizao.schemas.work_order import WorkOrderBatchUpdateDatesItem
from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.master_data.models.factory import Workstation
from apps.master_data.models.performance import Holiday
from core.utils.timezone_utils import make_aware, resolve_business_datetime, site_timezone_name, to_api_isoformat
from infra.exceptions.exceptions import NotFoundError, ValidationError

DISPATCH_ACTIVE_STATUSES = (
    "draft",
    "released",
    "in_progress",
    "草稿",
    "已下达",
    "执行中",
    "进行中",
    "dispatched",
    "confirmed",
)
CARRY_FORWARD_STATUSES = DISPATCH_ACTIVE_STATUSES
RELEASED_POOL_STATUSES = (
    "released",
    "in_progress",
    "已下达",
    "执行中",
    "进行中",
    "dispatched",
    "confirmed",
)
DRAFT_STATUSES = ("draft", "草稿")
SOURCE_PRIORITY = {
    "carry_forward": 0,
    "already_scheduled": 1,
    "pool": 2,
    "backlog": 3,
    "manual": 4,
}


def _business_tz() -> ZoneInfo:
    return ZoneInfo(site_timezone_name())


def _plan_day_bounds(plan_date: date) -> Tuple[datetime, datetime]:
    """业务日历日边界（timezone-aware），与库内 planned_*_date 可比。"""
    tz_name = site_timezone_name()
    start = make_aware(datetime.combine(plan_date, datetime.min.time()), tz_name)
    end = make_aware(datetime.combine(plan_date, datetime.max.time()), tz_name)
    return start, end


def _planned_on_plan_date(planned_start: Optional[datetime], plan_date: date) -> bool:
    if not planned_start:
        return False
    local = (
        planned_start.astimezone(_business_tz())
        if planned_start.tzinfo is not None
        else planned_start
    )
    return local.date() == plan_date


def _as_comparable_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    tz_name = site_timezone_name()
    return make_aware(value, tz_name) if value.tzinfo is None else value


def _operation_local_date(value: Optional[datetime]) -> Optional[date]:
    if not value:
        return None
    local = value.astimezone(_business_tz()) if value.tzinfo is not None else value
    return local.date()


def _has_fine_schedule_on_plan_date(
    wo: WorkOrder,
    ops: List[WorkOrderOperation],
    plan_date: date,
    day_end: datetime,
) -> bool:
    """工序级已细排且落在计划日内则发布时不覆盖为全天占位。"""
    for op in ops:
        if op.status in {"completed", "cancelled"}:
            continue
        if not op.planned_start_date or not op.planned_end_date:
            continue
        if _operation_local_date(op.planned_start_date) != plan_date:
            continue
        local_start = (
            op.planned_start_date.astimezone(_business_tz())
            if op.planned_start_date.tzinfo is not None
            else op.planned_start_date
        )
        if local_start.hour != 0 or local_start.minute != 0:
            return True
        if int(op.assigned_station_id or 0) > 0:
            return True
    ps = _as_comparable_datetime(wo.planned_start_date)
    pe = _as_comparable_datetime(wo.planned_end_date)
    if ps and pe and _operation_local_date(ps) == plan_date:
        local_start = ps.astimezone(_business_tz()) if ps.tzinfo is not None else ps
        if local_start.hour != 0 or local_start.minute != 0:
            return True
        if pe != day_end:
            return True
    return False


def _scheduling_line_diagnostics(
    wo: Optional[WorkOrder],
    ops: List[WorkOrderOperation],
) -> List[str]:
    if not wo:
        return []
    issues: List[str] = []
    if not wo.planned_start_date:
        issues.append("缺计划开始")
    if not wo.planned_end_date:
        issues.append("缺计划结束")
    pending = [op for op in ops if op.status not in {"completed", "cancelled"}]
    missing_station = sum(1 for op in pending if not op.assigned_station_id)
    if missing_station:
        issues.append(f"缺工位{missing_station}道工序")
    missing_worker = sum(
        1 for op in pending if not op.assigned_worker_id and not op.assigned_team_id
    )
    if missing_worker:
        issues.append(f"缺人员/小组{missing_worker}道工序")
    return issues


class RollingScheduleService:
    def __init__(self) -> None:
        self.work_order_service = WorkOrderService()
        self.score_service = WorkOrderScoreService()

    async def _generate_plan_code(self, tenant_id: int, target_date: date) -> str:
        prefix = f"RSP{target_date.strftime('%Y%m%d')}"
        latest = (
            await RollingSchedulePlan.filter(
                tenant_id=tenant_id,
                plan_code__startswith=prefix,
            )
            .order_by("-plan_code")
            .first()
        )
        if latest:
            suffix = latest.plan_code[len(prefix) :]
            try:
                seq = int(suffix) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:03d}"

    async def get_next_workday(
        self,
        tenant_id: int,
        base_date: date,
        *,
        max_scan_days: int = 30,
    ) -> date:
        """下一工作日：跳过主数据节假日。"""
        holidays = await self._load_holiday_dates(tenant_id, base_date, max_scan_days)
        cursor = base_date + timedelta(days=1)
        for _ in range(max_scan_days):
            if cursor not in holidays:
                return cursor
            cursor += timedelta(days=1)
        raise ValidationError(f"基准日 {base_date} 后 {max_scan_days} 天内未找到工作日")

    async def _load_holiday_dates(
        self,
        tenant_id: int,
        from_date: date,
        span_days: int,
    ) -> Set[date]:
        to_date = from_date + timedelta(days=span_days)
        rows = await Holiday.filter(
            tenant_id=tenant_id,
            holiday_date__gte=from_date,
            holiday_date__lte=to_date,
            is_active=True,
            deleted_at__isnull=True,
        ).all()
        return {r.holiday_date for r in rows}

    async def get_plan_by_date(
        self,
        tenant_id: int,
        plan_date: date,
    ) -> Optional[RollingSchedulePlanResponse]:
        plan = await RollingSchedulePlan.get_or_none(
            tenant_id=tenant_id,
            plan_date=plan_date,
            deleted_at__isnull=True,
        )
        if not plan:
            return None
        return await self._build_plan_response(tenant_id, plan)

    async def close_day(
        self,
        tenant_id: int,
        plan_date: date,
        closed_by: int,
    ) -> RollingSchedulePlanResponse:
        plan = await RollingSchedulePlan.get_or_none(
            tenant_id=tenant_id,
            plan_date=plan_date,
            deleted_at__isnull=True,
        )
        if not plan:
            raise NotFoundError(f"计划日 {plan_date} 无滚动计划")
        if plan.status == "closed":
            raise ValidationError(f"计划日 {plan_date} 已关账")
        if plan.status != "published":
            raise ValidationError(f"计划日 {plan_date} 须先发布再关账（当前 {plan.status}）")

        lines = await RollingSchedulePlanLine.filter(
            tenant_id=tenant_id,
            plan_id=plan.id,
        ).order_by("sequence").all()
        wo_ids = [ln.work_order_id for ln in lines]
        wo_map: Dict[int, WorkOrder] = {}
        if wo_ids:
            wos = await WorkOrder.filter(tenant_id=tenant_id, id__in=wo_ids).all()
            wo_map = {w.id: w for w in wos}

        summary = self._build_close_summary(plan_date, lines, wo_map)
        plan.status = "closed"
        plan.closed_at = resolve_business_datetime()
        plan.close_summary = summary
        plan.updated_by = closed_by
        await plan.save()
        return await self._build_plan_response(tenant_id, plan)

    def _build_close_summary(
        self,
        plan_date: date,
        lines: List[RollingSchedulePlanLine],
        wo_map: Dict[int, WorkOrder],
    ) -> Dict[str, Any]:
        planned_count = len(lines)
        completed_count = 0
        partial_count = 0
        not_started_count = 0
        planned_qty = 0.0
        completed_qty = 0.0
        delayed_count = 0
        incomplete_items: List[Dict[str, Any]] = []

        for ln in lines:
            wo = wo_map.get(ln.work_order_id)
            if not wo:
                continue
            pq = float(ln.planned_quantity or wo.quantity or 0)
            cq = float(wo.completed_quantity or 0)
            planned_qty += pq
            completed_qty += min(cq, pq)

            if wo.status == "completed" or cq >= pq:
                completed_count += 1
            elif cq > 0:
                partial_count += 1
                incomplete_items.append(self._incomplete_item(wo, ln, "partial"))
            else:
                not_started_count += 1
                incomplete_items.append(self._incomplete_item(wo, ln, "not_started"))

            end_d = (
                wo.planned_end_date.astimezone(_business_tz()).date()
                if wo.planned_end_date and wo.planned_end_date.tzinfo is not None
                else (wo.planned_end_date.date() if wo.planned_end_date else None)
            )
            if end_d and end_d < plan_date and wo.status not in ("completed", "cancelled"):
                delayed_count += 1

        completion_rate = round((completed_qty / planned_qty * 100) if planned_qty > 0 else 0, 2)
        return {
            "plan_date": to_api_isoformat(plan_date),
            "planned_count": planned_count,
            "completed_count": completed_count,
            "partial_count": partial_count,
            "not_started_count": not_started_count,
            "planned_quantity": planned_qty,
            "completed_quantity": completed_qty,
            "completion_rate": completion_rate,
            "delayed_count": delayed_count,
            "incomplete_items": incomplete_items,
        }

    @staticmethod
    def _incomplete_item(
        wo: WorkOrder,
        ln: RollingSchedulePlanLine,
        reason: str,
    ) -> Dict[str, Any]:
        return {
            "work_order_id": wo.id,
            "work_order_code": wo.code,
            "work_order_name": wo.name,
            "status": wo.status,
            "planned_quantity": float(ln.planned_quantity or wo.quantity or 0),
            "completed_quantity": float(wo.completed_quantity or 0),
            "source_type": ln.source_type,
            "carry_forward": True,
            "reason": reason,
        }

    async def generate_plan(
        self,
        tenant_id: int,
        *,
        base_date: Optional[date] = None,
        backlog_readiness_threshold: float = 80.0,
        created_by: int,
    ) -> RollingSchedulePlanResponse:
        anchor = base_date or date.today()
        target_date = await self.get_next_workday(tenant_id, anchor)

        existing = await RollingSchedulePlan.get_or_none(
            tenant_id=tenant_id,
            plan_date=target_date,
            deleted_at__isnull=True,
        )
        if existing and existing.status == "published":
            raise ValidationError(f"下一工作日 {target_date} 计划已发布，不可重新生成")
        if existing and existing.status == "closed":
            raise ValidationError(f"下一工作日 {target_date} 计划已关账")

        prev_date = anchor
        prev_plan = await RollingSchedulePlan.get_or_none(
            tenant_id=tenant_id,
            plan_date=prev_date,
            deleted_at__isnull=True,
        )
        carry_ids: Set[int] = set()
        if prev_plan and prev_plan.close_summary:
            for item in prev_plan.close_summary.get("incomplete_items") or []:
                wid = item.get("work_order_id")
                if wid:
                    carry_ids.add(int(wid))
        elif prev_plan and prev_plan.status == "published":
            prev_lines = await RollingSchedulePlanLine.filter(
                tenant_id=tenant_id,
                plan_id=prev_plan.id,
            ).all()
            for ln in prev_lines:
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=ln.work_order_id)
                if wo and wo.status not in ("completed", "cancelled"):
                    pq = float(ln.planned_quantity or wo.quantity or 0)
                    cq = float(wo.completed_quantity or 0)
                    if cq < pq:
                        carry_ids.add(wo.id)

        candidates = await self._collect_candidates(
            tenant_id,
            target_date,
            carry_ids,
            backlog_readiness_threshold,
        )
        capacity = await self._compute_capacity_advisory(tenant_id, target_date, candidates)

        async with in_transaction():
            if existing:
                plan = existing
                plan.status = "draft"
                plan.prev_plan_date = prev_date
                plan.capacity_advisory = capacity.model_dump(mode="json")
                plan.updated_by = created_by
                await plan.save()
                await RollingSchedulePlanLine.filter(tenant_id=tenant_id, plan_id=plan.id).delete()
            else:
                plan_code = await self._generate_plan_code(tenant_id, target_date)
                plan = await RollingSchedulePlan.create(
                    tenant_id=tenant_id,
                    plan_code=plan_code,
                    plan_date=target_date,
                    status="draft",
                    prev_plan_date=prev_date,
                    capacity_advisory=capacity.model_dump(mode="json"),
                    created_by=created_by,
                    updated_by=created_by,
                )

            for seq, cand in enumerate(candidates):
                await RollingSchedulePlanLine.create(
                    tenant_id=tenant_id,
                    plan_id=plan.id,
                    work_order_id=cand["work_order_id"],
                    sequence=seq,
                    planned_quantity=cand.get("planned_quantity"),
                    source_type=cand["source_type"],
                    readiness_rate_snapshot=cand.get("readiness_rate_snapshot"),
                )

        return await self._build_plan_response(tenant_id, plan)

    async def _collect_candidates(
        self,
        tenant_id: int,
        target_date: date,
        carry_ids: Set[int],
        backlog_threshold: float,
    ) -> List[Dict[str, Any]]:
        active_wos = await WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=DISPATCH_ACTIVE_STATUSES,
            deleted_at__isnull=True,
        ).all()

        seen: Set[int] = set()
        buckets: Dict[str, List[Dict[str, Any]]] = {
            "carry_forward": [],
            "already_scheduled": [],
            "pool": [],
            "backlog": [],
        }

        for wo in active_wos:
            if wo.id in seen:
                continue
            readiness = float(wo.readiness_rate) if wo.readiness_rate is not None else None
            entry: Dict[str, Any] = {
                "work_order_id": wo.id,
                "planned_quantity": wo.quantity,
                "readiness_rate_snapshot": readiness,
                "work_order": wo,
            }

            if wo.id in carry_ids and (wo.status in CARRY_FORWARD_STATUSES):
                entry["source_type"] = "carry_forward"
                buckets["carry_forward"].append(entry)
                seen.add(wo.id)
                continue

            ps = wo.planned_start_date
            if _planned_on_plan_date(ps, target_date):
                entry["source_type"] = "already_scheduled"
                buckets["already_scheduled"].append(entry)
                seen.add(wo.id)
                continue

            if wo.status in RELEASED_POOL_STATUSES:
                entry["source_type"] = "pool"
                buckets["pool"].append(entry)
                seen.add(wo.id)
                continue

            if wo.status in DRAFT_STATUSES:
                if readiness is None or readiness >= backlog_threshold:
                    entry["source_type"] = "backlog"
                    buckets["backlog"].append(entry)
                    seen.add(wo.id)

        merged: List[Dict[str, Any]] = []
        for key in ("carry_forward", "already_scheduled", "pool", "backlog"):
            merged.extend(buckets[key])

        wo_list = [m["work_order"] for m in merged]
        score_map = await self.score_service.batch_ensure_scores(
            tenant_id,
            [w.id for w in wo_list],
            "scheduling",
            include_kitting=False,
        )

        def sort_key(item: Dict[str, Any]) -> Tuple[int, float, int]:
            src_pri = SOURCE_PRIORITY.get(item["source_type"], 9)
            wo = item["work_order"]
            cached = score_map.get(wo.id)
            score = float(cached.composite_score) if cached and cached.composite_score is not None else 0.0
            return (src_pri, -score, wo.id)

        merged.sort(key=sort_key)
        for item in merged:
            item.pop("work_order", None)
        return merged

    async def _compute_capacity_advisory(
        self,
        tenant_id: int,
        plan_date: date,
        candidates: List[Dict[str, Any]],
    ) -> RollingScheduleCapacityAdvisory:
        from apps.kuaizhizao.utils.working_time import load_scheduling_work_context

        _holidays, work_hours, _overtime = await load_scheduling_work_context(
            tenant_id, around=plan_date, span_days=7
        )
        daily_capacity = max(1.0, work_hours.daily_net_hours())
        station_rows = await Workstation.filter(
            tenant_id=tenant_id,
            is_active=True,
            deleted_at__isnull=True,
        ).values("max_parallel")
        station_count = len(station_rows)
        parallel_sum = sum(max(1, int(r.get("max_parallel") or 1)) for r in station_rows)
        station_count = max(1, station_count)
        parallel_sum = max(1, parallel_sum)
        available_hours = daily_capacity * parallel_sum

        wo_ids = [c["work_order_id"] for c in candidates]
        required_hours = 0.0
        if wo_ids:
            wos = await WorkOrder.filter(tenant_id=tenant_id, id__in=wo_ids).all()
            wo_qty = {w.id: float(w.quantity or 0) for w in wos}
            ops = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id__in=wo_ids,
                deleted_at__isnull=True,
            ).all()
            for op in ops:
                std = float(op.standard_time or 0)
                qty = wo_qty.get(op.work_order_id, 0)
                required_hours += std * qty

        utilization = round((required_hours / available_hours * 100) if available_hours > 0 else 0, 2)
        overloaded = required_hours > available_hours
        msg = (
            f"计划日 {plan_date} 粗产能：可用 {available_hours:.1f}h，候选标准工时合计 {required_hours:.1f}h"
            f"（{utilization}%）"
        )
        if overloaded:
            msg += "；已超载，请至可视排产做工位级确认"
        return RollingScheduleCapacityAdvisory(
            plan_date=plan_date,
            daily_capacity_hours=daily_capacity,
            station_count=station_count,
            available_hours=round(available_hours, 2),
            required_hours=round(required_hours, 2),
            utilization_rate=utilization,
            overloaded=overloaded,
            message=msg,
        )

    async def sync_from_aps_confirm(
        self,
        tenant_id: int,
        plan_date: date,
        work_order_ids: List[int],
        updated_by: int,
    ) -> RollingSchedulePlanResponse:
        """APS 确认落库后，将涉及工单同步写入/更新当日滚动计划行（以 APS 确认时刻为准）。"""
        ids = [int(i) for i in work_order_ids if int(i) > 0]
        if not ids:
            raise ValidationError("work_order_ids 不能为空")
        ids = list(dict.fromkeys(ids))

        plan = await RollingSchedulePlan.get_or_none(
            tenant_id=tenant_id,
            plan_date=plan_date,
            deleted_at__isnull=True,
        )
        async with in_transaction():
            if not plan:
                plan_code = await self._generate_plan_code(tenant_id, plan_date)
                plan = await RollingSchedulePlan.create(
                    tenant_id=tenant_id,
                    plan_code=plan_code,
                    plan_date=plan_date,
                    status="draft",
                    created_by=updated_by,
                    updated_by=updated_by,
                )
            elif plan.status == "closed":
                plan.status = "draft"
                plan.closed_at = None
                plan.close_summary = None
                plan.updated_by = updated_by
                await plan.save()

            existing = await RollingSchedulePlanLine.filter(
                tenant_id=tenant_id, plan_id=plan.id
            ).all()
            by_wo = {int(ln.work_order_id): ln for ln in existing}
            max_seq = max((int(ln.sequence) for ln in existing), default=-1)

            for wo_id in ids:
                wo = await WorkOrder.get_or_none(
                    tenant_id=tenant_id, id=wo_id, deleted_at__isnull=True
                )
                if not wo:
                    continue
                readiness = (
                    float(wo.readiness_rate) if wo.readiness_rate is not None else None
                )
                if wo_id in by_wo:
                    ln = by_wo[wo_id]
                    ln.source_type = "aps"
                    ln.readiness_rate_snapshot = readiness
                    ln.planned_quantity = wo.quantity
                    await ln.save()
                else:
                    max_seq += 1
                    await RollingSchedulePlanLine.create(
                        tenant_id=tenant_id,
                        plan_id=plan.id,
                        work_order_id=wo_id,
                        sequence=max_seq,
                        planned_quantity=wo.quantity,
                        source_type="aps",
                        readiness_rate_snapshot=readiness,
                    )
            plan.updated_by = updated_by
            await plan.save()

        return await self._build_plan_response(tenant_id, plan)

    async def update_lines(
        self,
        tenant_id: int,
        plan_id: int,
        lines: List[RollingScheduleLineInput],
        updated_by: int,
    ) -> RollingSchedulePlanResponse:
        plan = await RollingSchedulePlan.get_or_none(
            tenant_id=tenant_id,
            id=plan_id,
            deleted_at__isnull=True,
        )
        if not plan:
            raise NotFoundError("滚动计划不存在")
        if plan.status != "draft":
            raise ValidationError("仅草稿计划可调整行")

        wo_ids = [ln.work_order_id for ln in lines]
        if len(wo_ids) != len(set(wo_ids)):
            raise ValidationError("计划行工单不可重复")

        async with in_transaction():
            await RollingSchedulePlanLine.filter(tenant_id=tenant_id, plan_id=plan.id).delete()
            for ln in lines:
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=ln.work_order_id)
                if not wo:
                    raise ValidationError(f"工单 {ln.work_order_id} 不存在")
                readiness = float(wo.readiness_rate) if wo.readiness_rate is not None else None
                await RollingSchedulePlanLine.create(
                    tenant_id=tenant_id,
                    plan_id=plan.id,
                    work_order_id=ln.work_order_id,
                    sequence=ln.sequence,
                    planned_quantity=ln.planned_quantity,
                    source_type=ln.source_type or "manual",
                    readiness_rate_snapshot=readiness,
                    remarks=ln.remarks,
                )
            plan.updated_by = updated_by
            await plan.save()

        return await self._build_plan_response(tenant_id, plan)

    async def publish_plan(
        self,
        tenant_id: int,
        plan_id: int,
        published_by: int,
    ) -> Tuple[RollingSchedulePlanResponse, Dict[str, Any]]:
        plan = await RollingSchedulePlan.get_or_none(
            tenant_id=tenant_id,
            id=plan_id,
            deleted_at__isnull=True,
        )
        if not plan:
            raise NotFoundError("滚动计划不存在")
        if plan.status != "draft":
            raise ValidationError("仅草稿计划可发布")

        lines = await RollingSchedulePlanLine.filter(
            tenant_id=tenant_id,
            plan_id=plan.id,
        ).order_by("sequence").all()
        if not lines:
            raise ValidationError("计划无工单行，无法发布")

        plan_date = plan.plan_date
        day_start, day_end = _plan_day_bounds(plan_date)

        wo_ids = [ln.work_order_id for ln in lines]
        all_ops: List[WorkOrderOperation] = []
        if wo_ids:
            all_ops = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id__in=wo_ids,
                deleted_at__isnull=True,
            ).all()
        ops_by_wo: Dict[int, List[WorkOrderOperation]] = {}
        for op in all_ops:
            ops_by_wo.setdefault(int(op.work_order_id), []).append(op)

        updates: List[WorkOrderBatchUpdateDatesItem] = []
        for ln in lines:
            wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=ln.work_order_id)
            if not wo:
                continue
            wo_ops = ops_by_wo.get(int(wo.id), [])
            if _has_fine_schedule_on_plan_date(wo, wo_ops, plan_date, day_end):
                continue
            end_dt = _as_comparable_datetime(wo.planned_end_date)
            if not end_dt or end_dt < day_start:
                end_dt = day_end
            elif end_dt.astimezone(_business_tz()).date() == plan_date:
                end_dt = day_end
            updates.append(
                WorkOrderBatchUpdateDatesItem(
                    work_order_id=wo.id,
                    planned_start_date=day_start,
                    planned_end_date=end_dt,
                )
            )

        batch_result: Dict[str, Any] = {
            "updated": [],
            "skipped_frozen": [],
            "skipped_freeze_window": [],
            "failed": [],
        }
        if updates:
            batch_result = await self.work_order_service.batch_update_dates(
                tenant_id=tenant_id,
                updates=updates,
                updated_by=published_by,
                bypass_freeze=True,
            )

        plan.status = "published"
        plan.published_at = resolve_business_datetime()
        plan.published_by = published_by
        plan.updated_by = published_by
        await plan.save()

        response = await self._build_plan_response(tenant_id, plan)
        return response, batch_result

    async def is_published_for_date(self, tenant_id: int, plan_date: date) -> bool:
        plan = await RollingSchedulePlan.get_or_none(
            tenant_id=tenant_id,
            plan_date=plan_date,
            status="published",
            deleted_at__isnull=True,
        )
        return plan is not None

    async def get_published_work_order_ids(
        self,
        tenant_id: int,
        plan_date: date,
    ) -> List[int]:
        plan = await RollingSchedulePlan.get_or_none(
            tenant_id=tenant_id,
            plan_date=plan_date,
            status__in=["published", "closed"],
            deleted_at__isnull=True,
        )
        if not plan:
            return []
        lines = await RollingSchedulePlanLine.filter(
            tenant_id=tenant_id,
            plan_id=plan.id,
        ).all()
        return [ln.work_order_id for ln in lines]

    async def _build_plan_response(
        self,
        tenant_id: int,
        plan: RollingSchedulePlan,
    ) -> RollingSchedulePlanResponse:
        lines = await RollingSchedulePlanLine.filter(
            tenant_id=tenant_id,
            plan_id=plan.id,
        ).order_by("sequence").all()
        wo_ids = [ln.work_order_id for ln in lines]
        wo_map: Dict[int, WorkOrder] = {}
        ops_by_wo: Dict[int, List[WorkOrderOperation]] = {}
        if wo_ids:
            wos = await WorkOrder.filter(tenant_id=tenant_id, id__in=wo_ids).all()
            wo_map = {w.id: w for w in wos}
            all_ops = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id__in=wo_ids,
                deleted_at__isnull=True,
            ).all()
            for op in all_ops:
                ops_by_wo.setdefault(int(op.work_order_id), []).append(op)

        score_map = await self.score_service.batch_get_scores(
            tenant_id,
            wo_ids,
            "scheduling",
        ) if wo_ids else {}

        line_responses = []
        for ln in lines:
            wo = wo_map.get(ln.work_order_id)
            cached = score_map.get(ln.work_order_id)
            wo_ops = ops_by_wo.get(ln.work_order_id, [])
            line_responses.append(
                {
                    "id": ln.id,
                    "work_order_id": ln.work_order_id,
                    "sequence": ln.sequence,
                    "planned_quantity": ln.planned_quantity,
                    "source_type": ln.source_type,
                    "readiness_rate_snapshot": ln.readiness_rate_snapshot,
                    "remarks": ln.remarks,
                    "work_order_code": wo.code if wo else None,
                    "work_order_name": wo.name if wo else None,
                    "work_order_status": wo.status if wo else None,
                    "quantity": wo.quantity if wo else None,
                    "completed_quantity": wo.completed_quantity if wo else None,
                    "planned_start_date": wo.planned_start_date if wo else None,
                    "planned_end_date": wo.planned_end_date if wo else None,
                    "scheduling_score": float(cached.composite_score) if cached and cached.composite_score else None,
                    "scheduling_rank_band": cached.rank_band if cached else None,
                    "scheduling_diagnostics": _scheduling_line_diagnostics(wo, wo_ops),
                }
            )

        return RollingSchedulePlanResponse(
            id=plan.id,
            uuid=plan.uuid,
            plan_code=plan.plan_code,
            plan_date=plan.plan_date,
            status=plan.status,
            prev_plan_date=plan.prev_plan_date,
            closed_at=plan.closed_at,
            close_summary=plan.close_summary,
            published_at=plan.published_at,
            published_by=plan.published_by,
            capacity_advisory=plan.capacity_advisory,
            notes=plan.notes,
            lines=line_responses,
        )
