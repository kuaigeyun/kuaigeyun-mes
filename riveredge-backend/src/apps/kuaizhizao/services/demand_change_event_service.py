"""
需求变更事件服务

对外提供统一入口：创建事件 -> 影响分析 -> 生成重算任务。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from apps.kuaizhizao.models.demand_change_event import DemandChangeEvent
from apps.kuaizhizao.models.demand_impact_record import DemandImpactRecord
from apps.kuaizhizao.models.demand_replan_task import DemandReplanTask
from apps.kuaizhizao.services.demand_replan_impact_service import DemandReplanImpactService
from apps.kuaizhizao.services.demand_replanning_orchestrator_service import (
    DemandReplanningOrchestratorService,
)


class DemandChangeEventService:
    """需求变更事件统一服务"""

    def __init__(self) -> None:
        self._impact_service = DemandReplanImpactService()
        self._orchestrator = DemandReplanningOrchestratorService()

    @staticmethod
    async def _generate_event_code(tenant_id: int) -> str:
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        count = await DemandChangeEvent.filter(tenant_id=tenant_id).count()
        return f"DCE-{ts}-{count + 1:04d}"

    async def create_event(
        self,
        tenant_id: int,
        *,
        event_type: str,
        source_type: str,
        source_id: int,
        source_code: Optional[str] = None,
        source_name: Optional[str] = None,
        changed_fields: Optional[List[str]] = None,
        payload: Optional[Dict[str, Any]] = None,
        effective_at: Optional[datetime] = None,
        trigger_reason: Optional[str] = None,
        requested_by: Optional[int] = None,
        correlation_id: Optional[str] = None,
        auto_create_task: bool = True,
    ) -> Dict[str, Any]:
        event = await DemandChangeEvent.create(
            tenant_id=tenant_id,
            event_code=await self._generate_event_code(tenant_id),
            event_type=event_type,
            source_type=source_type,
            source_id=source_id,
            source_code=source_code,
            source_name=source_name,
            changed_fields=changed_fields or [],
            payload=payload or {},
            effective_at=effective_at,
            trigger_reason=trigger_reason,
            requested_by=requested_by,
            correlation_id=correlation_id,
            event_status="pending",
        )
        impact = await self._impact_service.analyze_event(tenant_id=tenant_id, event=event)
        task = None
        if auto_create_task:
            task = await self._orchestrator.create_task_from_event(
                tenant_id=tenant_id,
                event_id=event.id,
                operator_id=requested_by,
            )
        return {
            "event_id": event.id,
            "event_code": event.event_code,
            "event_status": event.event_status,
            "impact": impact,
            "task": task,
        }

    async def list_pending_events(self, tenant_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        rows = await DemandChangeEvent.filter(
            tenant_id=tenant_id,
            event_status__in=["pending", "analyzed"],
        ).order_by("-created_at").limit(limit)
        return [
            {
                "id": r.id,
                "event_code": r.event_code,
                "event_type": r.event_type,
                "source_type": r.source_type,
                "source_id": r.source_id,
                "source_code": r.source_code,
                "event_status": r.event_status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    async def get_event_impact(self, tenant_id: int, event_id: int) -> Dict[str, Any]:
        event = await DemandChangeEvent.get_or_none(tenant_id=tenant_id, id=event_id)
        if not event:
            return {"event_id": event_id, "exists": False}
        impacts = await DemandImpactRecord.filter(tenant_id=tenant_id, event_id=event_id).all()
        tasks = await DemandReplanTask.filter(tenant_id=tenant_id, event_id=event_id).order_by("-created_at").all()
        return {
            "event": {
                "id": event.id,
                "event_code": event.event_code,
                "event_type": event.event_type,
                "source_type": event.source_type,
                "source_id": event.source_id,
                "source_code": event.source_code,
                "event_status": event.event_status,
                "trigger_reason": event.trigger_reason,
                "created_at": event.created_at.isoformat() if event.created_at else None,
            },
            "impacts": [
                {
                    "id": i.id,
                    "impact_type": i.impact_type,
                    "impact_id": i.impact_id,
                    "impact_code": i.impact_code,
                    "impact_scope": i.impact_scope,
                    "impact_reason": i.impact_reason,
                    "risk_level": i.risk_level,
                    "needs_approval": i.needs_approval,
                    "frozen_horizon_hit": i.frozen_horizon_hit,
                    "impact_payload": i.impact_payload,
                }
                for i in impacts
            ],
            "tasks": [
                {
                    "id": t.id,
                    "task_code": t.task_code,
                    "mode": t.mode,
                    "status": t.status,
                    "risk_level": t.risk_level,
                    "approval_status": t.approval_status,
                    "impact_metrics": t.impact_metrics,
                    "result_summary": t.result_summary,
                }
                for t in tasks
            ],
        }

    async def get_dashboard(self, tenant_id: int) -> Dict[str, Any]:
        pending_events = await DemandChangeEvent.filter(
            tenant_id=tenant_id,
            event_status__in=["pending", "analyzed"],
        ).count()
        running_tasks = await DemandReplanTask.filter(tenant_id=tenant_id, status="running").count()
        failed_tasks = await DemandReplanTask.filter(tenant_id=tenant_id, status="failed").count()
        pending_approval = await DemandReplanTask.filter(tenant_id=tenant_id, approval_status="pending").count()
        latest_tasks = await DemandReplanTask.filter(tenant_id=tenant_id).order_by("-created_at").limit(10)
        return {
            "pending_events": pending_events,
            "running_tasks": running_tasks,
            "failed_tasks": failed_tasks,
            "pending_approval_tasks": pending_approval,
            "latest_tasks": [
                {
                    "id": t.id,
                    "task_code": t.task_code,
                    "mode": t.mode,
                    "status": t.status,
                    "approval_status": t.approval_status,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in latest_tasks
            ],
        }

    async def list_replan_tasks(self, tenant_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        rows = await DemandReplanTask.filter(tenant_id=tenant_id).order_by("-created_at").limit(limit)
        return [
            {
                "id": r.id,
                "task_code": r.task_code,
                "event_id": r.event_id,
                "mode": r.mode,
                "status": r.status,
                "risk_level": r.risk_level,
                "approval_status": r.approval_status,
                "impact_metrics": r.impact_metrics,
                "result_summary": r.result_summary,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            }
            for r in rows
        ]
