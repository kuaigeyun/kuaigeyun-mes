"""
质量巡检服务

无强制来源建单；可选上下文（车间/产线/工位/工序/工单）；方案类型固定 patrol。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.quality_patrol import QualityPatrol
from apps.kuaizhizao.schemas.quality_patrol import (
    QualityPatrolConduct,
    QualityPatrolCreate,
    QualityPatrolResponse,
    QualityPatrolUpdate,
)
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_quality_inspection_capabilities_on_response,
    enrich_quality_inspection_list_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.quality_inspection_record import (
    assert_quality_inspection_capability,
)
from apps.kuaizhizao.services.inspection_policy_service import get_quality_effective_config
from core.services.approval.audit_record_enricher import enrich_items_payload
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError


class QualityPatrolService(AppBaseService[QualityPatrol]):
    def __init__(self) -> None:
        super().__init__(QualityPatrol)

    async def _allocate_code(self, tenant_id: int) -> str:
        today = today_site_str()
        return await self.generate_code(tenant_id, "QUALITY_PATROL_CODE", prefix=f"PAT{today}")

    async def _ensure_module_enabled(self, tenant_id: int) -> None:
        cfg = await get_quality_effective_config(tenant_id)
        if not cfg["module_enabled"].get("patrol"):
            raise ValidationError("组织未启用质量巡检")

    def _to_response(self, row: QualityPatrol) -> QualityPatrolResponse:
        return enrich_quality_inspection_capabilities_on_response(
            row,
            QualityPatrolResponse.model_validate(row),
        )

    async def _load_patrol_template(
        self,
        tenant_id: int,
        material_id: int,
        explicit_plan_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """按 plan_type=patrol 解析方案快照（不走物料分场景闸门）。"""
        from apps.kuaizhizao.models.inspection_plan import InspectionPlan, InspectionPlanStep
        from apps.kuaizhizao.models.quality_standard import QualityStandard
        from apps.kuaizhizao.services.inspection_step_spec import plan_step_to_snapshot_item

        plan = None
        if explicit_plan_id:
            plan = await InspectionPlan.filter(
                tenant_id=tenant_id,
                id=int(explicit_plan_id),
                deleted_at__isnull=True,
                is_active=True,
            ).first()
            if not plan:
                raise BusinessLogicError("质检方案不存在或未启用")
            if str(plan.plan_type) != "patrol":
                raise BusinessLogicError("仅可套用质量巡检类型的质检方案")
        if not plan:
            plan = await InspectionPlan.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                plan_type="patrol",
                deleted_at__isnull=True,
                is_active=True,
            ).order_by("-created_at").first()
        if not plan:
            plan = await InspectionPlan.filter(
                tenant_id=tenant_id,
                material_id__isnull=True,
                plan_type="patrol",
                deleted_at__isnull=True,
                is_active=True,
            ).order_by("-created_at").first()
        if not plan:
            return {}

        steps = await InspectionPlanStep.filter(plan_id=plan.id).order_by("sequence").all()
        items: List[Dict[str, Any]] = []
        for step in steps:
            item: Dict[str, Any] = plan_step_to_snapshot_item(step)
            if step.quality_standard_id:
                std = await QualityStandard.get_or_none(
                    tenant_id=tenant_id, id=step.quality_standard_id, deleted_at__isnull=True
                )
                if std:
                    item["standard"] = {
                        "standard_code": std.standard_code,
                        "inspection_items": std.inspection_items,
                        "acceptance_criteria": std.acceptance_criteria,
                    }
            items.append(item)
        return {
            "inspection_standard": f"{plan.plan_name} ({plan.plan_code})",
            "other_checks": {
                "plan_id": plan.id,
                "plan_code": plan.plan_code,
                "plan_name": plan.plan_name,
                "plan_version": plan.version,
                "items": items,
            },
        }

    async def create(
        self, tenant_id: int, user_id: int, payload: QualityPatrolCreate
    ) -> QualityPatrolResponse:
        from apps.kuaizhizao.services.quality_service import (
            _ensure_inspection_material_unit,
            _quality_inspection_initial_review_fields,
        )

        await self._ensure_module_enabled(tenant_id)
        inspection_code = payload.inspection_code or await self._allocate_code(tenant_id)
        create_fields = payload.model_dump(exclude={"inspection_code", "inspection_plan_id"})
        create_fields.update(
            await _quality_inspection_initial_review_fields(tenant_id, "quality_patrol")
        )
        await _ensure_inspection_material_unit(tenant_id, create_fields)
        template = await self._load_patrol_template(
            tenant_id,
            int(create_fields["material_id"]),
            explicit_plan_id=payload.inspection_plan_id,
        )
        if template.get("inspection_standard") is not None:
            create_fields["inspection_standard"] = template["inspection_standard"]
        if template.get("other_checks") is not None:
            create_fields["other_checks"] = template["other_checks"]
        user_info = await self.get_user_info(user_id)
        create_fields["created_by"] = user_id
        create_fields["created_by_name"] = user_info["name"]
        create_fields["updated_by"] = user_id
        create_fields["updated_by_name"] = user_info["name"]
        row = await QualityPatrol.create(
            tenant_id=tenant_id,
            inspection_code=inspection_code,
            status="待检验",
            **create_fields,
        )
        return self._to_response(row)

    async def get_by_id(self, tenant_id: int, inspection_id: int) -> QualityPatrolResponse:
        row = await QualityPatrol.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("质量巡检单不存在")
        return self._to_response(row)

    async def list(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        inspection_start_date: Optional[str] = None,
        inspection_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.quality_service import (
            _apply_quality_inspection_list_filters,
            _resolve_quality_list_order_by,
        )

        query = QualityPatrol.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        query = _apply_quality_inspection_list_filters(
            query,
            {
                "keyword": keyword,
                "inspection_start_date": inspection_start_date,
                "inspection_end_date": inspection_end_date,
                "created_start_date": created_start_date,
                "created_end_date": created_end_date,
            },
            keyword_fields=[
                "inspection_code",
                "material_code",
                "material_name",
                "workshop_name",
                "work_order_code",
                "batch_number",
            ],
        )
        total = await query.count()
        order_clause = _resolve_quality_list_order_by(
            order_by,
            {
                "created_at",
                "inspection_code",
                "inspection_time",
                "status",
                "quality_status",
                "material_code",
            },
            "-created_at",
        )
        rows = await query.order_by(order_clause).offset(skip).limit(limit)
        responses = enrich_quality_inspection_list_capabilities(
            list(rows),
            [QualityPatrolResponse.model_validate(row) for row in rows],
        )
        payload = {
            "data": responses,
            "items": responses,
            "total": total,
            "success": True,
        }
        return await enrich_items_payload(tenant_id, "quality_patrol", payload)

    async def update(
        self,
        tenant_id: int,
        inspection_id: int,
        user_id: int,
        payload: QualityPatrolUpdate,
    ) -> QualityPatrolResponse:
        row = await QualityPatrol.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("质量巡检单不存在")
        assert_quality_inspection_capability(row, "update")
        data = payload.model_dump(exclude_unset=True)
        if not data:
            return self._to_response(row)
        user_info = await self.get_user_info(user_id)
        data["updated_by"] = user_id
        data["updated_by_name"] = user_info["name"]
        await QualityPatrol.filter(id=inspection_id).update(**data)
        await row.refresh_from_db()
        return self._to_response(row)

    async def delete(self, tenant_id: int, inspection_id: int, user_id: int) -> None:
        row = await QualityPatrol.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("质量巡检单不存在")
        assert_quality_inspection_capability(row, "delete")
        user_info = await self.get_user_info(user_id)
        await QualityPatrol.filter(id=inspection_id).update(
            deleted_at=resolve_business_datetime(),
            updated_by=user_id,
            updated_by_name=user_info["name"],
        )

    async def conduct(
        self,
        tenant_id: int,
        inspection_id: int,
        user_id: int,
        payload: QualityPatrolConduct,
    ) -> QualityPatrolResponse:
        from apps.kuaizhizao.services.inspection_quantity_utils import assert_inspection_quantities_balanced
        from apps.kuaizhizao.services.quality_service import (
            _apply_template_conduct_to_payload,
            _assert_unqualified_qty_when_steps_fail,
            _maybe_create_quality_exception_from_inspection,
            _quality_inspection_conduct_finalize_fields,
            _resolve_conduct_inspector_id,
            _start_quality_inspection_approval_after_conduct,
        )
        from infra.services.business_config_service import BusinessConfigService

        row = await QualityPatrol.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("质量巡检单不存在")
        assert_quality_inspection_capability(row, "conduct")

        user_info = await self.get_user_info(user_id)
        conduct_data = payload.model_dump(exclude_unset=True)
        quantity_decimal_places = await BusinessConfigService().get_quantity_decimal_places(tenant_id)
        qualified_quantity, unqualified_quantity = assert_inspection_quantities_balanced(
            payload.qualified_quantity,
            payload.unqualified_quantity,
            row.inspection_quantity,
            decimal_places=quantity_decimal_places,
        )
        _assert_unqualified_qty_when_steps_fail(
            row, "other_checks", conduct_data, unqualified_quantity
        )
        inspector_id = await _resolve_conduct_inspector_id(tenant_id, conduct_data, user_id)
        inspector_info = await self.get_user_info(inspector_id) if inspector_id != user_id else user_info
        conduct_extra = _apply_template_conduct_to_payload(row, "other_checks", conduct_data)

        row.inspection_result = payload.inspection_result
        row.quality_status = payload.quality_status
        row.qualified_quantity = qualified_quantity
        row.unqualified_quantity = unqualified_quantity
        row.notes = payload.notes
        row.nonconformance_reason = payload.nonconformance_reason
        row.disposition = payload.disposition
        row.corrective_action = payload.corrective_action
        if conduct_extra.get("other_checks") is not None:
            row.other_checks = conduct_extra["other_checks"]
        if conduct_extra.get("attachments") is not None:
            row.attachments = conduct_extra["attachments"]
        elif payload.attachments is not None:
            row.attachments = payload.attachments

        finalize_fields = await _quality_inspection_conduct_finalize_fields(
            tenant_id,
            "quality_patrol",
            quality_status=payload.quality_status,
            inspected_by=inspector_id,
            inspector_name=inspector_info["name"],
        )
        row.status = finalize_fields.get("status", "已检验")
        if finalize_fields.get("review_status") is not None:
            row.review_status = finalize_fields["review_status"]
        if finalize_fields.get("reviewer_id") is not None:
            row.reviewer_id = finalize_fields["reviewer_id"]
            row.reviewer_name = finalize_fields["reviewer_name"]
            row.review_time = finalize_fields["review_time"]
        row.inspector_id = inspector_id
        row.inspector_name = inspector_info["name"]
        row.inspection_time = resolve_business_datetime()
        row.updated_by = user_id
        row.updated_by_name = user_info["name"]
        await row.save()

        approval_instance = await _start_quality_inspection_approval_after_conduct(
            tenant_id=tenant_id,
            user_id=user_id,
            stage_code="quality_patrol",
            inspection=row,
            doc_label="质量巡检",
        )

        if row.quality_status == "不合格" or payload.inspection_result == "不合格":
            await _maybe_create_quality_exception_from_inspection(
                tenant_id=tenant_id,
                source_type="quality_patrol",
                source_id=inspection_id,
                inspected_by=user_id,
                problem_description=payload.notes or f"质量巡检不合格：{row.inspection_code}",
            )
        if getattr(approval_instance, "status", None) == "approved":
            return await self.approve(
                tenant_id, inspection_id, user_id, approve=True, is_auto_approve=True
            )
        return self._to_response(row)

    async def approve(
        self,
        tenant_id: int,
        inspection_id: int,
        user_id: int,
        approve: bool,
        *,
        is_auto_approve: bool = False,
        remarks: Optional[str] = None,
    ) -> QualityPatrolResponse:
        from apps.kuaizhizao.services.quality_service import (
            _assert_quality_inspection_pending_approval,
        )

        row = await QualityPatrol.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("质量巡检单不存在")
        if is_auto_approve and str(getattr(row, "status", "") or "").strip() == "已审核":
            return self._to_response(row)
        assert_quality_inspection_capability(row, "approve" if approve else "reject")
        await _assert_quality_inspection_pending_approval(
            tenant_id=tenant_id,
            stage_code="quality_patrol",
            inspection_id=inspection_id,
            doc_label="质量巡检",
            verb="审核" if approve else "驳回",
            is_auto_approve=is_auto_approve,
        )
        user_info = await self.get_user_info(user_id)
        row.review_status = "已审核" if approve else "已驳回"
        row.status = "已审核" if approve else "已驳回"
        row.reviewer_id = user_id
        row.reviewer_name = user_info["name"]
        row.review_time = resolve_business_datetime()
        row.review_remarks = remarks
        row.updated_by = user_id
        row.updated_by_name = user_info["name"]
        await row.save()
        return self._to_response(row)

    async def apply_plan(
        self, tenant_id: int, inspection_id: int, user_id: int, plan_id: int
    ) -> QualityPatrolResponse:
        row = await QualityPatrol.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("质量巡检单不存在")
        assert_quality_inspection_capability(row, "apply_plan")
        template = await self._load_patrol_template(
            tenant_id, int(row.material_id), explicit_plan_id=int(plan_id)
        )
        if not template:
            raise BusinessLogicError("质检方案无效或与质量巡检类型不匹配")
        user_info = await self.get_user_info(user_id)
        if template.get("inspection_standard") is not None:
            row.inspection_standard = template["inspection_standard"]
        if template.get("other_checks") is not None:
            row.other_checks = template["other_checks"]
        row.updated_by = user_id
        row.updated_by_name = user_info["name"]
        await row.save()
        return self._to_response(row)

    async def revoke_approval(
        self, tenant_id: int, inspection_id: int, user_id: int
    ) -> QualityPatrolResponse:
        """撤销质量巡检审核（已审核 → 已检验）。"""
        from apps.kuaizhizao.services.quality_service import _is_quality_audit_required
        from core.services.approval.audit_transition import resolve_revoke_to_draft_landing_phase

        row = await QualityPatrol.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("质量巡检单不存在")
        assert_quality_inspection_capability(row, "revoke_approval")
        audit_required = await _is_quality_audit_required(tenant_id, "quality_patrol")
        _ = resolve_revoke_to_draft_landing_phase(manual_audit_enabled=audit_required)
        user_info = await self.get_user_info(user_id)
        await QualityPatrol.filter(id=inspection_id, tenant_id=tenant_id).update(
            status="已检验",
            review_status="",
            reviewer_id=None,
            reviewer_name=None,
            review_time=None,
            review_remarks=None,
            updated_by=user_id,
            updated_by_name=user_info["name"],
        )
        await row.refresh_from_db()
        return self._to_response(row)

    async def revoke_conduct(
        self, tenant_id: int, inspection_id: int, user_id: int
    ) -> QualityPatrolResponse:
        from apps.kuaizhizao.services.quality_inspection_lifecycle import (
            assert_revoke_conduct_no_downstream,
            build_quality_inspection_revoke_conduct_fields,
        )

        row = await QualityPatrol.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("质量巡检单不存在")
        assert_quality_inspection_capability(row, "revoke_conduct")
        await assert_revoke_conduct_no_downstream(
            tenant_id,
            entity_type="quality_patrol",
            source_id=inspection_id,
        )
        user_info = await self.get_user_info(user_id)
        await QualityPatrol.filter(id=inspection_id, tenant_id=tenant_id).update(
            **build_quality_inspection_revoke_conduct_fields(
                entity_type="quality_patrol",
                updated_by=user_id,
                updated_by_name=user_info["name"],
                inspection=row,
            )
        )
        await row.refresh_from_db()
        return self._to_response(row)
