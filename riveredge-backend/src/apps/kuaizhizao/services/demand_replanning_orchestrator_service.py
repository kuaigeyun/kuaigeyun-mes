"""
需求重算编排服务

根据影响分析结果生成可执行重算任务，并支持执行任务。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from apps.kuaizhizao.models.demand_change_event import DemandChangeEvent
from apps.kuaizhizao.models.demand_impact_record import DemandImpactRecord
from apps.kuaizhizao.models.demand_replan_task import DemandReplanTask
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError


class DemandReplanningOrchestratorService:
    """需求重算任务编排"""

    def __init__(self) -> None:
        self._computation_service = DemandComputationService()

    @staticmethod
    async def _generate_task_code(tenant_id: int) -> str:
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        count = await DemandReplanTask.filter(tenant_id=tenant_id).count()
        return f"RPLAN-{ts}-{count + 1:04d}"

    async def create_task_from_event(
        self,
        tenant_id: int,
        event_id: int,
        operator_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        event = await DemandChangeEvent.get_or_none(tenant_id=tenant_id, id=event_id)
        if not event:
            raise NotFoundError(f"变更事件不存在: {event_id}")

        impacts = await DemandImpactRecord.filter(tenant_id=tenant_id, event_id=event_id).all()
        computation_ids = [int(i.impact_id) for i in impacts if i.impact_type == "computation"]
        demand_ids = [int(i.impact_id) for i in impacts if i.impact_type == "demand"]
        plan_ids = [int(i.impact_id) for i in impacts if i.impact_type == "plan"]
        material_ids = [int(i.impact_id) for i in impacts if i.impact_type == "material"]

        threshold = 50
        mode = "net_change"
        threshold_exceeded = len(set(computation_ids)) > threshold or len(set(material_ids)) > threshold
        if threshold_exceeded:
            mode = "full_regen"

        high_or_frozen = any(i.risk_level == "high" or i.frozen_horizon_hit for i in impacts)
        approval_status = "pending" if high_or_frozen else "not_required"
        task = await DemandReplanTask.create(
            tenant_id=tenant_id,
            event_id=event_id,
            task_code=await self._generate_task_code(tenant_id),
            mode=mode,
            status="pending",
            priority=3 if high_or_frozen else 5,
            risk_level="high" if high_or_frozen else "medium",
            approval_status=approval_status,
            auto_apply=False if high_or_frozen else True,
            threshold_exceeded=threshold_exceeded,
            task_scope={
                "event_type": event.event_type,
                "demand_ids": sorted(set(demand_ids)),
                "computation_ids": sorted(set(computation_ids)),
                "plan_ids": sorted(set(plan_ids)),
                "material_ids": sorted(set(material_ids)),
            },
            impact_metrics={
                "impact_count": len(impacts),
                "demand_count": len(set(demand_ids)),
                "computation_count": len(set(computation_ids)),
                "plan_count": len(set(plan_ids)),
                "material_count": len(set(material_ids)),
            },
            operator_id=operator_id,
        )
        return {
            "task_id": task.id,
            "task_code": task.task_code,
            "mode": task.mode,
            "approval_status": task.approval_status,
            "impact_metrics": task.impact_metrics,
            "task_scope": task.task_scope,
        }

    async def execute_task(
        self,
        tenant_id: int,
        task_id: int,
        operator_id: int,
        force: bool = False,
        approval_comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        task = await DemandReplanTask.get_or_none(tenant_id=tenant_id, id=task_id)
        if not task:
            raise NotFoundError(f"重算任务不存在: {task_id}")
        if task.status not in ("pending", "failed"):
            raise BusinessLogicError(f"当前任务状态 {task.status} 不允许执行")
        if task.approval_status == "pending" and not force:
            raise BusinessLogicError("任务命中冻结期或高风险影响，需要审批后执行")

        await DemandReplanTask.filter(tenant_id=tenant_id, id=task_id).update(
            status="running",
            started_at=datetime.now(),
            operator_id=operator_id,
            approval_status="approved" if (task.approval_status == "pending" and force) else task.approval_status,
            approved_by=operator_id if (task.approval_status == "pending" and force) else task.approved_by,
            approved_at=datetime.now() if (task.approval_status == "pending" and force) else task.approved_at,
            approval_comment=approval_comment or task.approval_comment,
            error_message=None,
        )

        scope = task.task_scope or {}
        target_ids: List[int]
        if task.mode == "full_regen":
            target_ids = await DemandComputation.filter(
                tenant_id=tenant_id,
                computation_status__in=["完成", "失败"],
            ).values_list("id", flat=True)
            target_ids = [int(i) for i in target_ids]
        else:
            target_ids = [int(i) for i in (scope.get("computation_ids") or [])]

        if not target_ids:
            err_msg = "未找到可重算的需求计算，请确认上游单据已下推需求计算"
            await DemandReplanTask.filter(tenant_id=tenant_id, id=task_id).update(
                status="failed",
                finished_at=datetime.now(),
                result_summary={
                    "target_count": 0,
                    "success_count": 0,
                    "failed_count": 0,
                    "success_computation_ids": [],
                    "failed_items": [],
                },
                error_message=err_msg,
            )
            event = await DemandChangeEvent.get_or_none(tenant_id=tenant_id, id=task.event_id)
            if event:
                await DemandChangeEvent.filter(tenant_id=tenant_id, id=event.id).update(event_status="failed")
            return {
                "task_id": task_id,
                "status": "failed",
                "error_message": err_msg,
                "result_summary": {
                    "target_count": 0,
                    "success_count": 0,
                    "failed_count": 0,
                    "failed_items": [],
                },
            }

        success_ids: List[int] = []
        failed: List[Dict[str, Any]] = []
        for computation_id in target_ids:
            try:
                await self._computation_service.recompute_computation(
                    tenant_id=tenant_id,
                    computation_id=computation_id,
                    operator_id=operator_id,
                    trigger="event_replan",
                    trigger_message=f"重算任务 {task.task_code}",
                )
                success_ids.append(computation_id)
            except Exception as exc:
                failed.append({"computation_id": computation_id, "error": str(exc)})

        status = "completed" if not failed else ("failed" if not success_ids else "completed")
        result_summary = {
            "target_count": len(target_ids),
            "success_count": len(success_ids),
            "failed_count": len(failed),
            "success_computation_ids": success_ids,
            "failed_items": failed,
        }
        await DemandReplanTask.filter(tenant_id=tenant_id, id=task_id).update(
            status=status,
            finished_at=datetime.now(),
            result_summary=result_summary,
            error_message=(
                failed[0]["error"][:500]
                if failed and not success_ids
                else (f"部分失败: {failed[0]['error'][:200]}" if failed else None)
            ),
        )

        event = await DemandChangeEvent.get_or_none(tenant_id=tenant_id, id=task.event_id)
        if event:
            await DemandChangeEvent.filter(tenant_id=tenant_id, id=event.id).update(
                event_status="closed" if status == "completed" else "failed"
            )

        return {
            "task_id": task_id,
            "status": status,
            "error_message": (
                failed[0]["error"][:500]
                if failed and not success_ids
                else (f"部分失败: {failed[0]['error'][:200]}" if failed else None)
            ),
            "result_summary": result_summary,
        }
