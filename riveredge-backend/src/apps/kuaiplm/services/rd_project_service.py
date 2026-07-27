"""
研发项目服务

Author: RiverEdge Team
Date: 2026-05-28
"""

from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaiplm.constants.rd_project import (
    DEFAULT_DELIVERY_DELIVERABLES,
    DEFAULT_DELIVERY_GATES,
    DEFAULT_GATE_DELIVERABLES,
    DEFAULT_NPI_GATES,
    GateMilestoneRole,
    SPAWN_INHERIT_LINK_TYPES,
    RdDeliverableStatus,
    RdGateStatus,
    RdProjectLinkType,
    RdProjectStatus,
    RdProjectType,
    RdTaskStatus,
)
from apps.kuaiplm.models import (
    KbArticle,
    KbArticleLink,
    KbSpace,
    RdDesignReview,
    RdFmeaRecord,
    RdProject,
    RdProjectDeliverable,
    RdProjectGate,
    RdProjectLink,
    RdProjectTask,
    RdRequirement,
)
from apps.kuaiplm.schemas.rd_project import (
    PushTrialWorkOrderRequest,
    PushTrialWorkOrderResponse,
    ProjectCollaborationSummary,
    RdProjectCreate,
    RdProjectDeliverableCreate,
    RdProjectDeliverableResponse,
    RdProjectDeliverableUpdate,
    RdProjectGateResponse,
    RdProjectGateUpdate,
    RdProjectLinkCreate,
    RdProjectLinkResponse,
    RdProjectResponse,
    RdProjectTaskCreate,
    RdProjectTaskResponse,
    RdProjectTaskUpdate,
    RdProjectUpdate,
    RdProjectWorkbenchResponse,
    RelatedArticleSummary,
    SpawnDeliveryProjectRequest,
)
from apps.kuaiplm.services.plm_list_core import (
    RD_PROJECT_SORT_DB_COLS,
    apply_plm_list_filters,
)
from apps.kuaiplm.utils.gate_template_seed import load_template_gate_defs
from apps.kuaiplm.utils.rd_project_progress import compute_project_progress
from apps.master_data.models.material import Material
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from core.utils.timezone_utils import resolve_business_datetime, to_site_date, today_site_str


