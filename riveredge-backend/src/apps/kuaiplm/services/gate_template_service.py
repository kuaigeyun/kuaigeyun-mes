"""
阶段门模板服务

Author: RiverEdge Team
Date: 2026-07-07
"""

import re
import uuid
from datetime import datetime
from typing import List, Optional

from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaiplm.constants.rd_project import GateMilestoneRole, RdProjectType
from apps.kuaiplm.models import (
    RdGateTemplate,
    RdGateTemplateDeliverable,
    RdGateTemplateStage,
    RdGateTemplateTask,
    RdProject,
)
from apps.kuaiplm.schemas.gate_template import (
    GateTemplateCreate,
    GateTemplateDetailResponse,
    GateTemplateStageResponse,
    GateTemplateStagesSave,
    GateTemplateSummaryResponse,
    GateTemplateUpdate,
)
from apps.kuaiplm.utils.gate_template_seed import ensure_system_gate_templates
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime


def _slugify_gate_key(name: str) -> str:
    slug = re.sub(r"[^\w]+", "_", name.strip().lower(), flags=re.UNICODE)
    slug = slug.strip("_")[:30]
    return slug or f"stage_{uuid.uuid4().hex[:6]}"


class RdGateTemplateService(AppBaseService[RdGateTemplate]):
    def __init__(self):
        super().__init__(RdGateTemplate)

    async def _get_template_or_404(self, tenant_id: int, template_id: int) -> RdGateTemplate:
        row = await RdGateTemplate.get_or_none(
            tenant_id=tenant_id, id=template_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"阶段门模板不存在: {template_id}")
        return row

    async def _build_detail(self, tenant_id: int, template: RdGateTemplate) -> GateTemplateDetailResponse:
        stages = await RdGateTemplateStage.filter(
            tenant_id=tenant_id, template_id=template.id
        ).order_by("sort_order", "id").all()
        stage_ids = [s.id for s in stages]
        deliverables = await RdGateTemplateDeliverable.filter(
            tenant_id=tenant_id, stage_id__in=stage_ids
        ).order_by("sort_order", "id").all() if stage_ids else []
        deliv_by_stage = {}
        for d in deliverables:
            deliv_by_stage.setdefault(d.stage_id, []).append(d)
        tasks = await RdGateTemplateTask.filter(
            tenant_id=tenant_id, stage_id__in=stage_ids
        ).order_by("sort_order", "id").all() if stage_ids else []
        tasks_by_stage = {}
        for t in tasks:
            tasks_by_stage.setdefault(t.stage_id, []).append(t)

        stage_responses: List[GateTemplateStageResponse] = []
        for stage in stages:
            stage_responses.append(GateTemplateStageResponse.model_validate({
                **{k: getattr(stage, k) for k in stage._meta.fields_map if hasattr(stage, k)},
                "deliverables": deliv_by_stage.get(stage.id, []),
                "tasks": tasks_by_stage.get(stage.id, []),
            }))

        return GateTemplateDetailResponse.model_validate({
            **{k: getattr(template, k) for k in template._meta.fields_map if hasattr(template, k)},
            "stage_count": len(stages),
            "stages": stage_responses,
        })

    async def list_templates(
        self,
        tenant_id: int,
        project_type: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[GateTemplateSummaryResponse]:
        await ensure_system_gate_templates(tenant_id)
        qs = RdGateTemplate.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if project_type:
            qs = qs.filter(project_type=project_type)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        rows = await qs.order_by("-is_default", "template_name", "id").all()

        template_ids = [r.id for r in rows]
        stage_counts = {}
        if template_ids:
            stages = await RdGateTemplateStage.filter(
                tenant_id=tenant_id, template_id__in=template_ids
            ).all()
            for s in stages:
                stage_counts[s.template_id] = stage_counts.get(s.template_id, 0) + 1

        return [
            GateTemplateSummaryResponse.model_validate({
                **{k: getattr(r, k) for k in r._meta.fields_map if hasattr(r, k)},
                "stage_count": stage_counts.get(r.id, 0),
            })
            for r in rows
        ]

    async def get_template(self, tenant_id: int, template_id: int) -> GateTemplateDetailResponse:
        template = await self._get_template_or_404(tenant_id, template_id)
        return await self._build_detail(tenant_id, template)

    async def _copy_stages_from_template(
        self,
        tenant_id: int,
        source_template_id: int,
        target_template_id: int,
    ) -> None:
        stages = await RdGateTemplateStage.filter(
            tenant_id=tenant_id, template_id=source_template_id
        ).order_by("sort_order", "id").all()
        for stage in stages:
            new_stage = await RdGateTemplateStage.create(
                tenant_id=tenant_id,
                template_id=target_template_id,
                gate_key=stage.gate_key,
                gate_name=stage.gate_name,
                sort_order=stage.sort_order,
                milestone_role=stage.milestone_role,
            )
            deliverables = await RdGateTemplateDeliverable.filter(
                tenant_id=tenant_id, stage_id=stage.id
            ).order_by("sort_order", "id").all()
            for d in deliverables:
                await RdGateTemplateDeliverable.create(
                    tenant_id=tenant_id,
                    stage_id=new_stage.id,
                    name=d.name,
                    deliverable_type=d.deliverable_type,
                    sort_order=d.sort_order,
                )
            old_tasks = await RdGateTemplateTask.filter(
                tenant_id=tenant_id, stage_id=stage.id
            ).order_by("sort_order", "id").all()
            id_map: dict[int, int] = {}
            for t in old_tasks:
                if t.parent_template_task_id:
                    continue
                created = await RdGateTemplateTask.create(
                    tenant_id=tenant_id,
                    stage_id=new_stage.id,
                    task_name=t.task_name,
                    sort_order=t.sort_order,
                    default_owner_role=t.default_owner_role,
                )
                id_map[t.id] = created.id
            for t in old_tasks:
                if not t.parent_template_task_id:
                    continue
                parent_id = id_map.get(t.parent_template_task_id)
                await RdGateTemplateTask.create(
                    tenant_id=tenant_id,
                    stage_id=new_stage.id,
                    parent_template_task_id=parent_id,
                    task_name=t.task_name,
                    sort_order=t.sort_order,
                    default_owner_role=t.default_owner_role,
                )

    async def create_template(
        self, tenant_id: int, data: GateTemplateCreate, created_by: int
    ) -> GateTemplateDetailResponse:
        if data.project_type != RdProjectType.RD.value:
            raise BusinessLogicError("阶段门模板仅支持研发项目类型")

        await ensure_system_gate_templates(tenant_id, created_by=created_by)

        template_code = (data.template_code or _slugify_gate_key(data.template_name)).lower()
        existing = await RdGateTemplate.get_or_none(
            tenant_id=tenant_id,
            project_type=data.project_type,
            template_code=template_code,
            deleted_at__isnull=True,
        )
        if existing:
            raise BusinessLogicError(f"模板编码已存在: {template_code}")

        async with in_transaction():
            user = await User.filter(id=created_by).first()
            template_payload = {
                "tenant_id": tenant_id,
                "project_type": data.project_type,
                "template_code": template_code,
                "template_name": data.template_name,
                "is_default": False,
                "is_active": True,
                "notes": data.notes,
            }
            apply_create_audit(template_payload, user)
            template = await RdGateTemplate.create(**template_payload)
            if data.copy_from_id:
                source = await self._get_template_or_404(tenant_id, data.copy_from_id)
                if source.project_type != data.project_type:
                    raise BusinessLogicError("复制来源模板项目类型不一致")
                await self._copy_stages_from_template(tenant_id, source.id, template.id)

        return await self._build_detail(tenant_id, template)

    async def update_template(
        self, tenant_id: int, template_id: int, data: GateTemplateUpdate, updated_by: int
    ) -> GateTemplateDetailResponse:
        template = await self._get_template_or_404(tenant_id, template_id)
        if data.template_name is not None:
            template.template_name = data.template_name
        if data.notes is not None:
            template.notes = data.notes
        if data.is_active is not None:
            if template.is_default and not data.is_active:
                raise BusinessLogicError("默认模板不可停用，请先切换默认模板")
            template.is_active = data.is_active
        user = await User.filter(id=updated_by).first()
        apply_update_audit(template, user)
        await template.save()
        return await self._build_detail(tenant_id, template)

    def _validate_stages_payload(self, stages) -> None:
        if not stages:
            raise BusinessLogicError("模板至少需要一个阶段")
        keys = [s.gate_key.strip() for s in stages]
        if len(keys) != len(set(keys)):
            raise BusinessLogicError("同一模板内阶段标识 gate_key 不可重复")
        spawn_count = sum(
            1 for s in stages if s.milestone_role == GateMilestoneRole.SPAWN_DELIVERY.value
        )
        if spawn_count > 0:
            raise BusinessLogicError("交付项目已迁移至快制造，阶段模板不再支持下推交付里程碑")

    async def save_stages(
        self,
        tenant_id: int,
        template_id: int,
        data: GateTemplateStagesSave,
        updated_by: int,
    ) -> GateTemplateDetailResponse:
        template = await self._get_template_or_404(tenant_id, template_id)
        self._validate_stages_payload(data.stages)

        async with in_transaction():
            old_stages = await RdGateTemplateStage.filter(
                tenant_id=tenant_id, template_id=template.id
            ).all()
            old_stage_ids = [s.id for s in old_stages]
            if old_stage_ids:
                await RdGateTemplateDeliverable.filter(
                    tenant_id=tenant_id, stage_id__in=old_stage_ids
                ).delete()
                await RdGateTemplateTask.filter(
                    tenant_id=tenant_id, stage_id__in=old_stage_ids
                ).delete()
                await RdGateTemplateStage.filter(
                    tenant_id=tenant_id, template_id=template.id
                ).delete()

            for idx, stage_input in enumerate(data.stages, start=1):
                gate_key = stage_input.gate_key.strip() or _slugify_gate_key(stage_input.gate_name)
                stage = await RdGateTemplateStage.create(
                    tenant_id=tenant_id,
                    template_id=template.id,
                    gate_key=gate_key,
                    gate_name=stage_input.gate_name,
                    sort_order=stage_input.sort_order or idx,
                    milestone_role=stage_input.milestone_role or GateMilestoneRole.NONE.value,
                )
                for d_idx, deliv in enumerate(stage_input.deliverables, start=1):
                    await RdGateTemplateDeliverable.create(
                        tenant_id=tenant_id,
                        stage_id=stage.id,
                        name=deliv.name,
                        deliverable_type=deliv.deliverable_type,
                        sort_order=deliv.sort_order or d_idx,
                    )
                temp_key_to_id: dict[str, int] = {}
                root_tasks = [t for t in (stage_input.tasks or []) if not t.parent_temp_key]
                child_tasks = [t for t in (stage_input.tasks or []) if t.parent_temp_key]
                for t_idx, task_input in enumerate(root_tasks, start=1):
                    created = await RdGateTemplateTask.create(
                        tenant_id=tenant_id,
                        stage_id=stage.id,
                        task_name=task_input.task_name,
                        sort_order=task_input.sort_order or t_idx,
                        default_owner_role=task_input.default_owner_role,
                    )
                    if task_input.temp_key:
                        temp_key_to_id[task_input.temp_key] = created.id
                for t_idx, task_input in enumerate(child_tasks, start=1):
                    parent_id = temp_key_to_id.get(task_input.parent_temp_key or "")
                    await RdGateTemplateTask.create(
                        tenant_id=tenant_id,
                        stage_id=stage.id,
                        parent_template_task_id=parent_id,
                        task_name=task_input.task_name,
                        sort_order=task_input.sort_order or t_idx,
                        default_owner_role=task_input.default_owner_role,
                    )

            user = await User.filter(id=updated_by).first()
            apply_update_audit(template, user)
            await template.save()

        return await self._build_detail(tenant_id, template)

    async def set_default(self, tenant_id: int, template_id: int, updated_by: int) -> GateTemplateDetailResponse:
        template = await self._get_template_or_404(tenant_id, template_id)
        if not template.is_active:
            raise BusinessLogicError("停用的模板不可设为默认")

        user = await User.filter(id=updated_by).first()
        async with in_transaction():
            others = await RdGateTemplate.filter(
                tenant_id=tenant_id,
                project_type=template.project_type,
                is_default=True,
                deleted_at__isnull=True,
            ).all()
            for other in others:
                other.is_default = False
                apply_update_audit(other, user)
                await other.save()
            template.is_default = True
            apply_update_audit(template, user)
            await template.save()

        return await self._build_detail(tenant_id, template)

    async def delete_template(self, tenant_id: int, template_id: int, deleted_by: int) -> None:
        template = await self._get_template_or_404(tenant_id, template_id)
        if template.is_default:
            raise BusinessLogicError("默认模板不可删除")
        in_use = await RdProject.filter(
            tenant_id=tenant_id, gate_template_id=template.id, deleted_at__isnull=True
        ).exists()
        if in_use:
            raise BusinessLogicError("已有项目引用该模板，不可删除")

        user = await User.filter(id=deleted_by).first()
        async with in_transaction():
            stages = await RdGateTemplateStage.filter(
                tenant_id=tenant_id, template_id=template.id
            ).all()
            stage_ids = [s.id for s in stages]
            if stage_ids:
                await RdGateTemplateDeliverable.filter(
                    tenant_id=tenant_id, stage_id__in=stage_ids
                ).delete()
                await RdGateTemplateTask.filter(
                    tenant_id=tenant_id, stage_id__in=stage_ids
                ).delete()
                await RdGateTemplateStage.filter(
                    tenant_id=tenant_id, template_id=template.id
                ).delete()
            template.deleted_at = resolve_business_datetime()
            apply_update_audit(template, user)
            await template.save()
