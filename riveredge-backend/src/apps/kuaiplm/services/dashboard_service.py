"""
快研发仪表盘服务

Author: RiverEdge Team
Date: 2026-05-28
"""

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from apps.kuaiplm.constants.rd_project import (
    DEFAULT_DELIVERY_GATES,
    DEFAULT_NPI_GATES,
    PROJECT_STATUS_LABELS,
    RdDeliverableStatus,
    RdGateStatus,
    RdProjectStatus,
    RdProjectType,
    RdTaskStatus,
)
from apps.kuaiplm.models import (
    KbArticle,
    RdDesignReview,
    RdFmeaRecord,
    RdProject,
    RdProjectDeliverable,
    RdProjectGate,
    RdProjectTask,
    RdRequirement,
)
from apps.kuaiplm.schemas.change_desk import DashboardSummaryResponse
from apps.kuaiplm.utils.rd_project_progress import compute_project_progress
from apps.master_data.models.bom_change import BOMChange
from apps.master_data.models.process_route_change import ProcessRouteChange

_GATE_NAME_MAP = {
    **{g["gate_key"]: g["gate_name"] for g in DEFAULT_NPI_GATES},
    **{g["gate_key"]: g["gate_name"] for g in DEFAULT_DELIVERY_GATES},
}


class DashboardService:
    def _gate_display_name(self, gate_key: Optional[str]) -> Optional[str]:
        if not gate_key:
            return None
        return _GATE_NAME_MAP.get(gate_key, gate_key)

    def _project_progress(
        self,
        gates: List[RdProjectGate],
        tasks: List[RdProjectTask],
        deliverables: List[RdProjectDeliverable],
    ) -> float:
        return compute_project_progress(gates, tasks, deliverables)

    def _resolve_gantt_dates(
        self,
        project: RdProject,
    ) -> tuple[date, date]:
        start = (
            project.planned_start_date
            or project.actual_start_date
            or (project.created_at.date() if project.created_at else date.today())
        )
        end = project.planned_end_date or project.actual_end_date
        if not end or end <= start:
            end = start + timedelta(days=90)
        return start, end

    async def _build_project_gantt_items(self, tenant_id: int) -> List[Dict[str, Any]]:
        projects = await RdProject.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=[
                RdProjectStatus.IN_PROGRESS.value,
                RdProjectStatus.DRAFT.value,
                RdProjectStatus.ON_HOLD.value,
            ],
        ).order_by("planned_start_date", "-updated_at").limit(30).all()
        if not projects:
            return []

        project_ids = [p.id for p in projects]
        all_gates = await RdProjectGate.filter(
            tenant_id=tenant_id, project_id__in=project_ids
        ).order_by("sort_order").all()
        all_tasks = await RdProjectTask.filter(
            tenant_id=tenant_id, project_id__in=project_ids, deleted_at__isnull=True
        ).all()
        all_deliverables = await RdProjectDeliverable.filter(
            tenant_id=tenant_id, project_id__in=project_ids, deleted_at__isnull=True
        ).all()
        gates_by_project: Dict[int, List[RdProjectGate]] = {}
        tasks_by_project: Dict[int, List[RdProjectTask]] = {}
        deliverables_by_project: Dict[int, List[RdProjectDeliverable]] = {}
        for gate in all_gates:
            gates_by_project.setdefault(gate.project_id, []).append(gate)
        for task in all_tasks:
            tasks_by_project.setdefault(task.project_id, []).append(task)
        for d in all_deliverables:
            deliverables_by_project.setdefault(d.project_id, []).append(d)

        items: List[Dict[str, Any]] = []
        for project in projects:
            gates = gates_by_project.get(project.id, [])
            tasks = tasks_by_project.get(project.id, [])
            deliverables = deliverables_by_project.get(project.id, [])
            start, end = self._resolve_gantt_dates(project)
            items.append({
                "id": project.id,
                "project_code": project.project_code,
                "project_name": project.project_name,
                "status": project.status,
                "status_label": PROJECT_STATUS_LABELS.get(project.status, project.status),
                "planned_start_date": start.isoformat(),
                "planned_end_date": end.isoformat(),
                "progress": self._project_progress(gates, tasks, deliverables),
                "current_gate_key": project.current_gate_key,
                "current_gate_name": self._gate_display_name(project.current_gate_key),
                "owner_name": project.owner_name,
            })
        return items

    async def list_my_tasks(
        self,
        tenant_id: int,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        from tortoise.expressions import Q

        if not user_id and not user_name:
            return []

        cond = Q()
        if user_id:
            cond |= Q(assignee_id=user_id)
        if user_name:
            cond |= Q(assignee_name=user_name)

        tasks = await RdProjectTask.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=[RdTaskStatus.TODO.value, RdTaskStatus.IN_PROGRESS.value],
        ).filter(cond).order_by("due_date", "id").limit(limit * 2).all()
        if not tasks:
            return []

        project_ids = list({t.project_id for t in tasks})
        projects = await RdProject.filter(
            tenant_id=tenant_id, id__in=project_ids, deleted_at__isnull=True
        ).all()
        project_map = {p.id: p for p in projects}
        gate_ids = [t.gate_id for t in tasks if t.gate_id]
        gates = await RdProjectGate.filter(tenant_id=tenant_id, id__in=gate_ids).all() if gate_ids else []
        gate_map = {g.id: g for g in gates}

        items: List[Dict[str, Any]] = []
        for task in tasks:
            proj = project_map.get(task.project_id)
            if not proj:
                continue
            gate = gate_map.get(task.gate_id) if task.gate_id else None
            items.append({
                "id": task.id,
                "project_id": task.project_id,
                "project_code": proj.project_code,
                "project_name": proj.project_name,
                "task_name": task.task_name,
                "status": task.status,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "gate_name": gate.gate_name if gate else None,
                "assignee_name": task.assignee_name,
            })
            if len(items) >= limit:
                break
        return items

    async def get_summary(
        self,
        tenant_id: int,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,
    ) -> DashboardSummaryResponse:
        project_total = await RdProject.filter(tenant_id=tenant_id, deleted_at__isnull=True).count()
        project_rd_total = await RdProject.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, project_type=RdProjectType.RD.value
        ).count()
        project_delivery_total = await RdProject.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, project_type=RdProjectType.DELIVERY.value
        ).count()
        project_in_progress = await RdProject.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status=RdProjectStatus.IN_PROGRESS.value
        ).count()
        project_on_hold = await RdProject.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status=RdProjectStatus.ON_HOLD.value
        ).count()
        project_completed = await RdProject.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status=RdProjectStatus.COMPLETED.value
        ).count()
        open_tasks = await RdProjectTask.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=[RdTaskStatus.TODO.value, RdTaskStatus.IN_PROGRESS.value],
        ).count()
        pending_gate_reviews = await RdProjectGate.filter(
            tenant_id=tenant_id,
            status__in=[RdGateStatus.PENDING.value, RdGateStatus.IN_PROGRESS.value],
        ).count()
        pending_bom = await BOMChange.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status="pending"
        ).count()
        pending_route = await ProcessRouteChange.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status="pending"
        ).count()
        kb_total = await KbArticle.filter(tenant_id=tenant_id, deleted_at__isnull=True).count()
        req_total = await RdRequirement.filter(tenant_id=tenant_id, deleted_at__isnull=True).count()
        dr_pending = await RdDesignReview.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, status__in=["PLANNED", "IN_REVIEW"]
        ).count()
        fmea_total = await RdFmeaRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True).count()

        recent = await RdProject.filter(tenant_id=tenant_id, deleted_at__isnull=True).order_by("-updated_at").limit(5).all()
        recent_projects = [
            {
                "id": p.id,
                "project_code": p.project_code,
                "project_name": p.project_name,
                "status": p.status,
                "status_label": PROJECT_STATUS_LABELS.get(p.status, p.status),
                "project_type": p.project_type,
                "current_gate_key": p.current_gate_key,
                "current_gate_name": self._gate_display_name(p.current_gate_key),
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
            for p in recent
        ]

        project_gantt = await self._build_project_gantt_items(tenant_id)
        my_tasks = await self.list_my_tasks(tenant_id, user_id=user_id, user_name=user_name, limit=10)

        return DashboardSummaryResponse(
            project_total=project_total,
            project_rd_total=project_rd_total,
            project_delivery_total=project_delivery_total,
            project_in_progress=project_in_progress,
            project_on_hold=project_on_hold,
            project_completed=project_completed,
            open_tasks=open_tasks,
            pending_gate_reviews=pending_gate_reviews,
            pending_bom_changes=pending_bom,
            pending_route_changes=pending_route,
            kb_article_total=kb_total,
            requirement_total=req_total,
            design_review_pending=dr_pending,
            fmea_total=fmea_total,
            recent_projects=recent_projects,
            project_gantt=project_gantt,
            my_tasks=my_tasks,
        )
