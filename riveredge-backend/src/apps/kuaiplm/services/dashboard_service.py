"""
快研发仪表盘服务

Author: RiverEdge Team
Date: 2026-05-28
"""

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from apps.kuaiplm.constants.rd_project import (
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
from apps.kuaiplm.utils.rd_project_progress import (
    PENDING_GATE_LIVE_PROJECT_STATUSES,
    PENDING_GATE_REVIEW_STATUSES,
    compute_project_progress,
    count_pending_current_gates,
)
from apps.master_data.models.bom_change import BOMChange
from apps.master_data.models.process_route_change import ProcessRouteChange
from core.utils.timezone_utils import to_api_isoformat

class DashboardService:
    def _gate_display_name(
        self,
        gate_key: Optional[str],
        gates: Optional[List[RdProjectGate]] = None,
    ) -> Optional[str]:
        if not gate_key:
            return None
        if gates:
            for gate in gates:
                if gate.gate_key == gate_key:
                    return gate.gate_name
        return gate_key

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

    @staticmethod
    def _gate_gantt_progress(gate: RdProjectGate) -> float:
        status = (gate.status or "").upper()
        if status in (RdGateStatus.PASSED.value, RdGateStatus.SKIPPED.value):
            return 100.0
        if status == RdGateStatus.IN_PROGRESS.value:
            return 50.0
        return 0.0

    @classmethod
    def _resolve_gate_gantt_dates(
        cls,
        project: RdProject,
        gates: List[RdProjectGate],
        gate_index: int,
        gate: RdProjectGate,
    ) -> tuple[date, date]:
        p_start, p_end = DashboardService()._resolve_gantt_dates(project)
        if gate_index > 0:
            prev = gates[gate_index - 1]
            start = prev.planned_date or prev.actual_date or p_start
        else:
            start = p_start

        end = gate.planned_date or gate.actual_date
        if end is None:
            n = max(len(gates), 1)
            total_days = max((p_end - p_start).days, n)
            seg = max(1, total_days // n)
            start = p_start + timedelta(days=seg * gate_index)
            end = start + timedelta(days=seg)
        if end <= start:
            end = start + timedelta(days=7)
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
            project_progress = self._project_progress(gates, tasks, deliverables)
            start, end = self._resolve_gantt_dates(project)

            if not gates:
                items.append(
                    {
                        "id": project.id * 100000,
                        "project_id": project.id,
                        "gate_id": 0,
                        "project_code": project.project_code,
                        "project_name": project.project_name,
                        "gate_name": self._gate_display_name(
                            project.current_gate_key, gates
                        )
                        or project.project_name,
                        "owner_name": project.owner_name,
                        "gate_status": project.status,
                        "planned_start_date": to_api_isoformat(start),
                        "planned_end_date": to_api_isoformat(end),
                        "progress": project_progress,
                        "project_progress": project_progress,
                    }
                )
                continue

            for idx, gate in enumerate(gates):
                g_start, g_end = self._resolve_gate_gantt_dates(project, gates, idx, gate)
                items.append(
                    {
                        "id": project.id * 100000 + gate.id,
                        "project_id": project.id,
                        "gate_id": gate.id,
                        "project_code": project.project_code,
                        "project_name": project.project_name,
                        "gate_name": gate.gate_name,
                        "owner_name": project.owner_name,
                        "gate_status": gate.status,
                        "planned_start_date": to_api_isoformat(g_start),
                        "planned_end_date": to_api_isoformat(g_end),
                        "progress": self._gate_gantt_progress(gate),
                        "project_progress": project_progress,
                    }
                )
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
                "due_date": to_api_isoformat(task.due_date) if task.due_date else None,
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
        project_delivery_total = 0
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
        live_projects = await RdProject.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=list(PENDING_GATE_LIVE_PROJECT_STATUSES),
        ).all()
        if live_projects:
            live_gates = await RdProjectGate.filter(
                tenant_id=tenant_id,
                project_id__in=[p.id for p in live_projects],
                status__in=list(PENDING_GATE_REVIEW_STATUSES),
            ).all()
            pending_gate_reviews = count_pending_current_gates(live_projects, live_gates)
        else:
            pending_gate_reviews = 0
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

        from apps.kuaiplm.services.pending_inbox_service import PendingInboxService

        pending_wave1_docs = await PendingInboxService().pending_count(tenant_id)

        recent = await RdProject.filter(tenant_id=tenant_id, deleted_at__isnull=True).order_by("-created_at", "-id").limit(5).all()
        recent_ids = [p.id for p in recent]
        recent_gates = await RdProjectGate.filter(
            tenant_id=tenant_id, project_id__in=recent_ids
        ).all() if recent_ids else []
        recent_gates_by_project: Dict[int, List[RdProjectGate]] = {}
        for gate in recent_gates:
            recent_gates_by_project.setdefault(gate.project_id, []).append(gate)

        recent_projects = [
            {
                "id": p.id,
                "project_code": p.project_code,
                "project_name": p.project_name,
                "status": p.status,
                "status_label": PROJECT_STATUS_LABELS.get(p.status, p.status),
                "project_type": p.project_type,
                "current_gate_key": p.current_gate_key,
                "current_gate_name": self._gate_display_name(
                    p.current_gate_key, recent_gates_by_project.get(p.id, [])
                ),
                "updated_at": to_api_isoformat(p.updated_at) if p.updated_at else None,
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
            pending_wave1_docs=pending_wave1_docs,
            recent_projects=recent_projects,
            project_gantt=project_gantt,
            my_tasks=my_tasks,
        )
