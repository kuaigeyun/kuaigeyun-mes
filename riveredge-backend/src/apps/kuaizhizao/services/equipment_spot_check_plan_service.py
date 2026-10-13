"""设备点检计划：发布时冻结方案与设备范围，按排程生成待执行任务。"""

from __future__ import annotations

from datetime import datetime, time, timedelta
from decimal import Decimal
from typing import Any, List, Optional

from tortoise.exceptions import IntegrityError
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.models.equipment_ops import (
    EquipmentInspectionScheme,
    EquipmentSchemeBinding,
    EquipmentSpotCheck,
    EquipmentSpotCheckLine,
)
from apps.kuaizhizao.models.equipment_spot_check_plan import EquipmentSpotCheckPlan
from apps.kuaizhizao.schemas.equipment_ops import INSPECTION_SCHEME_CYCLE_TYPES
from apps.kuaizhizao.schemas.equipment_spot_check_plan import (
    EquipmentSpotCheckPlanCreate,
    EquipmentSpotCheckPlanUpdate,
    GenerateSpotChecksRequest,
)
from apps.kuaizhizao.services.equipment_ops_service import EquipmentSpotCheckService, _generate_code
from core.services.business.code_generation_service import CodeGenerationService
from core.utils.timezone_utils import resolve_business_datetime, to_site_date, to_site_timezone
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


def plan_occurrences(plan: EquipmentSpotCheckPlan) -> list[dict[str, Any]]:
    """Expand the frozen plan window; each shift has its own task identity."""
    from apps.kuaizhizao.services.spot_check_reminder_service import (
        _period_end, _period_key_and_start,
    )

    if not plan.planned_start_date or not plan.planned_end_date:
        raise ValidationError("发布计划必须填写开始和结束时间")
    start = to_site_timezone(resolve_business_datetime(plan.planned_start_date))
    end = to_site_timezone(resolve_business_datetime(plan.planned_end_date))
    if end < start:
        raise ValidationError("计划结束时间不能早于开始时间")
    if (end.date() - start.date()).days > 366:
        raise ValidationError("单个点检计划的时间范围不能超过366天")
    cycle = plan.cycle_type
    if cycle not in INSPECTION_SCHEME_CYCLE_TYPES:
        raise ValidationError("请选择有效的点检周期")
    shifts = (plan.scheme_snapshot or {}).get("shifts", [])
    if cycle == "每班" and not shifts:
        raise ValidationError("每班计划必须选择班次")
    occurrences = []
    seen = set()
    day = start.date()
    while day <= end.date():
        if cycle == "每班":
            for shift in shifts:
                scheduled = datetime.combine(
                    day, time.fromisoformat(shift["start_time"]), tzinfo=start.tzinfo
                )
                due = datetime.combine(
                    day, time.fromisoformat(shift["end_time"]), tzinfo=start.tzinfo
                )
                if due <= scheduled:
                    due += timedelta(days=1)
                if start <= scheduled <= end:
                    occurrences.append({
                        "period_key": f"{day.isoformat()}:shift:{shift['id']}",
                        "scheduled_at": scheduled,
                        "due_at": min(due, end),
                        "shift_name": shift["name"],
                    })
        else:
            key, _ = _period_key_and_start(cycle, day)
            if key not in seen:
                seen.add(key)
                scheduled = max(
                    datetime.combine(day, start.timetz(), tzinfo=start.tzinfo), start
                )
                if scheduled > end:
                    break
                period_end = _period_end(cycle, day if cycle == "每天" else _period_key_and_start(cycle, day)[1])
                due = datetime.combine(
                    period_end + timedelta(days=1), time.min, tzinfo=start.tzinfo
                )
                occurrences.append({
                    "period_key": key,
                    "scheduled_at": scheduled,
                    "due_at": min(due, end),
                    "shift_name": None,
                })
        day += timedelta(days=1)
    if not occurrences:
        raise ValidationError("计划时间范围内没有可执行的点检时段")
    return occurrences