class RdProjectService(AppBaseService[RdProject]):
    def __init__(self):
        super().__init__(RdProject)

    async def _generate_project_code(self, tenant_id: int, project_type: str = RdProjectType.RD.value) -> str:
        if project_type == RdProjectType.DELIVERY.value:
            return await self._generate_delivery_project_code(tenant_id)
        try:
            return await self.generate_code(tenant_id, "RD_PROJECT_CODE", prefix="YFXM")
        except Exception:
            import uuid

            return f"YFXM{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

    async def _generate_delivery_project_code(self, tenant_id: int) -> str:
        try:
            return await self.generate_code(tenant_id, "DELIVERY_PROJECT_CODE", prefix="JFXM")
        except Exception:
            import uuid

            return f"JFXM{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

    async def _get_project_or_404(self, tenant_id: int, project_id: int) -> RdProject:
        project = await RdProject.get_or_none(
            tenant_id=tenant_id, id=project_id, deleted_at__isnull=True
        )
        if not project:
            raise NotFoundError(f"项目不存在: {project_id}")
        return project

    async def _load_source_project_codes(
        self, tenant_id: int, projects: List[RdProject]
    ) -> Dict[int, str]:
        source_ids = {p.source_project_id for p in projects if p.source_project_id}
        if not source_ids:
            return {}
        sources = await RdProject.filter(
            tenant_id=tenant_id, id__in=list(source_ids), deleted_at__isnull=True
        ).all()
        return {s.id: s.project_code for s in sources}

    def _to_project_response(
        self, project: RdProject, source_codes: Optional[Dict[int, str]] = None
    ) -> RdProjectResponse:
        data = RdProjectResponse.model_validate(project)
        if project.source_project_id and source_codes:
            data.source_project_code = source_codes.get(project.source_project_id)
        return data

    async def _resolve_gate_template(
        self,
        tenant_id: int,
        project_type: str,
        gate_template_id: Optional[int] = None,
    ):
        try:
            template, gate_defs, deliverables_map = await load_template_gate_defs(
                tenant_id, project_type, gate_template_id
            )
            if template and gate_defs:
                return template, gate_defs, deliverables_map
        except ValueError as e:
            raise BusinessLogicError(str(e))

        if project_type == RdProjectType.DELIVERY.value:
            gate_defs = [
                {**g, "milestone_role": GateMilestoneRole.NONE.value}
                for g in DEFAULT_DELIVERY_GATES
            ]
            return None, gate_defs, DEFAULT_DELIVERY_DELIVERABLES
        gate_defs = [
            {
                **g,
                "milestone_role": (
                    GateMilestoneRole.SPAWN_DELIVERY.value
                    if g["gate_key"] == "release"
                    else GateMilestoneRole.NONE.value
                ),
            }
            for g in DEFAULT_NPI_GATES
        ]
        return None, gate_defs, DEFAULT_GATE_DELIVERABLES

    async def _copy_inherit_links(
        self,
        tenant_id: int,
        source_project_id: int,
        target_project_id: int,
        created_by: int,
    ) -> None:
        links = await RdProjectLink.filter(
            tenant_id=tenant_id, project_id=source_project_id
        ).all()
        for link in links:
            if link.link_type not in SPAWN_INHERIT_LINK_TYPES:
                continue
            await RdProjectLink.create(
                tenant_id=tenant_id,
                project_id=target_project_id,
                link_type=link.link_type,
                target_type=link.target_type,
                target_id=link.target_id,
                target_uuid=link.target_uuid,
                target_code=link.target_code,
                target_name=link.target_name,
                notes=link.notes,
                created_by=created_by,
            )

    async def _create_project_with_gates(
        self,
        tenant_id: int,
        *,
        project_type: str,
        project_code: str,
        project_name: str,
        description: Optional[str],
        material_id: Optional[int],
        material_code: Optional[str],
        material_name: Optional[str],
        owner_id: int,
        owner_name: Optional[str],
        priority: str,
        planned_start_date,
        planned_end_date,
        notes: Optional[str],
        source_project_id: Optional[int],
        created_by: int,
        inherit_links_from: Optional[RdProject] = None,
        gate_template_id: Optional[int] = None,
    ) -> RdProject:
        template, gate_defs, deliverable_map = await self._resolve_gate_template(
            tenant_id, project_type, gate_template_id
        )
        first_gate = gate_defs[0]["gate_key"] if gate_defs else None
        user_info = await self.get_user_info(created_by)
        project = await RdProject.create(
            tenant_id=tenant_id,
            project_code=project_code,
            project_name=project_name,
            description=description,
            status=RdProjectStatus.DRAFT.value,
            project_type=project_type,
            source_project_id=source_project_id,
            gate_template_id=template.id if template else None,
            material_id=material_id,
            material_code=material_code,
            material_name=material_name,
            current_gate_key=first_gate,
            owner_id=owner_id,
            owner_name=owner_name,
            priority=priority,
            planned_start_date=planned_start_date,
            planned_end_date=planned_end_date,
            notes=notes,
            created_by=created_by,
            created_by_name=user_info["name"],
            updated_by=created_by,
            updated_by_name=user_info["name"],
        )
        created_gates: List[RdProjectGate] = []
        for gate_def in gate_defs:
            gate = await RdProjectGate.create(
                tenant_id=tenant_id,
                project_id=project.id,
                gate_key=gate_def["gate_key"],
                gate_name=gate_def["gate_name"],
                sort_order=gate_def["sort_order"],
                status=RdGateStatus.PENDING.value,
                milestone_role=gate_def.get("milestone_role", GateMilestoneRole.NONE.value),
            )
            created_gates.append(gate)
        await self._seed_gate_deliverables(
            tenant_id, project.id, created_gates, created_by, deliverable_map
        )
        if inherit_links_from:
            await self._copy_inherit_links(
                tenant_id, inherit_links_from.id, project.id, created_by
            )
        return project

    async def _seed_gate_deliverables(
        self,
        tenant_id: int,
        project_id: int,
        gates: List[RdProjectGate],
        created_by: int,
        deliverable_map: Optional[Dict[str, List[Dict[str, str]]]] = None,
    ) -> None:
        templates_map = deliverable_map or DEFAULT_GATE_DELIVERABLES
        gate_by_key = {g.gate_key: g for g in gates}
        for gate_key, templates in templates_map.items():
            gate = gate_by_key.get(gate_key)
            if not gate:
                continue
            for tpl in templates:
                await RdProjectDeliverable.create(
                    tenant_id=tenant_id,
                    project_id=project_id,
                    gate_id=gate.id,
                    name=tpl["name"],
                    deliverable_type=tpl.get("deliverable_type"),
                    status=RdDeliverableStatus.PENDING.value,
                    created_by=created_by,
                    updated_by=created_by,
                )

    async def _validate_parent_task(
        self,
        tenant_id: int,
        project_id: int,
        parent_task_id: Optional[int],
    ) -> None:
        if parent_task_id is None:
            return
        parent = await RdProjectTask.get_or_none(
            tenant_id=tenant_id,
            id=parent_task_id,
            project_id=project_id,
            deleted_at__isnull=True,
        )
        if not parent:
            raise BusinessLogicError(f"父任务不存在: {parent_task_id}")
        if parent.parent_task_id is not None:
            raise BusinessLogicError("仅支持一级子任务，不可在子任务下再建子任务")

    async def _assert_gate_deliverables_ready(
        self, tenant_id: int, project_id: int, gate_id: int
    ) -> None:
        pending = await RdProjectDeliverable.filter(
            tenant_id=tenant_id,
            project_id=project_id,
            gate_id=gate_id,
            deleted_at__isnull=True,
        ).exclude(status=RdDeliverableStatus.APPROVED.value).all()
        if pending:
            names = "、".join(d.name for d in pending[:5])
            extra = f" 等 {len(pending)} 项" if len(pending) > 5 else ""
            raise BusinessLogicError(
                f"阶段门尚有未批准的交付物，无法通过：{names}{extra}"
            )

    async def list_projects(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        project_type: Optional[str] = None,
        project_code: Optional[str] = None,
        project_name: Optional[str] = None,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> Tuple[List[RdProjectResponse], int]:
        qs = RdProject.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            qs = qs.filter(status=status)
        if project_type:
            qs = qs.filter(project_type=project_type)
        exact_fields = None
        if not (keyword or "").strip():
            exact_fields = {
                "project_code": project_code,
                "project_name": project_name,
            }
        qs, order_expr = apply_plm_list_filters(
            qs,
            keyword=keyword,
            keyword_fields=["project_code", "project_name", "material_code", "material_name", "owner_name"],
            exact_fields=exact_fields,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            sort_field=sort_field,
            sort_order=sort_order,
            allowed_sort_cols=RD_PROJECT_SORT_DB_COLS,
            default_sort_col="created_at",
        )
        total = await qs.count()
        rows = await qs.order_by(order_expr).offset(skip).limit(limit).all()
        source_codes = await self._load_source_project_codes(tenant_id, rows)
        return [self._to_project_response(r, source_codes) for r in rows], total

    async def get_project(self, tenant_id: int, project_id: int) -> RdProjectResponse:
        project = await self._get_project_or_404(tenant_id, project_id)
        source_codes = await self._load_source_project_codes(tenant_id, [project])
        return self._to_project_response(project, source_codes)

    async def get_workbench(self, tenant_id: int, project_id: int) -> RdProjectWorkbenchResponse:
        project = await self._get_project_or_404(tenant_id, project_id)
        gates = await RdProjectGate.filter(tenant_id=tenant_id, project_id=project_id).order_by("sort_order").all()
        tasks = await RdProjectTask.filter(
            tenant_id=tenant_id, project_id=project_id, deleted_at__isnull=True
        ).order_by("sort_order", "id").all()
        deliverables = await RdProjectDeliverable.filter(
            tenant_id=tenant_id, project_id=project_id, deleted_at__isnull=True
        ).order_by("id").all()
        links = await RdProjectLink.filter(tenant_id=tenant_id, project_id=project_id).order_by("-created_at").all()
        article_links = await KbArticleLink.filter(
            tenant_id=tenant_id, target_type="rd_project", target_id=project_id
        ).all()
        related_articles: list[RelatedArticleSummary] = []
        if article_links:
            article_ids = [al.article_id for al in article_links]
            articles = await KbArticle.filter(
                tenant_id=tenant_id, id__in=article_ids, deleted_at__isnull=True
            ).all()
            space_ids = {a.space_id for a in articles}
            spaces = await KbSpace.filter(tenant_id=tenant_id, id__in=list(space_ids)).all()
            space_map = {s.id: s.space_name for s in spaces}
            related_articles = [
                RelatedArticleSummary(
                    id=a.id,
                    title=a.title,
                    space_name=space_map.get(a.space_id),
                    updated_at=a.updated_at,
                )
                for a in articles
            ]
        req_count = await RdRequirement.filter(
            tenant_id=tenant_id, project_id=project_id, deleted_at__isnull=True
        ).count()
        dr_count = await RdDesignReview.filter(
            tenant_id=tenant_id, project_id=project_id, deleted_at__isnull=True
        ).count()
        fmea_count = await RdFmeaRecord.filter(
            tenant_id=tenant_id, project_id=project_id, deleted_at__isnull=True
        ).count()
        progress = compute_project_progress(gates, tasks, deliverables)
        source_codes = await self._load_source_project_codes(tenant_id, [project])
        base = self._to_project_response(project, source_codes)
        return RdProjectWorkbenchResponse.model_validate({
            **base.model_dump(),
            "gates": [RdProjectGateResponse.model_validate(g) for g in gates],
            "tasks": [RdProjectTaskResponse.model_validate(t) for t in tasks],
            "deliverables": [RdProjectDeliverableResponse.model_validate(d) for d in deliverables],
            "links": [RdProjectLinkResponse.model_validate(l) for l in links],
            "related_articles": related_articles,
            "progress": progress,
            "collaboration": ProjectCollaborationSummary(
                requirement_count=req_count,
                design_review_count=dr_count,
                fmea_count=fmea_count,
            ),
        })

    async def create_project(
        self, tenant_id: int, data: RdProjectCreate, created_by: int
    ) -> RdProjectResponse:
        project_type = data.project_type or RdProjectType.RD.value
        if project_type not in (RdProjectType.RD.value, RdProjectType.DELIVERY.value):
            raise BusinessLogicError(f"不支持的项目类型: {project_type}")

        async with in_transaction():
            inherit_from: Optional[RdProject] = None
            if data.source_project_id:
                inherit_from = await self._get_project_or_404(tenant_id, data.source_project_id)
                if inherit_from.project_type != RdProjectType.RD.value:
                    raise BusinessLogicError("来源项目必须是研发项目")
                if project_type != RdProjectType.DELIVERY.value:
                    raise BusinessLogicError("仅交付项目可指定来源研发项目")

            code = data.project_code or await self._generate_project_code(tenant_id, project_type)
            owner_id = data.owner_id or created_by
            owner_name = data.owner_name
            if owner_id and not owner_name:
                owner_name = await self.get_user_name(owner_id)

            material_code = data.material_code
            material_name = data.material_name
            material_id = data.material_id
            if inherit_from and not material_id and not material_code:
                material_id = inherit_from.material_id
                material_code = inherit_from.material_code
                material_name = inherit_from.material_name
            if material_id and not material_code:
                mat = await Material.get_or_none(tenant_id=tenant_id, id=material_id, deleted_at__isnull=True)
                if mat:
                    material_code = mat.main_code
                    material_name = mat.name

            project = await self._create_project_with_gates(
                tenant_id,
                project_type=project_type,
                project_code=code,
                project_name=data.project_name,
                description=data.description,
                material_id=material_id,
                material_code=material_code,
                material_name=material_name,
                owner_id=owner_id,
                owner_name=owner_name,
                priority=data.priority,
                planned_start_date=data.planned_start_date,
                planned_end_date=data.planned_end_date,
                notes=data.notes,
                source_project_id=data.source_project_id,
                created_by=created_by,
                inherit_links_from=inherit_from,
                gate_template_id=data.gate_template_id,
            )
            source_codes = await self._load_source_project_codes(tenant_id, [project])
            return self._to_project_response(project, source_codes)

    async def spawn_delivery_project(
        self,
        tenant_id: int,
        source_project_id: int,
        data: SpawnDeliveryProjectRequest,
        created_by: int,
    ) -> RdProjectResponse:
        source = await self._get_project_or_404(tenant_id, source_project_id)
        if source.project_type != RdProjectType.RD.value:
            raise BusinessLogicError("仅研发项目可下推交付项目")

        spawn_gate = await RdProjectGate.get_or_none(
            tenant_id=tenant_id,
            project_id=source_project_id,
            milestone_role=GateMilestoneRole.SPAWN_DELIVERY.value,
        )
        if not spawn_gate or spawn_gate.status != RdGateStatus.PASSED.value:
            status_label = spawn_gate.status if spawn_gate else "未找到"
            gate_label = spawn_gate.gate_name if spawn_gate else "下推交付里程碑"
            raise BusinessLogicError(
                f"研发项目「{gate_label}」阶段门尚未通过（当前: {status_label}），无法创建交付项目"
            )

        async with in_transaction():
            owner_id = data.owner_id or source.owner_id or created_by
            owner_name = data.owner_name or source.owner_name
            if owner_id and not owner_name:
                owner_name = await self.get_user_name(owner_id)

            project_name = data.project_name or f"{source.project_name} - 交付"
            code = data.project_code or await self._generate_project_code(
                tenant_id, RdProjectType.DELIVERY.value
            )

            project = await self._create_project_with_gates(
                tenant_id,
                project_type=RdProjectType.DELIVERY.value,
                project_code=code,
                project_name=project_name,
                description=source.description,
                material_id=source.material_id,
                material_code=source.material_code,
                material_name=source.material_name,
                owner_id=owner_id,
                owner_name=owner_name,
                priority=source.priority,
                planned_start_date=source.planned_start_date,
                planned_end_date=source.planned_end_date,
                notes=source.notes,
                source_project_id=source.id,
                created_by=created_by,
                inherit_links_from=source,
            )
            source_codes = await self._load_source_project_codes(tenant_id, [project])
            return self._to_project_response(project, source_codes)

    async def update_project(
        self, tenant_id: int, project_id: int, data: RdProjectUpdate, updated_by: int
    ) -> RdProjectResponse:
        project = await self._get_project_or_404(tenant_id, project_id)
        user_info = await self.get_user_info(updated_by)
        update_fields = {
            "updated_by": updated_by,
            "updated_by_name": user_info["name"],
        }
        for field in (
            "project_name", "description", "status", "material_id", "material_code",
            "material_name", "current_gate_key", "owner_id", "owner_name", "priority",
            "planned_start_date", "planned_end_date", "actual_start_date", "actual_end_date", "notes",
        ):
            val = getattr(data, field, None)
            if val is not None:
                update_fields[field] = val
        await project.update_from_dict(update_fields).save()
        return RdProjectResponse.model_validate(project)

    async def delete_project(self, tenant_id: int, project_id: int, deleted_by: int) -> None:
        project = await self._get_project_or_404(tenant_id, project_id)
        if project.status not in (RdProjectStatus.DRAFT.value, RdProjectStatus.CANCELLED.value):
            raise BusinessLogicError("仅草稿或已取消项目可删除")
        user_info = await self.get_user_info(deleted_by)
        await project.update_from_dict({
            "deleted_at": resolve_business_datetime(),
            "updated_by": deleted_by,
            "updated_by_name": user_info["name"],
        }).save()

    # ---------- Gates ----------

    async def update_gate(
        self, tenant_id: int, project_id: int, gate_id: int, data: RdProjectGateUpdate, user_id: int
    ) -> RdProjectGateResponse:
        await self._get_project_or_404(tenant_id, project_id)
        gate = await RdProjectGate.get_or_none(tenant_id=tenant_id, id=gate_id, project_id=project_id)
        if not gate:
            raise NotFoundError(f"阶段门不存在: {gate_id}")
        if data.status == RdGateStatus.PASSED.value:
            await self._assert_gate_deliverables_ready(tenant_id, project_id, gate_id)
        update_fields = {}
        for field in (
            "status", "planned_date", "actual_date", "reviewer_id",
            "reviewer_name", "review_notes", "criteria",
        ):
            val = getattr(data, field, None)
            if val is not None:
                update_fields[field] = val
        if data.status == RdGateStatus.PASSED.value and "actual_date" not in update_fields:
            update_fields["actual_date"] = to_site_date(resolve_business_datetime())
        if update_fields:
            await gate.update_from_dict(update_fields).save()
        if data.status == RdGateStatus.PASSED.value:
            project = await RdProject.get(id=project_id)
            user_info = await self.get_user_info(user_id)
            await project.update_from_dict({
                "current_gate_key": gate.gate_key,
                "updated_by": user_id,
                "updated_by_name": user_info["name"],
            }).save()
        return RdProjectGateResponse.model_validate(gate)

    # ---------- Tasks ----------

    async def create_task(
        self, tenant_id: int, project_id: int, data: RdProjectTaskCreate, created_by: int
    ) -> RdProjectTaskResponse:
        await self._get_project_or_404(tenant_id, project_id)
        if data.gate_id is None:
            raise BusinessLogicError("任务必须归属某一阶段门")
        gate = await RdProjectGate.get_or_none(
            tenant_id=tenant_id, id=data.gate_id, project_id=project_id
        )
        if not gate:
            raise BusinessLogicError(f"阶段门不存在: {data.gate_id}")
        await self._validate_parent_task(tenant_id, project_id, data.parent_task_id)
        task = await RdProjectTask.create(
            tenant_id=tenant_id,
            project_id=project_id,
            gate_id=data.gate_id,
            parent_task_id=data.parent_task_id,
            task_name=data.task_name,
            description=data.description,
            status=data.status,
            assignee_id=data.assignee_id,
            assignee_name=data.assignee_name,
            due_date=data.due_date,
            sort_order=data.sort_order,
            priority=data.priority,
            created_by=created_by,
            updated_by=created_by,
        )
        return RdProjectTaskResponse.model_validate(task)

    async def update_task(
        self, tenant_id: int, project_id: int, task_id: int, data: RdProjectTaskUpdate, updated_by: int
    ) -> RdProjectTaskResponse:
        task = await RdProjectTask.get_or_none(
            tenant_id=tenant_id, id=task_id, project_id=project_id, deleted_at__isnull=True
        )
        if not task:
            raise NotFoundError(f"任务不存在: {task_id}")
        if data.parent_task_id is not None:
            await self._validate_parent_task(tenant_id, project_id, data.parent_task_id)
            if data.parent_task_id == task_id:
                raise BusinessLogicError("任务不能指定自身为父任务")
        if data.gate_id is not None:
            gate = await RdProjectGate.get_or_none(
                tenant_id=tenant_id, id=data.gate_id, project_id=project_id
            )
            if not gate:
                raise BusinessLogicError(f"阶段门不存在: {data.gate_id}")
        update_fields = {"updated_by": updated_by}
        for field in (
            "task_name", "description", "gate_id", "parent_task_id", "status", "assignee_id",
            "assignee_name", "due_date", "sort_order", "priority",
        ):
            val = getattr(data, field, None)
            if val is not None:
                update_fields[field] = val
        if data.status == RdTaskStatus.DONE.value:
            update_fields["completed_at"] = resolve_business_datetime()
        await task.update_from_dict(update_fields).save()
        return RdProjectTaskResponse.model_validate(task)

    async def delete_task(self, tenant_id: int, project_id: int, task_id: int, deleted_by: int) -> None:
        task = await RdProjectTask.get_or_none(
            tenant_id=tenant_id, id=task_id, project_id=project_id, deleted_at__isnull=True
        )
        if not task:
            raise NotFoundError(f"任务不存在: {task_id}")
        user_info = await self.get_user_info(deleted_by)
        await task.update_from_dict({
            "deleted_at": resolve_business_datetime(),
            "updated_by": deleted_by,
            "updated_by_name": user_info["name"],
        }).save()

    # ---------- Deliverables ----------

    async def create_deliverable(
        self, tenant_id: int, project_id: int, data: RdProjectDeliverableCreate, created_by: int
    ) -> RdProjectDeliverableResponse:
        await self._get_project_or_404(tenant_id, project_id)
        if data.gate_id is not None:
            gate = await RdProjectGate.get_or_none(
                tenant_id=tenant_id, id=data.gate_id, project_id=project_id
            )
            if not gate:
                raise BusinessLogicError(f"阶段门不存在: {data.gate_id}")
        row = await RdProjectDeliverable.create(
            tenant_id=tenant_id,
            project_id=project_id,
            gate_id=data.gate_id,
            name=data.name,
            description=data.description,
            deliverable_type=data.deliverable_type,
            status=data.status,
            file_url=data.file_url,
            file_name=data.file_name,
            created_by=created_by,
            updated_by=created_by,
        )
        return RdProjectDeliverableResponse.model_validate(row)

    async def update_deliverable(
        self, tenant_id: int, project_id: int, deliverable_id: int, data: RdProjectDeliverableUpdate, updated_by: int
    ) -> RdProjectDeliverableResponse:
        row = await RdProjectDeliverable.get_or_none(
            tenant_id=tenant_id, id=deliverable_id, project_id=project_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"交付物不存在: {deliverable_id}")
        update_fields = {"updated_by": updated_by}
        for field in (
            "name", "description", "gate_id", "deliverable_type", "status", "file_url", "file_name",
        ):
            val = getattr(data, field, None)
            if val is not None:
                update_fields[field] = val
        if data.status == RdDeliverableStatus.SUBMITTED.value:
            update_fields["submitted_at"] = resolve_business_datetime()
        if data.status == RdDeliverableStatus.APPROVED.value:
            update_fields["approved_at"] = resolve_business_datetime()
        await row.update_from_dict(update_fields).save()
        return RdProjectDeliverableResponse.model_validate(row)

    async def delete_deliverable(
        self, tenant_id: int, project_id: int, deliverable_id: int, deleted_by: int
    ) -> None:
        row = await RdProjectDeliverable.get_or_none(
            tenant_id=tenant_id, id=deliverable_id, project_id=project_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"交付物不存在: {deliverable_id}")
        user_info = await self.get_user_info(deleted_by)
        await row.update_from_dict({
            "deleted_at": resolve_business_datetime(),
            "updated_by": deleted_by,
            "updated_by_name": user_info["name"],
        }).save()

    # ---------- Links ----------

    async def create_link(
        self, tenant_id: int, project_id: int, data: RdProjectLinkCreate, created_by: int
    ) -> RdProjectLinkResponse:
        await self._get_project_or_404(tenant_id, project_id)
        link = await RdProjectLink.create(
            tenant_id=tenant_id,
            project_id=project_id,
            link_type=data.link_type,
            target_type=data.target_type,
            target_id=data.target_id,
            target_uuid=data.target_uuid,
            target_code=data.target_code,
            target_name=data.target_name,
            notes=data.notes,
            created_by=created_by,
        )
        return RdProjectLinkResponse.model_validate(link)

    async def delete_link(self, tenant_id: int, project_id: int, link_id: int) -> None:
        link = await RdProjectLink.get_or_none(tenant_id=tenant_id, id=link_id, project_id=project_id)
        if not link:
            raise NotFoundError(f"关联不存在: {link_id}")
        await link.delete()

    # ---------- Push trial work order ----------

    async def push_trial_work_order(
        self,
        tenant_id: int,
        project_id: int,
        data: PushTrialWorkOrderRequest,
        created_by: int,
    ) -> PushTrialWorkOrderResponse:
        from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
        from apps.kuaizhizao.services.work_order_service import WorkOrderService

        project = await self._get_project_or_404(tenant_id, project_id)
        if not project.material_id and not project.material_code:
            raise BusinessLogicError("项目未关联目标物料，无法下推试制工单")

        product_id = project.material_id
        product_code = project.material_code
        product_name = project.material_name
        if product_id and not product_code:
            mat = await Material.get_or_none(tenant_id=tenant_id, id=product_id, deleted_at__isnull=True)
            if not mat:
                raise NotFoundError(f"物料不存在: {product_id}")
            product_code = mat.main_code
            product_name = mat.name
        elif product_code and not product_id:
            mat = await Material.get_or_none(
                tenant_id=tenant_id, main_code=product_code, deleted_at__isnull=True
            )
            if not mat:
                raise NotFoundError(f"物料不存在: {product_code}")
            product_id = mat.id
            product_name = mat.name

        wo_data = WorkOrderCreate(
            code_rule="WORK_ORDER_CODE",
            name=f"试制-{project.project_code}",
            product_id=product_id,
            product_code=product_code,
            product_name=product_name or product_code,
            quantity=data.quantity,
            production_mode="MTS",
            status="draft",
            planned_start_date=data.planned_start_date,
            planned_end_date=data.planned_end_date,
            remarks=data.remarks or f"由研发项目 {project.project_code} 下推试制",
        )
        wo = await WorkOrderService().create_work_order(
            tenant_id=tenant_id, work_order_data=wo_data, created_by=created_by, allow_draft=True
        )
        link = await RdProjectLink.create(
            tenant_id=tenant_id,
            project_id=project_id,
            link_type=RdProjectLinkType.WORK_ORDER.value,
            target_type="work_order",
            target_id=wo.id,
            target_code=wo.code,
            target_name=wo.name or wo.code,
            notes="试制工单",
            created_by=created_by,
        )
        return PushTrialWorkOrderResponse(
            work_order_id=wo.id,
            work_order_code=wo.code,
            project_link_id=link.id,
        )
