"""设备点检单 / 保养执行运维造数（按点检计划 / 保养计划）。"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Optional

from loguru import logger

from apps.kuaizhizao.services.flow_data_generate_service import (
    FlowDataGenerateService,
    StepOperatorConfig,
    _optional_positive_int,
    parse_work_schedule,
)
from apps.kuaizhizao.services.spot_check_reminder_service import (
    _period_key_and_start,
)
from core.services.document_time_rewrite_service import WorkScheduleParams
from core.utils.timezone_utils import resolve_business_datetime, to_site_date
from infra.exceptions.exceptions import ValidationError

MAX_OCCURRENCES_PER_TARGET = 90


@dataclass
class EquipmentOpsGenerateRequest:
    spot_check_plan_ids: list[int] = field(default_factory=list)
    maintenance_plan_ids: list[int] = field(default_factory=list)
    equipment_ids: list[int] = field(default_factory=list)
    anchor_start: Optional[datetime] = None
    anchor_end: Optional[datetime] = None
    work_schedule: Optional[WorkScheduleParams] = None
    use_work_schedule: bool = False
    auto_approve_spot_check: bool = False
    inspector_operator: StepOperatorConfig = field(
        default_factory=lambda: StepOperatorConfig(mode="equipment_assigned")
    )
    approver_operator: StepOperatorConfig = field(
        default_factory=lambda: StepOperatorConfig(mode="scheme_assigned")
    )

    def resolved_window(self) -> tuple[datetime, datetime]:
        if self.anchor_start is None or self.anchor_end is None:
            raise ValidationError("请选择日期范围的开始与结束日期")
        start = resolve_business_datetime(self.anchor_start).replace(microsecond=0)
        end = resolve_business_datetime(self.anchor_end).replace(microsecond=0)
        if end < start:
            raise ValidationError("结束日期不能早于开始日期")
        return start, end


def _parse_ops_operator(raw: Any, *, default_mode: str) -> StepOperatorConfig:
    if not isinstance(raw, dict):
        return StepOperatorConfig(mode=default_mode)
    return StepOperatorConfig(
        mode=str(raw.get("mode") or default_mode),
        user_id=_optional_positive_int(raw.get("user_id")),
        role_code=(str(raw.get("role_code")).strip() if raw.get("role_code") else None),
        department_id=_optional_positive_int(raw.get("department_id")),
        work_group_id=_optional_positive_int(raw.get("work_group_id")),
    )


def _parse_id_list(raw: Any) -> list[int]:
    if not isinstance(raw, list):
        return []
    out: list[int] = []
    seen: set[int] = set()
    for item in raw:
        try:
            n = int(item)
        except (TypeError, ValueError):
            continue
        if n <= 0 or n in seen:
            continue
        seen.add(n)
        out.append(n)
    return out


def parse_equipment_ops_generate_request(raw: dict[str, Any]) -> EquipmentOpsGenerateRequest:
    schedule_raw = raw.get("work_schedule")
    return EquipmentOpsGenerateRequest(
        spot_check_plan_ids=_parse_id_list(raw.get("spot_check_plan_ids")),
        maintenance_plan_ids=_parse_id_list(raw.get("maintenance_plan_ids")),
        equipment_ids=_parse_id_list(raw.get("equipment_ids")),
        anchor_start=raw.get("anchor_start"),
        anchor_end=raw.get("anchor_end"),
        work_schedule=parse_work_schedule(schedule_raw if isinstance(schedule_raw, dict) else None),
        use_work_schedule=bool(raw.get("use_work_schedule")),
        auto_approve_spot_check=bool(raw.get("auto_approve_spot_check")),
        inspector_operator=_parse_ops_operator(
            raw.get("inspector_operator"), default_mode="equipment_assigned"
        ),
        approver_operator=_parse_ops_operator(
            raw.get("approver_operator"), default_mode="scheme_assigned"
        ),
    )


def _iter_named_cycle_dates(
    cycle_type: Optional[str], start_d: date, end_d: date
) -> list[date]:
    """按点检周期名（每班/每天/每周/每月/每季度）在日期范围内取各周期起点。"""
    if end_d < start_d:
        return []
    seen: set[str] = set()
    out: list[date] = []
    d = start_d
    while d <= end_d:
        key, period_start = _period_key_and_start(cycle_type, d)
        if key not in seen:
            seen.add(key)
            out.append(period_start if period_start >= start_d else d)
            if len(out) >= MAX_OCCURRENCES_PER_TARGET:
                break
        d += timedelta(days=1)
    return out


def _iter_time_cycle_datetimes(
    *,
    start: datetime,
    end: datetime,
    cycle_value: Optional[int],
    cycle_unit: Optional[str],
) -> list[datetime]:
    value = max(1, int(cycle_value or 1))
    unit = (cycle_unit or "天").strip().lower()
    cur = start
    out: list[datetime] = []
    while cur <= end and len(out) < MAX_OCCURRENCES_PER_TARGET:
        out.append(cur)
        if unit in ("小时", "hour", "h", "hours"):
            cur = cur + timedelta(hours=value)
        else:
            cur = cur + timedelta(days=value)
    return out


def _apply_work_time(dt: datetime, req: EquipmentOpsGenerateRequest) -> datetime:
    """把发生时刻落到工作时段开始时间（可选）。"""
    if not req.use_work_schedule or not req.work_schedule:
        return dt
    ws = req.work_schedule
    start_s = (ws.start_time or "09:00:00").strip()
    parts = start_s.split(":")
    try:
        hour = int(parts[0]) if parts else 9
        minute = int(parts[1]) if len(parts) > 1 else 0
        second = int(parts[2]) if len(parts) > 2 else 0
    except (TypeError, ValueError):
        hour, minute, second = 9, 0, 0
    return dt.replace(hour=hour, minute=minute, second=second, microsecond=0)


def _equipment_items_from_plan(plan: Any) -> list[dict[str, Any]]:
    items = getattr(plan, "equipment_items", None) or []
    if isinstance(items, list) and items:
        return [it for it in items if isinstance(it, dict)]
    eid = int(getattr(plan, "equipment_id", 0) or 0)
    if eid <= 0:
        return []
    return [
        {
            "id": eid,
            "uuid": str(getattr(plan, "equipment_uuid", "") or ""),
            "code": None,
            "name": getattr(plan, "equipment_name", None),
        }
    ]


async def _equipment_items_from_scheme_binding(
    tenant_id: int,
    *,
    scheme_id: Optional[int],
    scheme_type: str,
) -> list[dict[str, Any]]:
    """计划设备改由方案绑定展开时，造数从 EquipmentSchemeBinding 取设备。"""
    if not scheme_id:
        return []
    from apps.kuaizhizao.models.equipment import Equipment
    from apps.kuaizhizao.models.equipment_ops import EquipmentSchemeBinding

    bindings = await EquipmentSchemeBinding.filter(
        tenant_id=tenant_id,
        scheme_id=int(scheme_id),
        scheme_type=scheme_type,
        deleted_at__isnull=True,
    ).order_by("id").all()
    if not bindings:
        return []
    rows = await Equipment.filter(
        tenant_id=tenant_id,
        id__in=[b.equipment_id for b in bindings],
        deleted_at__isnull=True,
    ).all()
    by_id = {r.id: r for r in rows}
    out: list[dict[str, Any]] = []
    seen: set[int] = set()
    for b in bindings:
        eq = by_id.get(b.equipment_id)
        if not eq or eq.id in seen:
            continue
        seen.add(eq.id)
        out.append({"id": eq.id, "uuid": eq.uuid, "code": eq.code, "name": eq.name})
    return out


class EquipmentOpsDataGenerateService:
    """按所选点检计划 / 保养计划与其设备、周期批量造演示单据。"""

    async def _resolve_ops_person(
        self,
        *,
        tenant_id: int,
        cfg: StepOperatorConfig,
        fallback_user_id: int,
        assigned_user_id: Optional[int],
        assigned_user_name: Optional[str],
        label: str,
        role_step_key: str,
    ) -> tuple[int, str, Optional[str]]:
        from apps.common.audit_actor import operator_name_from_user
        from infra.models.user import User

        mode = cfg.normalized_mode()
        if mode in ("equipment_assigned", "scheme_assigned"):
            uid = int(assigned_user_id or 0)
            if uid <= 0:
                fb = await User.get_or_none(id=fallback_user_id)
                return (
                    int(fallback_user_id),
                    operator_name_from_user(fb) or str(fallback_user_id),
                    f"{label}: 主数据未指定人员，已回退当前用户",
                )
            name = (assigned_user_name or "").strip()
            if not name:
                user = await User.get_or_none(
                    id=uid, deleted_at__isnull=True, is_active=True
                )
                name = operator_name_from_user(user) if user else str(uid)
            return uid, name, None

        uid, note = await FlowDataGenerateService()._pick_operator_for_step(
            tenant_id=tenant_id,
            step_key=role_step_key,
            cfg=cfg,
            fallback_user_id=fallback_user_id,
        )
        user = await User.get_or_none(id=uid, deleted_at__isnull=True)
        name = operator_name_from_user(user) if user else str(uid)
        if note:
            note = note.replace(f"{role_step_key}:", f"{label}:", 1)
        return int(uid), name, note

    async def preview(
        self, tenant_id: int, req: EquipmentOpsGenerateRequest
    ) -> dict[str, Any]:
        start, end = req.resolved_window()
        plan = await self._build_plan(tenant_id, req)
        return {
            "equipment_count": plan["equipment_count"],
            "spot_check_plan_count": plan["spot_check_plan_count"],
            "maintenance_plan_count": plan["maintenance_plan_count"],
            "spot_check_targets": plan["spot_check_targets"],
            "maintenance_targets": plan["maintenance_targets"],
            "spot_check_docs": plan["spot_check_docs"],
            "maintenance_docs": plan["maintenance_docs"],
            "notes": plan["notes"],
            "anchor_start": start.isoformat(),
            "anchor_end": end.isoformat(),
        }

    async def execute(
        self,
        *,
        tenant_id: int,
        operator_id: int,
        operator_name: Optional[str],
        current_user: Any,
        req: EquipmentOpsGenerateRequest,
    ) -> dict[str, Any]:
        from apps.kuaizhizao.schemas.equipment_ops import SpotCheckUpdate, SpotCheckLineInput
        from apps.kuaizhizao.schemas.maintenance_plan import MaintenanceExecutionCreate
        from apps.kuaizhizao.services.equipment_ops_service import (
            EquipmentSpotCheckService,
        )
        from apps.kuaizhizao.services.maintenance_plan_service import MaintenanceExecutionService
        from infra.models.user import User
        from apps.kuaizhizao.models.equipment_ops import EquipmentSpotCheck
        from apps.kuaizhizao.schemas.equipment_spot_check_plan import GenerateSpotChecksRequest
        from apps.kuaizhizao.services.equipment_spot_check_plan_service import EquipmentSpotCheckPlanService

        plan = await self._build_plan(tenant_id, req)
        run_id = str(uuid.uuid4())

        op_user = await User.get_or_none(id=operator_id)
        op_name = (
            operator_name
            or (getattr(op_user, "display_name", None) if op_user else None)
            or (getattr(op_user, "username", None) if op_user else None)
            or str(operator_id)
        )

        spot_svc = EquipmentSpotCheckService()
        created: list[dict[str, Any]] = []
        errors: list[str] = []
        notes: list[str] = list(plan["notes"])

        for job in plan["spot_jobs"]:
            equipment = job["equipment"]
            sc_plan = job["plan"]
            issued = job["issued_at"]
            scheme_id = int(sc_plan.scheme_id)

            inspector_id, inspector_name, insp_note = await self._resolve_ops_person(
                tenant_id=tenant_id,
                cfg=req.inspector_operator,
                fallback_user_id=operator_id,
                assigned_user_id=(
                    getattr(sc_plan, "responsible_person_id", None)
                    or getattr(equipment, "spot_check_person_id", None)
                ),
                assigned_user_name=(
                    getattr(sc_plan, "responsible_person_name", None)
                    or getattr(equipment, "spot_check_person_name", None)
                ),
                label=f"点检执行人({equipment.code})",
                role_step_key="reporting",
            )
            if insp_note:
                notes.append(insp_note)
            approver_id, approver_name, appr_note = await self._resolve_ops_person(
                tenant_id=tenant_id,
                cfg=req.approver_operator,
                fallback_user_id=operator_id,
                assigned_user_id=sc_plan.scheme_snapshot.get("reviewer_user_id"),
                assigned_user_name=sc_plan.scheme_snapshot.get("reviewer_user_name"),
                label=f"点检审批人({sc_plan.scheme_code})",
                role_step_key="finished_goods_inspection",
            )
            if appr_note:
                notes.append(appr_note)
            approver_user = await User.get_or_none(
                id=approver_id, deleted_at__isnull=True, is_active=True
            )

            check_date = to_site_date(issued)
            try:
                await EquipmentSpotCheckPlanService.generate_spot_checks(
                    tenant_id, str(sc_plan.uuid),
                    GenerateSpotChecksRequest(
                        check_date=check_date, equipment_uuids=[str(equipment.uuid)],
                    ),
                    current_user=current_user,
                )
                header = await EquipmentSpotCheck.filter(
                    tenant_id=tenant_id, plan_id=sc_plan.id, equipment_id=equipment.id,
                    period_key=job["period_key"], deleted_at__isnull=True,
                ).first()
                if not header or header.status != "待执行":
                    notes.append(f"计划 {sc_plan.plan_no} 设备 {equipment.code}: 任务已执行，跳过")
                    continue
                task_lines = await spot_svc._load_lines(tenant_id, header.id)
                line_inputs = [
                    SpotCheckLineInput(
                        line_no=line.line_no, item_id=line.item_id, is_pass=True,
                        measured_value=(
                            str(line.numeric_min if line.numeric_min is not None else line.numeric_max if line.numeric_max is not None else 1)
                            if line.value_type == "numeric" else "是"
                        ),
                    ) for line in task_lines
                ]
                header = await spot_svc.update(
                    tenant_id, header.id,
                    SpotCheckUpdate(
                        inspector_id=inspector_id,
                        inspector_name=inspector_name,
                        remark=f"equipment_ops_generate run={run_id}",
                        lines=line_inputs,
                    ),
                    current_user=current_user,
                )
                if (
                    int(getattr(header, "reviewer_user_id", 0) or 0) != int(approver_id)
                    or (getattr(header, "reviewer_user_name", None) or "") != approver_name
                ):
                    header.reviewer_user_id = approver_id
                    header.reviewer_user_name = approver_name
                    await header.save()
                if req.auto_approve_spot_check:
                    try:
                        header = await spot_svc.approve(
                            tenant_id,
                            int(header.id),
                            current_user=approver_user or current_user,
                        )
                    except Exception as approve_exc:
                        notes.append(
                            f"点检单 {header.document_no} 自动审核失败: {approve_exc}"
                        )
                created.append(
                    {
                        "doc_type": "spot_check",
                        "doc_id": int(header.id),
                        "doc_code": header.document_no,
                        "equipment_id": int(equipment.id),
                        "equipment_code": equipment.code,
                        "scheme_id": scheme_id,
                        "plan_id": int(sc_plan.id),
                        "plan_no": sc_plan.plan_no,
                        "check_date": str(check_date),
                        "status": header.status,
                    }
                )
            except Exception as exc:
                logger.info("spot_check generate fail: {}", exc)
                errors.append(
                    f"计划 {sc_plan.plan_no} 设备 {equipment.code}: {exc}"
                )

        for job in plan["maint_jobs"]:
            equipment = job["equipment"]
            mp = job["plan"]
            issued = job["issued_at"]
            try:
                execution = await MaintenanceExecutionService.create_maintenance_execution(
                    tenant_id,
                    MaintenanceExecutionCreate(
                        equipment_uuid=str(equipment.uuid),
                        maintenance_plan_uuid=str(mp.uuid),
                        execution_date=issued,
                        executor_id=(
                            getattr(mp, "responsible_person_id", None) or operator_id
                        ),
                        executor_name=(
                            getattr(mp, "responsible_person_name", None) or op_name
                        ),
                        execution_content=f"造数执行 {mp.plan_name}",
                        execution_result="正常",
                        status="已确认",
                        remark=f"equipment_ops_generate run={run_id}",
                    ),
                    created_by=operator_id,
                )
                created.append(
                    {
                        "doc_type": "maintenance_execution",
                        "doc_id": int(execution.id),
                        "doc_code": execution.execution_no,
                        "equipment_id": int(equipment.id),
                        "equipment_code": equipment.code,
                        "plan_id": int(mp.id),
                        "plan_no": mp.plan_no,
                        "status": execution.status,
                    }
                )
            except Exception as exc:
                logger.info("maintenance generate fail: {}", exc)
                errors.append(f"计划 {mp.plan_no} 设备 {equipment.code}: {exc}")

        return {
            "success": len(errors) == 0,
            "run_id": run_id,
            "created": created,
            "created_count": len(created),
            "errors": errors,
            "notes": notes,
            "preview": {
                "equipment_count": plan["equipment_count"],
                "spot_check_docs": plan["spot_check_docs"],
                "maintenance_docs": plan["maintenance_docs"],
            },
        }

    async def _load_equipments_by_items(
        self, tenant_id: int, items: list[dict[str, Any]]
    ) -> list[Any]:
        from apps.kuaizhizao.models.equipment import Equipment

        ids: list[int] = []
        uuids: list[str] = []
        for it in items:
            try:
                iid = int(it.get("id") or 0)
            except (TypeError, ValueError):
                iid = 0
            uuid_s = str(it.get("uuid") or "").strip()
            if iid > 0:
                ids.append(iid)
            elif uuid_s:
                uuids.append(uuid_s)
        if not ids and not uuids:
            return []
        q = Equipment.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True)
        if ids and uuids:
            from tortoise.expressions import Q

            rows = await q.filter(Q(id__in=ids) | Q(uuid__in=uuids)).all()
        elif ids:
            rows = await q.filter(id__in=ids).all()
        else:
            rows = await q.filter(uuid__in=uuids).all()
        by_id = {int(e.id): e for e in rows}
        by_uuid = {str(e.uuid): e for e in rows}
        ordered: list[Any] = []
        seen: set[int] = set()
        for it in items:
            try:
                iid = int(it.get("id") or 0)
            except (TypeError, ValueError):
                iid = 0
            uuid_s = str(it.get("uuid") or "").strip()
            e = by_id.get(iid) if iid else None
            if e is None and uuid_s:
                e = by_uuid.get(uuid_s)
            if e is None:
                continue
            eid = int(e.id)
            if eid in seen:
                continue
            seen.add(eid)
            ordered.append(e)
        return ordered

    async def _build_plan(
        self, tenant_id: int, req: EquipmentOpsGenerateRequest
    ) -> dict[str, Any]:
        from apps.kuaizhizao.models.equipment_spot_check_plan import EquipmentSpotCheckPlan
        from apps.kuaizhizao.models.maintenance_plan import MaintenancePlan
        from apps.kuaizhizao.services.equipment_ops_service import _normalize_capture_mode
        from apps.kuaizhizao.services.equipment_spot_check_plan_service import plan_occurrences

        if not req.spot_check_plan_ids and not req.maintenance_plan_ids:
            raise ValidationError("请至少选择一个点检计划或保养计划")
        selected_eq = set(req.equipment_ids)
        if not selected_eq:
            raise ValidationError("请选择计划内设备（可全选或多选）")

        start, end = req.resolved_window()
        start_d = to_site_date(start)
        end_d = to_site_date(end)
        notes: list[str] = []
        spot_jobs: list[dict[str, Any]] = []
        maint_jobs: list[dict[str, Any]] = []
        equipment_ids: set[int] = set()
        bound_eq_ids: set[int] = set()

        if req.spot_check_plan_ids:
            plans = await EquipmentSpotCheckPlan.filter(
                tenant_id=tenant_id,
                id__in=req.spot_check_plan_ids,
                deleted_at__isnull=True,
            ).all()
            found = {int(p.id) for p in plans}
            for pid in req.spot_check_plan_ids:
                if pid not in found:
                    notes.append(f"点检计划 id={pid} 不存在或已删除")
            for sc_plan in plans:
                if sc_plan.status not in ("已发布", "执行中") or not sc_plan.scheme_snapshot:
                    notes.append(
                        f"点检计划 {sc_plan.plan_no} 状态为「{sc_plan.status}」，已跳过"
                    )
                    continue
                mode = _normalize_capture_mode(sc_plan.scheme_snapshot.get("capture_mode"))
                if mode in ("B", "C"):
                    notes.append(
                        f"点检计划 {sc_plan.plan_no}: 采集方式 {mode} 须真实照片，已跳过"
                    )
                    continue
                eq_items = _equipment_items_from_plan(sc_plan)
                equipments = await self._load_equipments_by_items(tenant_id, eq_items)
                if not equipments:
                    notes.append(f"点检计划 {sc_plan.plan_no}: 未关联可用设备")
                    continue
                for e in equipments:
                    bound_eq_ids.add(int(e.id))
                equipments = [e for e in equipments if int(e.id) in selected_eq]
                if not equipments:
                    continue
                occurrences = [
                    occurrence for occurrence in plan_occurrences(sc_plan)
                    if start <= resolve_business_datetime(occurrence["scheduled_at"]) <= end
                ]
                for equipment in equipments:
                    equipment_ids.add(int(equipment.id))
                    for occurrence in occurrences:
                        issued = resolve_business_datetime(occurrence["scheduled_at"])
                        spot_jobs.append(
                            {
                                "equipment": equipment,
                                "plan": sc_plan,
                                "issued_at": issued,
                                "period_key": occurrence["period_key"],
                            }
                        )

        if req.maintenance_plan_ids:
            plans = await MaintenancePlan.filter(
                tenant_id=tenant_id,
                id__in=req.maintenance_plan_ids,
                deleted_at__isnull=True,
            ).all()
            found = {int(p.id) for p in plans}
            for pid in req.maintenance_plan_ids:
                if pid not in found:
                    notes.append(f"保养计划 id={pid} 不存在或已删除")

            for mp in plans:
                eq_items = _equipment_items_from_plan(mp)
                if not eq_items:
                    eq_items = await _equipment_items_from_scheme_binding(
                        tenant_id,
                        scheme_id=getattr(mp, "maintenance_scheme_id", None),
                        scheme_type="maintenance",
                    )
                equipments = await self._load_equipments_by_items(tenant_id, eq_items)
                if not equipments:
                    notes.append(f"保养计划 {mp.plan_no}: 未关联可用设备")
                    continue
                for e in equipments:
                    bound_eq_ids.add(int(e.id))
                equipments = [e for e in equipments if int(e.id) in selected_eq]
                if not equipments:
                    continue
                cycle_type = str(getattr(mp, "cycle_type", "") or "").strip()
                if cycle_type in ("按时间", "by_time", "time", ""):
                    occs = _iter_time_cycle_datetimes(
                        start=start,
                        end=end,
                        cycle_value=getattr(mp, "cycle_value", None),
                        cycle_unit=getattr(mp, "cycle_unit", None),
                    )
                else:
                    # 运行时长/次数：无运行数据，按天展开并提示
                    notes.append(
                        f"保养计划 {mp.plan_no}: 周期为「{cycle_type}」，"
                        "造数按每天一次展开（无运行/次数真源）"
                    )
                    occs = [
                        _apply_work_time(
                            resolve_business_datetime(
                                datetime(d.year, d.month, d.day, 9, 0, 0)
                            ),
                            req,
                        )
                        for d in _iter_named_cycle_dates("每天", start_d, end_d)
                    ]
                if len(occs) >= MAX_OCCURRENCES_PER_TARGET:
                    notes.append(
                        f"保养计划 {mp.plan_no}: 周期展开已截断为 "
                        f"{MAX_OCCURRENCES_PER_TARGET} 次"
                    )
                for equipment in equipments:
                    equipment_ids.add(int(equipment.id))
                    for issued in occs:
                        issued_at = _apply_work_time(issued, req)
                        maint_jobs.append(
                            {
                                "equipment": equipment,
                                "plan": mp,
                                "issued_at": issued_at,
                            }
                        )

        outside = sorted(selected_eq - bound_eq_ids)
        if outside:
            raise ValidationError(
                "所选设备不在计划绑定范围内：" + ",".join(str(x) for x in outside[:20])
            )
        if not spot_jobs and not maint_jobs:
            raise ValidationError("所选计划与设备组合下无可生成单据，请检查计划状态与设备绑定")

        return {
            "equipment_count": len(equipment_ids),
            "spot_check_plan_count": len(req.spot_check_plan_ids),
            "maintenance_plan_count": len(req.maintenance_plan_ids),
            "spot_jobs": spot_jobs,
            "maint_jobs": maint_jobs,
            "spot_check_targets": len(
                {(int(j["plan"].id), int(j["equipment"].id)) for j in spot_jobs}
            ),
            "maintenance_targets": len(
                {(int(j["plan"].id), int(j["equipment"].id)) for j in maint_jobs}
            ),
            "spot_check_docs": len(spot_jobs),
            "maintenance_docs": len(maint_jobs),
            "notes": notes,
        }
