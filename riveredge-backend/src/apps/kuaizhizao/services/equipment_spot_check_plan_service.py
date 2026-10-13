"""设备点检计划服务：CRUD + 从计划生成点检单（设备取方案绑定）。"""

from __future__ import annotations

from datetime import date
from typing import Any, List, Optional

from tortoise.exceptions import IntegrityError

from apps.common.audit_actor import apply_create_audit
from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.models.equipment_ops import (
    EquipmentInspectionScheme,
    EquipmentSchemeBinding,
    EquipmentSpotCheck,
)
from apps.kuaizhizao.models.equipment_spot_check_plan import EquipmentSpotCheckPlan
from apps.kuaizhizao.schemas.equipment_ops import SpotCheckCreate
from apps.kuaizhizao.schemas.equipment_spot_check_plan import (
    EquipmentSpotCheckPlanCreate,
    EquipmentSpotCheckPlanUpdate,
    GenerateSpotChecksRequest,
)
from apps.kuaizhizao.services.equipment_ops_service import EquipmentSpotCheckService
from core.services.business.code_generation_service import CodeGenerationService
from core.utils.timezone_utils import resolve_business_datetime, to_site_date
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


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
        ).all()
        by_id = {row.id: row for row in rows}
        items: list[dict[str, Any]] = []
        seen: set[int] = set()
        for binding in bindings:
            equip = by_id.get(binding.equipment_id)
            if not equip or equip.id in seen:
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
    async def _count_bound_equipment(tenant_id: int, scheme_id: int) -> int:
        return await EquipmentSchemeBinding.filter(
            tenant_id=tenant_id,
            scheme_id=scheme_id,
            scheme_type="spot_check",
            deleted_at__isnull=True,
        ).count()

    @staticmethod
    def _apply_scheme_snapshots(
        plan: EquipmentSpotCheckPlan, scheme: EquipmentInspectionScheme
    ) -> None:
        plan.scheme_id = scheme.id
        plan.scheme_code = scheme.code
        plan.scheme_name = scheme.name
        plan.cycle_type = scheme.cycle_type

    @staticmethod
    async def serialize_plan_response(plan: EquipmentSpotCheckPlan):
        from apps.kuaizhizao.schemas.equipment_spot_check_plan import (
            EquipmentSpotCheckPlanResponse,
        )

        resp = EquipmentSpotCheckPlanResponse.model_validate(plan)
        bound = await EquipmentSpotCheckPlanService._list_bound_equipment(
            plan.tenant_id, plan.scheme_id
        )
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
        return resp

    @staticmethod
    async def create_plan(
        tenant_id: int,
        data: EquipmentSpotCheckPlanCreate,
        created_by: Optional[int] = None,
    ) -> EquipmentSpotCheckPlan:
        try:
            payload = data.model_dump(exclude_none=True)
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
            plan.equipment_items = None
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
            # 按方案绑定设备筛：先找绑定该设备的点检方案
            equipment = await Equipment.filter(
                tenant_id=tenant_id,
                uuid=equipment_uuid,
                deleted_at__isnull=True,
            ).first()
            if not equipment:
                return [], 0
            scheme_ids = await EquipmentSchemeBinding.filter(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                scheme_type="spot_check",
                deleted_at__isnull=True,
            ).values_list("scheme_id", flat=True)
            if not scheme_ids:
                return [], 0
            query = query.filter(scheme_id__in=list(scheme_ids))
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
    ) -> EquipmentSpotCheckPlan:
        plan = await EquipmentSpotCheckPlanService.get_plan_by_uuid(tenant_id, uuid)
        update_data = data.model_dump(exclude_unset=True, exclude_none=True)

        if "scheme_id" in update_data:
            scheme = await EquipmentSpotCheckPlanService._resolve_scheme(
                tenant_id, int(update_data["scheme_id"])
            )
            EquipmentSpotCheckPlanService._apply_scheme_snapshots(plan, scheme)
            update_data.pop("scheme_id")

        for key, value in update_data.items():
            setattr(plan, key, value)
        await plan.save()
        return plan

    @staticmethod
    async def delete_plan(tenant_id: int, uuid: str) -> None:
        plan = await EquipmentSpotCheckPlanService.get_plan_by_uuid(tenant_id, uuid)
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
        plan = await EquipmentSpotCheckPlanService.get_plan_by_uuid(tenant_id, uuid)
        if plan.status in ("已取消", "已完成"):
            raise ValidationError(f"计划状态为「{plan.status}」，无法生成点检单")

        await EquipmentSpotCheckPlanService._resolve_scheme(tenant_id, plan.scheme_id)
        items = await EquipmentSpotCheckPlanService._list_bound_equipment(
            tenant_id, plan.scheme_id
        )
        if not items:
            raise ValidationError(
                f"点检方案「{plan.scheme_name or plan.scheme_code or plan.scheme_id}」"
                "未绑定设备，请先在设备台账绑定点检方案"
            )

        req = data or GenerateSpotChecksRequest()
        if req.equipment_uuids:
            filter_uuids = {str(u).strip() for u in req.equipment_uuids if str(u).strip()}
            items = [it for it in items if it.get("uuid") in filter_uuids]
            if not items:
                raise ValidationError("指定设备未绑定本计划的点检方案")

        check_date = req.check_date
        if check_date is None and plan.planned_start_date is not None:
            check_date = to_site_date(plan.planned_start_date)
        if check_date is None:
            check_date = to_site_date(resolve_business_datetime())

        operator_id = current_user.id if current_user else None
        operator_name = None
        if current_user is not None:
            operator_name = (
                getattr(current_user, "full_name", None)
                or getattr(current_user, "username", None)
            )

        spot_service = EquipmentSpotCheckService()
        created: list[EquipmentSpotCheck] = []
        for item in items:
            create_data = SpotCheckCreate(
                equipment_id=int(item["id"]),
                scheme_id=plan.scheme_id,
                check_date=check_date,
                inspector_id=plan.responsible_person_id,
                inspector_name=plan.responsible_person_name,
                plan_id=plan.id,
                plan_uuid=plan.uuid,
            )
            header = await spot_service.create(
                tenant_id=tenant_id,
                data=create_data,
                operator_id=operator_id,
                operator_name=operator_name,
                current_user=current_user,
            )
            created.append(header)

        if plan.status in ("草稿", "已发布"):
            plan.status = "执行中"
            await plan.save()

        return created
