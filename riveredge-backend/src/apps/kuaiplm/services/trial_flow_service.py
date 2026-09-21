"""试流服务（R-08）"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaiplm.models.rd_project import RdProject
from apps.kuaiplm.models.trial_flow import (
    DEFAULT_STEPS_BY_TYPE,
    TRIAL_FLOW_TYPES,
    TrialFlow,
    TrialFlowMaterialLine,
    TrialFlowStepResult,
)
from apps.kuaiplm.schemas.trial_flow import (
    TrialFlowConclude,
    TrialFlowCreate,
    TrialFlowFormProfile,
    TrialFlowListItem,
    TrialFlowListResponse,
    TrialFlowMaterialLineIn,
    TrialFlowMaterialLineOut,
    TrialFlowResponse,
    TrialFlowStepFill,
    TrialFlowStepOut,
    TrialFlowUpdate,
)
from core.services.application.industry_extension_runtime_service import (
    IndustryExtensionRuntimeService,
)
from core.services.approval.approval_instance_service import ApprovalInstanceService
from core.services.approval.audit_binding_service import AuditBindingService
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

AUDIT_NODE = "trial_flow"
PROFILE_KEY = "kuaiplm.trial_flow"
ALLOWED_STATUS = {
    "draft",
    "pending",
    "approved",
    "in_progress",
    "concluded",
    "closed",
}
STEP_RESULTS = {"pass", "fail", "na"}
CONCLUSIONS = {"pass", "fail", "conditional"}


class TrialFlowService(AppBaseService[TrialFlow]):
    code_field = "trial_code"
    rule_code = "KUAI_PLM_TRIAL_FLOW_CODE"
    code_prefix = "SL"

    def __init__(self) -> None:
        super().__init__(TrialFlow)
        self.model = TrialFlow

    async def _profile(self, tenant_id: int) -> Dict[str, Any]:
        return await IndustryExtensionRuntimeService.resolve_profile(tenant_id, PROFILE_KEY)

    async def get_form_profile(self, tenant_id: int) -> TrialFlowFormProfile:
        enabled = await IndustryExtensionRuntimeService.is_industry_profile_enabled(
            tenant_id, PROFILE_KEY
        )
        profile = await self._profile(tenant_id)
        step_templates = profile.get("step_templates") or {}
        return TrialFlowFormProfile(
            industry_profile_enabled=enabled,
            field_labels=dict(profile.get("field_labels") or {}),
            header_fields=list(profile.get("header_fields") or []),
            step_templates={
                str(k): list(v or [])
                for k, v in step_templates.items()
                if isinstance(v, list)
            },
            validation_rules=list(profile.get("validation_rules") or []),
        )

    @staticmethod
    def _steps_from_profile(
        profile: Dict[str, Any], business_type: str
    ) -> List[tuple[str, str, str]]:
        templates = profile.get("step_templates") or {}
        items = templates.get(business_type) or []
        ordered: List[tuple[int, str, str, str]] = []
        for item in items:
            if not isinstance(item, dict) or not item.get("step_key"):
                continue
            ordered.append(
                (
                    int(item.get("sort") or 0),
                    str(item["step_key"]),
                    str(item.get("step_name") or item["step_key"]),
                    str(item.get("dept_code") or ""),
                )
            )
        ordered.sort(key=lambda x: x[0])
        return [(key, name, dept) for _, key, name, dept in ordered]

    async def _ensure_code(self, tenant_id: int, code: Optional[str]) -> str:
        raw = (code or "").strip()
        if raw:
            return raw
        return await self.generate_code(tenant_id, self.rule_code, prefix=self.code_prefix)

    async def _require_project(self, tenant_id: int, project_id: int) -> RdProject:
        project = await RdProject.filter(
            tenant_id=tenant_id, id=project_id, deleted_at__isnull=True
        ).first()
        if not project:
            raise ValidationError("研发项目不存在")
        return project

    async def _get_row(self, tenant_id: int, trial_id: int) -> TrialFlow:
        row = await TrialFlow.filter(
            tenant_id=tenant_id, id=trial_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError("试流单不存在")
        return row

    async def _load_lines(self, tenant_id: int, trial_id: int):
        materials = (
            await TrialFlowMaterialLine.filter(
                tenant_id=tenant_id, trial_flow_id=trial_id, deleted_at__isnull=True
            )
            .order_by("line_no", "id")
        )
        steps = (
            await TrialFlowStepResult.filter(
                tenant_id=tenant_id, trial_flow_id=trial_id, deleted_at__isnull=True
            )
            .order_by("sort_order", "id")
        )
        return materials, steps

    def _to_response(
        self,
        row: TrialFlow,
        materials: List[TrialFlowMaterialLine],
        steps: List[TrialFlowStepResult],
    ) -> TrialFlowResponse:
        data = TrialFlowResponse.model_validate(row)
        data.materials = [
            TrialFlowMaterialLineOut.model_validate(m) for m in materials
        ]
        data.steps = [TrialFlowStepOut.model_validate(s) for s in steps]
        return data

    def _compute_current_step(self, steps: List[TrialFlowStepResult]) -> Optional[str]:
        for step in sorted(steps, key=lambda s: (s.sort_order, s.id)):
            if step.status == "pending":
                return step.step_key
        return None

    async def _replace_materials(
        self,
        tenant_id: int,
        trial_id: int,
        materials: List[TrialFlowMaterialLineIn],
        user: User,
    ) -> None:
        now = resolve_business_datetime()
        await TrialFlowMaterialLine.filter(
            tenant_id=tenant_id, trial_flow_id=trial_id, deleted_at__isnull=True
        ).update(deleted_at=now)
        for idx, line in enumerate(materials, start=1):
            row = TrialFlowMaterialLine(
                tenant_id=tenant_id,
                trial_flow_id=trial_id,
                line_no=idx,
                material_id=line.material_id,
                material_code=line.material_code.strip(),
                material_name=line.material_name.strip(),
                qty=line.qty,
                unit=line.unit,
                remarks=line.remarks,
            )
            apply_create_audit(row, user)
            await row.save()

    async def _seed_steps(
        self, tenant_id: int, trial_id: int, business_type: str, user: User
    ) -> List[TrialFlowStepResult]:
        profile = await self._profile(tenant_id)
        defs = self._steps_from_profile(profile, business_type) or (
            DEFAULT_STEPS_BY_TYPE.get(business_type) or []
        )
        created: List[TrialFlowStepResult] = []
        for order, (key, name, dept) in enumerate(defs):
            step = TrialFlowStepResult(
                tenant_id=tenant_id,
                trial_flow_id=trial_id,
                step_key=key,
                step_name=name,
                dept_code=dept,
                sort_order=order,
                status="pending",
            )
            apply_create_audit(step, user)
            await step.save()
            created.append(step)
        return created

    async def create(
        self, tenant_id: int, payload: TrialFlowCreate, user: User
    ) -> TrialFlowResponse:
        bt = (payload.business_type or "").strip().lower()
        if bt not in TRIAL_FLOW_TYPES:
            raise ValidationError("非法试流业务类型")
        project = await self._require_project(tenant_id, payload.project_id)
        code = await self._ensure_code(tenant_id, payload.trial_code)
        exists = await TrialFlow.filter(
            tenant_id=tenant_id, trial_code=code, deleted_at__isnull=True
        ).exists()
        if exists:
            raise BusinessLogicError("试流单号已存在")

        row = TrialFlow(
            tenant_id=tenant_id,
            trial_code=code,
            project_id=project.id,
            project_code=project.project_code,
            project_name=project.project_name,
            business_type=bt,
            title=payload.title.strip(),
            status="draft",
            remarks=payload.remarks,
            extension_payload=payload.extension_payload,
        )
        apply_create_audit(row, user)
        await row.save()
        await self._replace_materials(tenant_id, row.id, payload.materials or [], user)
        steps = await self._seed_steps(tenant_id, row.id, bt, user)
        row.current_step_key = self._compute_current_step(steps)
        await row.save()
        materials, steps = await self._load_lines(tenant_id, row.id)
        return self._to_response(row, materials, steps)

    async def list(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        business_type: Optional[str] = None,
        project_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> TrialFlowListResponse:
        query = TrialFlow.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if project_id:
            query = query.filter(project_id=project_id)
        if status:
            if status not in ALLOWED_STATUS:
                raise ValidationError(f"非法状态: {status}")
            query = query.filter(status=status)
        if business_type:
            bt = business_type.strip().lower()
            if bt not in TRIAL_FLOW_TYPES:
                raise ValidationError("非法试流业务类型")
            query = query.filter(business_type=bt)
        if keyword:
            query = query.filter(title__icontains=keyword)
        total = await query.count()
        rows = await query.order_by("-updated_at", "-id").offset(skip).limit(limit)
        return TrialFlowListResponse(
            items=[TrialFlowListItem.model_validate(r) for r in rows],
            total=total,
        )

    async def get(self, tenant_id: int, trial_id: int) -> TrialFlowResponse:
        row = await self._get_row(tenant_id, trial_id)
        materials, steps = await self._load_lines(tenant_id, trial_id)
        return self._to_response(row, materials, steps)

    async def update(
        self, tenant_id: int, trial_id: int, payload: TrialFlowUpdate, user: User
    ) -> TrialFlowResponse:
        row = await self._get_row(tenant_id, trial_id)
        if row.status != "draft":
            raise BusinessLogicError("仅草稿可编辑")
        data = payload.model_dump(exclude_unset=True)
        materials = data.pop("materials", None)
        for key, value in data.items():
            setattr(row, key, value)
        if materials is not None:
            await self._replace_materials(tenant_id, trial_id, materials, user)
        apply_update_audit(row, user)
        await row.save()
        mats, steps = await self._load_lines(tenant_id, trial_id)
        return self._to_response(row, mats, steps)

    async def submit(
        self, tenant_id: int, trial_id: int, user: User
    ) -> TrialFlowResponse:
        row = await self._get_row(tenant_id, trial_id)
        if row.status != "draft":
            raise BusinessLogicError("仅草稿可提交")
        mats, _ = await self._load_lines(tenant_id, trial_id)
        if not mats:
            raise ValidationError("提交前须至少一行试流物料")

        row.status = "pending"
        row.submitted_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()

        approval_instance = None
        if await AuditBindingService.is_audit_enabled(tenant_id, AUDIT_NODE):
            approval_instance = await ApprovalInstanceService.start_approval_for_node(
                tenant_id=tenant_id,
                user_id=user.id,
                node_key=AUDIT_NODE,
                entity_type="trial_flow",
                entity_id=row.id,
                entity_uuid=str(row.uuid),
                title=f"试流审核 {row.trial_code}",
                content=row.title,
                business_type=row.business_type,
                send_notification=True,
            )
            if approval_instance is None:
                raise ValidationError(
                    f"审核已开启但未找到可用审批流程，请检查 {AUDIT_NODE} 绑定"
                )
        from apps.kuaiplm.services.plm_audit_flow_sync import submit_instance_auto_passed

        if submit_instance_auto_passed(approval_instance):
            return await self.approve(tenant_id, trial_id, user)
        mats, steps = await self._load_lines(tenant_id, trial_id)
        from apps.kuaiplm.services.trial_flow_reminder_service import TrialFlowReminderService

        await TrialFlowReminderService.sync_after_submit(tenant_id, row)
        return self._to_response(row, mats, steps)

    async def approve(
        self, tenant_id: int, trial_id: int, user: User
    ) -> TrialFlowResponse:
        row = await self._get_row(tenant_id, trial_id)
        if row.status != "pending":
            raise BusinessLogicError("仅待审试流可通过")
        from apps.kuaiplm.services.plm_audit_flow_sync import assert_plm_manual_approval_action

        await assert_plm_manual_approval_action(
            tenant_id,
            audit_node=AUDIT_NODE,
            entity_type="trial_flow",
            entity_id=trial_id,
            doc_label="试流",
            verb="审核",
        )
        row.status = "approved"
        row.approved_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()
        # 审核通过后进入执行填报
        row.status = "in_progress"
        _, steps = await self._load_lines(tenant_id, trial_id)
        row.current_step_key = self._compute_current_step(steps)
        apply_update_audit(row, user)
        await row.save()
        mats, steps = await self._load_lines(tenant_id, trial_id)
        from apps.kuaiplm.services.trial_flow_reminder_service import TrialFlowReminderService

        await TrialFlowReminderService.sync_after_approve(tenant_id, row)
        return self._to_response(row, mats, steps)

    async def reject(
        self, tenant_id: int, trial_id: int, user: User
    ) -> TrialFlowResponse:
        row = await self._get_row(tenant_id, trial_id)
        if row.status != "pending":
            raise BusinessLogicError("仅待审试流可驳回")
        from apps.kuaiplm.services.plm_audit_flow_sync import assert_plm_manual_approval_action

        await assert_plm_manual_approval_action(
            tenant_id,
            audit_node=AUDIT_NODE,
            entity_type="trial_flow",
            entity_id=trial_id,
            doc_label="试流",
            verb="驳回",
        )
        row.status = "draft"
        row.submitted_at = None
        apply_update_audit(row, user)
        await row.save()
        mats, steps = await self._load_lines(tenant_id, trial_id)
        from apps.kuaiplm.services.trial_flow_reminder_service import TrialFlowReminderService

        await TrialFlowReminderService.sync_after_terminal(
            tenant_id, trial_id, reason="已驳回"
        )
        return self._to_response(row, mats, steps)

    async def _validate_step_fill(
        self,
        tenant_id: int,
        row: TrialFlow,
        step: TrialFlowStepResult,
        payload: TrialFlowStepFill,
    ) -> None:
        profile = await self._profile(tenant_id)
        rules = profile.get("validation_rules") or []
        bt = (row.business_type or "").strip().lower()
        step_templates = profile.get("step_templates") or {}
        step_defs = step_templates.get(bt) or []
        step_meta = next(
            (d for d in step_defs if isinstance(d, dict) and d.get("step_key") == step.step_key),
            {},
        )
        phase = str(step_meta.get("phase") or "").strip().lower()
        if phase == "conclusion":
            return
        require_fields: set[str] = set()
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            when_bt = rule.get("when_business_type")
            if when_bt and when_bt != bt:
                continue
            when_steps = rule.get("when_step_keys")
            if when_steps and step.step_key not in when_steps:
                continue
            for field in rule.get("require") or []:
                require_fields.add(str(field))
        if bt == "complete" and not require_fields:
            require_fields = {"step_description", "defect_rate", "result"}
        if "step_description" in require_fields and not (payload.step_description or "").strip():
            raise ValidationError("请填写工序描述")
        if "defect_rate" in require_fields and payload.defect_rate is None:
            raise ValidationError("请填写不良率")
        if "result" in require_fields and not (payload.result or "").strip():
            raise ValidationError("请填写判定结果")
        if payload.defect_rate is not None:
            rate = float(payload.defect_rate)
            if rate < 0 or rate > 100:
                raise ValidationError("不良率须在 0–100 之间")

    async def fill_step(
        self,
        tenant_id: int,
        trial_id: int,
        step_key: str,
        payload: TrialFlowStepFill,
        user: User,
    ) -> TrialFlowResponse:
        row = await self._get_row(tenant_id, trial_id)
        if row.status != "in_progress":
            raise BusinessLogicError("仅执行中试流可填报工序")
        result = (payload.result or "").strip().lower()
        if result not in STEP_RESULTS:
            raise ValidationError("非法工序结果")
        step = await TrialFlowStepResult.filter(
            tenant_id=tenant_id,
            trial_flow_id=trial_id,
            step_key=step_key,
            deleted_at__isnull=True,
        ).first()
        if not step:
            raise NotFoundError("工序节点不存在")
        if row.current_step_key and step.step_key != row.current_step_key:
            raise BusinessLogicError("请按当前工序顺序填报")
        await self._validate_step_fill(tenant_id, row, step, payload)
        step.status = "done"
        step.result = result
        step.result_notes = payload.result_notes
        step.step_description = (payload.step_description or "").strip() or None
        step.defect_rate = payload.defect_rate
        step.filled_by = user.id
        step.filled_by_name = getattr(user, "name", None) or getattr(user, "username", None)
        step.filled_at = resolve_business_datetime()
        apply_update_audit(step, user)
        await step.save()

        mats, steps = await self._load_lines(tenant_id, trial_id)
        row.current_step_key = self._compute_current_step(steps)
        apply_update_audit(row, user)
        await row.save()
        from apps.kuaiplm.services.trial_flow_reminder_service import TrialFlowReminderService

        await TrialFlowReminderService.sync_after_step_advanced(tenant_id, row)
        return self._to_response(row, mats, steps)

    async def conclude(
        self,
        tenant_id: int,
        trial_id: int,
        payload: TrialFlowConclude,
        user: User,
    ) -> TrialFlowResponse:
        row = await self._get_row(tenant_id, trial_id)
        if row.status != "in_progress":
            raise BusinessLogicError("仅执行中试流可下结论")
        conclusion = (payload.conclusion or "").strip().lower()
        if conclusion not in CONCLUSIONS:
            raise ValidationError("非法结论")
        _, steps = await self._load_lines(tenant_id, trial_id)
        pending = [s for s in steps if s.status == "pending"]
        if pending:
            raise BusinessLogicError("仍有未完成工序，不能下结论")
        row.conclusion = conclusion
        row.conclusion_summary = payload.conclusion_summary
        row.status = "concluded"
        row.concluded_at = resolve_business_datetime()
        row.current_step_key = None
        apply_update_audit(row, user)
        await row.save()
        mats, steps = await self._load_lines(tenant_id, trial_id)
        from apps.kuaiplm.services.trial_flow_reminder_service import TrialFlowReminderService

        await TrialFlowReminderService.sync_after_terminal(
            tenant_id, trial_id, reason="已结论"
        )
        return self._to_response(row, mats, steps)

    async def close(
        self, tenant_id: int, trial_id: int, user: User
    ) -> TrialFlowResponse:
        row = await self._get_row(tenant_id, trial_id)
        if row.status != "concluded":
            raise BusinessLogicError("仅已结论试流可关闭存档")
        row.status = "closed"
        row.closed_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()
        mats, steps = await self._load_lines(tenant_id, trial_id)
        from apps.kuaiplm.services.trial_flow_reminder_service import TrialFlowReminderService

        await TrialFlowReminderService.sync_after_terminal(
            tenant_id, trial_id, reason="已关闭"
        )
        return self._to_response(row, mats, steps)

    async def delete(self, tenant_id: int, trial_id: int, user: User) -> None:
        row = await self._get_row(tenant_id, trial_id)
        if row.status != "draft":
            raise BusinessLogicError("仅草稿可删除")
        now = resolve_business_datetime()
        row.deleted_at = now
        apply_update_audit(row, user)
        await row.save()
        await TrialFlowMaterialLine.filter(
            tenant_id=tenant_id, trial_flow_id=trial_id, deleted_at__isnull=True
        ).update(deleted_at=now)
        await TrialFlowStepResult.filter(
            tenant_id=tenant_id, trial_flow_id=trial_id, deleted_at__isnull=True
        ).update(deleted_at=now)