class EquipmentSpotCheckPlanService:
    @staticmethod
    async def _resolve_scheme(tenant_id: int, scheme_id: int) -> EquipmentInspectionScheme:
        scheme = await EquipmentInspectionScheme.filter(
            tenant_id=tenant_id,
            id=scheme_id,
            deleted_at__isnull=True,
        ).first()
        if not scheme:
            raise ValidationError(f"点检方案不存在: {scheme_id}")
        if not scheme.is_active:
            raise ValidationError(f"点检方案已停用: {scheme.code or scheme_id}")
        if scheme.domain != "equipment":
            raise ValidationError("设备点检计划只能选择设备点检方案")
        return scheme

    @staticmethod
    async def _list_bound_equipment(
        tenant_id: int, scheme_id: int
    ) -> List[dict[str, Any]]:
        bindings = await EquipmentSchemeBinding.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            scheme_type="spot_check",
            deleted_at__isnull=True,
        ).order_by("id").all()
        if not bindings:
            return []

        equipment_ids = [b.equipment_id for b in bindings]
        rows = await Equipment.filter(
            tenant_id=tenant_id,
            id__in=equipment_ids,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        by_id = {row.id: row for row in rows}
        items: list[dict[str, Any]] = []
        seen: set[int] = set()
        for binding in bindings:
            equip = by_id.get(binding.equipment_id)
            if not equip or equip.status == "报废" or equip.id in seen:
                continue
            seen.add(equip.id)
            items.append(
                {
                    "id": equip.id,
                    "uuid": equip.uuid,
                    "code": equip.code,
                    "name": equip.name,
                }
            )
        return items

    @staticmethod
    async def list_available_equipment(tenant_id: int) -> list[dict[str, Any]]:
        rows = await Equipment.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, is_active=True,
        ).exclude(status="报废").order_by("code", "id").all()
        return [
            {"id": row.id, "uuid": row.uuid, "code": row.code, "name": row.name}
            for row in rows
        ]

    @staticmethod
    async def _select_equipment(tenant_id: int, scheme_id: int, uuids: Optional[List[str]]) -> list[dict]:
        if uuids is None:
            # Legacy callers omit equipment; keep their bound-device default.
            items = await EquipmentSpotCheckPlanService._list_bound_equipment(tenant_id, scheme_id)
        else:
            items = await EquipmentSpotCheckPlanService.list_available_equipment(tenant_id)
            wanted = set(uuids)
            if wanted - {str(item["uuid"]) for item in items}:
                raise ValidationError("所选设备不存在、已停用或已报废")
            items = [item for item in items if str(item["uuid"]) in wanted]
        if not items:
            raise ValidationError("请选择计划设备")
        return items

    @staticmethod
    def _apply_scheme_snapshots(
        plan: EquipmentSpotCheckPlan, scheme: EquipmentInspectionScheme
    ) -> None:
        plan.scheme_id = scheme.id
        plan.scheme_code = scheme.code
        plan.scheme_name = scheme.name
        if not plan.cycle_type:
            plan.cycle_type = scheme.cycle_type

    @staticmethod
    async def serialize_plan_response(plan: EquipmentSpotCheckPlan):
        from apps.kuaizhizao.schemas.equipment_spot_check_plan import (
            EquipmentSpotCheckPlanResponse,
        )

        resp = EquipmentSpotCheckPlanResponse.model_validate(plan)
        resp.has_published_snapshot = bool(plan.scheme_snapshot)
        bound = plan.equipment_items or []
        resp.bound_equipment_count = len(bound)
        resp.equipment_items = bound
        resp.equipment_uuids = [str(item["uuid"]) for item in bound if item.get("uuid")]
        if bound:
            resp.equipment_id = bound[0]["id"]
            resp.equipment_uuid = bound[0]["uuid"]
            resp.equipment_name = (
                bound[0]["name"]
                if len(bound) == 1
                else f"{bound[0]['name']} 等{len(bound)}台"
            )
        tasks = await EquipmentSpotCheck.filter(
            tenant_id=plan.tenant_id, plan_id=plan.id, deleted_at__isnull=True,
            period_key__isnull=False,
        ).values_list("status", flat=True)
        resp.task_count = len(tasks)
        resp.expected_task_count = len(plan_occurrences(plan)) * len(bound) if plan.scheme_snapshot else 0
        resp.pending_count = sum(s in ("待执行", "已驳回") for s in tasks)
        resp.submitted_count = tasks.count("待审核")
        resp.completed_count = tasks.count("已审核")
        return resp

    @staticmethod
    async def create_plan(
        tenant_id: int,
        data: EquipmentSpotCheckPlanCreate,
        created_by: Optional[int] = None,
    ) -> EquipmentSpotCheckPlan:
        try:
            if data.status != "草稿":
                raise ValidationError("新建计划必须为草稿，请保存后发布")
            payload = data.model_dump(exclude_none=True, exclude={"equipment_uuids"})
            for field in ("planned_start_date", "planned_end_date"):
                if payload.get(field):
                    payload[field] = resolve_business_datetime(payload[field])
            scheme = await EquipmentSpotCheckPlanService._resolve_scheme(
                tenant_id, int(payload["scheme_id"])
            )

            plan_no = str(payload.get("plan_no") or "").strip()
            if not plan_no:
                try:
                    plan_no = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="equipment_spot_check_plan_code",
                        context=None,
                    )
                except Exception:
                    plan_no = f"DJJH{resolve_business_datetime().strftime('%Y%m%d%H%M%S')}"
                plan_no = str(plan_no or "").strip()
                if not plan_no:
                    plan_no = f"DJJH{resolve_business_datetime().strftime('%Y%m%d%H%M%S')}"
            payload["plan_no"] = plan_no
            data.plan_no = plan_no

            plan = EquipmentSpotCheckPlan(tenant_id=tenant_id, **payload)
            EquipmentSpotCheckPlanService._apply_scheme_snapshots(plan, scheme)
            plan.equipment_id = None
            plan.equipment_uuid = None
            plan.equipment_name = None
            plan.equipment_items = await EquipmentSpotCheckPlanService._select_equipment(
                tenant_id, scheme.id, data.equipment_uuids
            )
            actor = None
            if created_by is not None:
                actor = await User.filter(id=created_by, tenant_id=tenant_id).first()
            apply_create_audit(plan, actor)
            await plan.save()
            return plan
        except IntegrityError:
            raise ValidationError(f"点检计划编号 {data.plan_no} 已存在")

    @staticmethod
    async def get_plan_by_uuid(tenant_id: int, uuid: str) -> EquipmentSpotCheckPlan:
        plan = await EquipmentSpotCheckPlan.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True,
        ).first()
        if not plan:
            raise NotFoundError("点检计划不存在")
        return plan

    @staticmethod
    async def list_plans(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        equipment_uuid: Optional[str] = None,
        status: Optional[str] = None,
        scheme_id: Optional[int] = None,
        search: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        planned_start_date: Optional[str] = None,
        planned_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
        uuid: Optional[str] = None,
    ) -> tuple[List[EquipmentSpotCheckPlan], int]:
        query = EquipmentSpotCheckPlan.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if equipment_uuid:
            scopes = await query.values("id", "equipment_items")
            plan_ids = [
                row["id"] for row in scopes
                if any(str(item.get("uuid")) == equipment_uuid for item in row["equipment_items"] or [])
            ]
            query = query.filter(id__in=plan_ids)
        if status:
            query = query.filter(status=status)
        if scheme_id:
            query = query.filter(scheme_id=int(scheme_id))
        if uuid:
            query = query.filter(uuid=uuid.strip())

        from apps.kuaizhizao.services.equipment_list_core import (
            apply_equipment_created_date_range,
            apply_equipment_document_date_range,
            apply_equipment_keyword_filter,
            apply_equipment_updated_date_range,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        sortable = frozenset({
            "plan_no",
            "plan_name",
            "scheme_name",
            "cycle_type",
            "planned_start_date",
            "planned_end_date",
            "status",
            "created_at",
            "updated_at",
        })
        query = apply_equipment_keyword_filter(
            query,
            pick_search_keyword(keyword, search),
            ["plan_no", "plan_name", "scheme_name", "scheme_code"],
        )
        query = apply_equipment_document_date_range(
            query,
            date_field="planned_start_date",
            start_date=planned_start_date,
            end_date=planned_end_date,
        )
        query = apply_equipment_created_date_range(
            query, start_date=created_start_date, end_date=created_end_date
        )
        query = apply_equipment_updated_date_range(
            query, start_date=updated_start_date, end_date=updated_end_date
        )

        total = await query.count()
        order_clause = resolve_equipment_list_order_by(order_by, sortable, "-created_at")
        plans = await query.offset(skip).limit(limit).order_by(order_clause)
        return plans, total

    @staticmethod
    async def update_plan(
        tenant_id: int,
        uuid: str,
        data: EquipmentSpotCheckPlanUpdate,
        current_user: Optional[User] = None,
    ) -> EquipmentSpotCheckPlan:
        async with in_transaction():
            plan = await EquipmentSpotCheckPlanService._locked_plan(tenant_id, uuid)
            if plan.status != "草稿" and (plan.scheme_snapshot or plan.status not in ("已发布", "执行中")):
                raise ValidationError("仅草稿计划可编辑，已发布计划的排程与设备范围已固定")
            update_data = data.model_dump(exclude_unset=True)
            if update_data.pop("status", "草稿") != "草稿":
                raise ValidationError("请通过发布或取消操作变更计划状态")
            uuids = update_data.pop("equipment_uuids", None)
            scheme_id = update_data.pop("scheme_id", None) or plan.scheme_id
            scheme = await EquipmentSpotCheckPlanService._resolve_scheme(tenant_id, scheme_id)
            if scheme_id != plan.scheme_id or "equipment_uuids" in data.model_fields_set:
                if "equipment_uuids" not in data.model_fields_set and plan.equipment_items:
                    uuids = [str(item["uuid"]) for item in plan.equipment_items]
                plan.equipment_items = await EquipmentSpotCheckPlanService._select_equipment(
                    tenant_id, scheme_id, uuids
                )
            for key, value in update_data.items():
                if key in ("planned_start_date", "planned_end_date") and value:
                    value = resolve_business_datetime(value)
                setattr(plan, key, value)
            EquipmentSpotCheckPlanService._apply_scheme_snapshots(plan, scheme)
            plan.status = "草稿"
            apply_update_audit(plan, current_user)
            await plan.save()
            return plan

    @staticmethod
    async def _locked_plan(tenant_id: int, uuid: str) -> EquipmentSpotCheckPlan:
        plan = await EquipmentSpotCheckPlan.filter(
            tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True,
        ).select_for_update().first()
        if not plan:
            raise NotFoundError("点检计划不存在")
        return plan

    @staticmethod
    async def publish_plan(tenant_id: int, uuid: str, current_user: Optional[User] = None):
        from apps.master_data.models.shift_scheduling import Shift
        from apps.kuaizhizao.services.equipment_ops_service import (
            _assert_scheme_capture_config, _normalize_capture_mode,
        )
        from apps.kuaizhizao.schemas.equipment_ops import InspectionSchemeLineCreate

        async with in_transaction():
            plan = await EquipmentSpotCheckPlanService._locked_plan(tenant_id, uuid)
            if plan.status != "草稿" and (plan.scheme_snapshot or plan.status not in ("已发布", "执行中")):
                raise ValidationError("仅草稿计划可发布")
            scheme = await EquipmentSpotCheckPlanService._resolve_scheme(tenant_id, plan.scheme_id)
            _, lines = await EquipmentSpotCheckService.scheme_service.get_with_lines(tenant_id, scheme.id)
            mode = _normalize_capture_mode(scheme.capture_mode)
            _assert_scheme_capture_config(mode, [
                InspectionSchemeLineCreate(item_id=line.item_id, photo_required=line.photo_required)
                for line in lines
            ])
            plan.equipment_items = await EquipmentSpotCheckPlanService._select_equipment(
                tenant_id, scheme.id,
                [str(item["uuid"]) for item in plan.equipment_items] if plan.equipment_items else None,
            )
            EquipmentSpotCheckPlanService._apply_scheme_snapshots(plan, scheme)
            shifts = []
            if plan.cycle_type == "每班":
                rows = await Shift.filter(
                    tenant_id=tenant_id, id__in=plan.shift_ids or [],
                    is_active=True, deleted_at__isnull=True,
                ).all()
                if not rows or {r.id for r in rows} != set(plan.shift_ids or []):
                    raise ValidationError("请选择有效的执行班次")
                shifts = [{
                    "id": row.id, "name": row.name,
                    "start_time": row.start_time.isoformat(), "end_time": row.end_time.isoformat(),
                } for row in rows]
            plan.scheme_snapshot = {
                "capture_mode": mode,
                "reviewer_user_id": scheme.reviewer_user_id,
                "reviewer_user_name": scheme.reviewer_user_name,
                "review_overdue_hours": scheme.review_overdue_hours,
                "shifts": shifts,
                "lines": [{
                    key: str(value) if isinstance(value, Decimal) else value
                    for key, value in {
                        "item_id": line.item_id, "item_code": line.item_code,
                        "item_name": line.item_name, "requirement": line.requirement,
                        "method": line.method, "judgment_standard": line.judgment_standard,
                        "value_type": line.value_type, "unit": line.unit,
                        "numeric_min": line.numeric_min, "numeric_max": line.numeric_max,
                        "photo_required": line.photo_required,
                    }.items()
                } for line in lines],
            }
            occurrences = plan_occurrences(plan)
            if len(occurrences) * len(plan.equipment_items) > 10000:
                raise ValidationError("单个计划任务数不能超过10000，请缩小设备或时间范围")
            plan.status = "已发布"
            apply_update_audit(plan, current_user)
            await plan.save()
            return plan

    @staticmethod
    async def cancel_plan(tenant_id: int, uuid: str, current_user: Optional[User] = None):
        async with in_transaction():
            plan = await EquipmentSpotCheckPlanService._locked_plan(tenant_id, uuid)
            if plan.status in ("已完成", "已取消"):
                raise ValidationError("已完成或已取消计划不能再次取消")
            plan.status = "已取消"
            apply_update_audit(plan, current_user)
            await plan.save()
            await EquipmentSpotCheck.filter(
                tenant_id=tenant_id, plan_id=plan.id,
                status__in=["待执行", "已驳回"], deleted_at__isnull=True,
                period_key__isnull=False,
            ).update(status="已取消")
            return plan

    @staticmethod
    async def refresh_completion(tenant_id: int, plan_id: int):
        plan = await EquipmentSpotCheckPlan.filter(
            tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True,
        ).select_for_update().first()
        if not plan or not plan.scheme_snapshot or plan.status == "已取消":
            return
        statuses = await EquipmentSpotCheck.filter(
            tenant_id=tenant_id, plan_id=plan_id, deleted_at__isnull=True,
            period_key__isnull=False,
        ).values_list("status", flat=True)
        expected = len(plan_occurrences(plan)) * len(plan.equipment_items or [])
        plan.status = "已完成" if len(statuses) == expected and all(s == "已审核" for s in statuses) else "执行中"
        await plan.save(update_fields=["status", "updated_at"])

    @staticmethod
    async def delete_plan(tenant_id: int, uuid: str) -> None:
        async with in_transaction():
            plan = await EquipmentSpotCheckPlanService._locked_plan(tenant_id, uuid)
            if plan.status != "草稿" or await EquipmentSpotCheck.filter(
                tenant_id=tenant_id, plan_id=plan.id, deleted_at__isnull=True,
            ).exists():
                raise ValidationError("仅无执行记录的草稿计划可删除")
            plan.deleted_at = resolve_business_datetime()
            await plan.save()

    @staticmethod
    async def generate_spot_checks(
        tenant_id: int,
        uuid: str,
        data: Optional[GenerateSpotChecksRequest] = None,
        *,
        current_user: Optional[User] = None,
    ) -> list[EquipmentSpotCheck]:
        async with in_transaction():
            plan = await EquipmentSpotCheckPlanService._locked_plan(tenant_id, uuid)
            if plan.status not in ("已发布", "执行中") or not plan.scheme_snapshot:
                raise ValidationError("请先发布计划，再生成待执行任务")
            items = plan.equipment_items or []
            req = data or GenerateSpotChecksRequest()
            if req.equipment_uuids is not None:
                wanted = set(req.equipment_uuids)
                if wanted - {str(item["uuid"]) for item in items}:
                    raise ValidationError("指定设备不在已发布计划范围内")
                items = [item for item in items if str(item["uuid"]) in wanted]
            occurrences = plan_occurrences(plan)
            if req.check_date:
                occurrences = [o for o in occurrences if to_site_date(o["scheduled_at"]) == req.check_date]
                if not occurrences:
                    raise ValidationError("指定日期不在计划执行时段内")
            existing = set(await EquipmentSpotCheck.filter(
                tenant_id=tenant_id, plan_id=plan.id, deleted_at__isnull=True,
            ).values_list("equipment_id", "period_key"))
            created = []
            snapshot = plan.scheme_snapshot
            for item in items:
                for occurrence in occurrences:
                    if (item["id"], occurrence["period_key"]) in existing:
                        continue
                    header = EquipmentSpotCheck(
                        tenant_id=tenant_id,
                        document_no=await _generate_code(tenant_id, "equipment_spot_check_code", "DJ"),
                        equipment_id=item["id"], equipment_uuid=item["uuid"],
                        equipment_code=item["code"], equipment_name=item["name"],
                        scheme_id=plan.scheme_id, plan_id=plan.id, plan_uuid=plan.uuid,
                        check_date=to_site_date(occurrence["scheduled_at"]),
                        capture_mode=snapshot["capture_mode"],
                        inspector_id=plan.responsible_person_id,
                        inspector_name=plan.responsible_person_name,
                        reviewer_user_id=snapshot["reviewer_user_id"],
                        reviewer_user_name=snapshot["reviewer_user_name"],
                        status="待执行", **occurrence,
                    )
                    apply_create_audit(header, current_user)
                    await header.save()
                    for idx, line in enumerate(snapshot["lines"] if snapshot["capture_mode"] != "B" else []):
                        await EquipmentSpotCheckLine.create(
                            tenant_id=tenant_id, spot_check_id=header.id,
                            line_no=idx + 1, is_pass=None, **line,
                        )
                    created.append(header)
            if created:
                plan.status = "执行中"
                apply_update_audit(plan, current_user)
                await plan.save()
            return created
