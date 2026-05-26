"""
排程场景服务（Scenario Sandbox）
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.scheduling_scenario import SchedulingScenario
from apps.kuaizhizao.schemas.planning import (
    SchedulingScenarioCreate,
    SchedulingScenarioUpdate,
    SchedulingScenarioResponse,
    SchedulingScenarioListResponse,
)
from apps.kuaizhizao.schemas.scheduling_constraints import SchedulingConstraints
from apps.kuaizhizao.services.advanced_scheduling_service import AdvancedSchedulingService
from infra.exceptions.exceptions import NotFoundError


class SchedulingScenarioService(AppBaseService[SchedulingScenario]):
    """排程场景服务。"""

    def __init__(self):
        super().__init__(SchedulingScenario)
        self._scheduler = AdvancedSchedulingService()

    @staticmethod
    def _normalize_work_order_ids(value: Optional[List[int]]) -> List[int]:
        if not value:
            return []
        out: List[int] = []
        for item in value:
            try:
                num = int(item)
            except (TypeError, ValueError):
                continue
            if num > 0:
                out.append(num)
        return sorted(set(out))

    @staticmethod
    def _to_response(model: SchedulingScenario) -> SchedulingScenarioResponse:
        return SchedulingScenarioResponse(
            id=model.id,
            name=model.name,
            description=model.description,
            status=model.status,
            objective=model.objective,
            work_order_ids=list(model.work_order_ids or []),
            constraints=SchedulingConstraints.model_validate(model.constraints or {}),
            metrics=model.metrics or {},
            result_snapshot=model.result_snapshot or {},
            published_at=model.published_at,
            published_by=model.published_by,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def list_scenarios(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
    ) -> SchedulingScenarioListResponse:
        query = SchedulingScenario.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        total = await query.count()
        rows = await query.order_by("-updated_at").offset(skip).limit(limit).all()
        return SchedulingScenarioListResponse(data=[self._to_response(r) for r in rows], total=total)

    async def get_scenario(self, tenant_id: int, scenario_id: int) -> SchedulingScenarioResponse:
        row = await SchedulingScenario.get_or_none(
            tenant_id=tenant_id,
            id=scenario_id,
            deleted_at__isnull=True,
        )
        if not row:
            raise NotFoundError(f"排程场景不存在: {scenario_id}")
        return self._to_response(row)

    async def create_scenario(
        self,
        tenant_id: int,
        payload: SchedulingScenarioCreate,
        created_by: int,
    ) -> SchedulingScenarioResponse:
        constraints = SchedulingConstraints.model_validate(payload.constraints.model_dump())
        row = await SchedulingScenario.create(
            tenant_id=tenant_id,
            name=payload.name,
            description=payload.description,
            status="draft",
            objective=payload.objective or constraints.optimize_objective,
            work_order_ids=self._normalize_work_order_ids(payload.work_order_ids),
            constraints=constraints.model_dump(),
            result_snapshot={},
            metrics={},
            created_by=created_by,
            updated_by=created_by,
        )
        return self._to_response(row)

    async def update_scenario(
        self,
        tenant_id: int,
        scenario_id: int,
        payload: SchedulingScenarioUpdate,
        updated_by: int,
    ) -> SchedulingScenarioResponse:
        row = await SchedulingScenario.get_or_none(
            tenant_id=tenant_id,
            id=scenario_id,
            deleted_at__isnull=True,
        )
        if not row:
            raise NotFoundError(f"排程场景不存在: {scenario_id}")

        update_data = payload.model_dump(exclude_unset=True)
        if "constraints" in update_data and update_data["constraints"] is not None:
            update_data["constraints"] = SchedulingConstraints.model_validate(
                update_data["constraints"]
            ).model_dump()
        if "work_order_ids" in update_data:
            update_data["work_order_ids"] = self._normalize_work_order_ids(update_data["work_order_ids"])
        for key, value in update_data.items():
            setattr(row, key, value)
        row.updated_by = updated_by
        await row.save()
        return self._to_response(row)

    async def run_scenario(
        self,
        tenant_id: int,
        scenario_id: int,
        updated_by: int,
        constraints_override: Optional[Dict[str, Any]] = None,
        apply_objective: Optional[str] = None,
    ) -> SchedulingScenarioResponse:
        row = await SchedulingScenario.get_or_none(
            tenant_id=tenant_id,
            id=scenario_id,
            deleted_at__isnull=True,
        )
        if not row:
            raise NotFoundError(f"排程场景不存在: {scenario_id}")

        base_constraints = SchedulingConstraints.model_validate(row.constraints or {})
        merged_constraints = base_constraints.model_dump()
        if constraints_override:
            merged_constraints.update(constraints_override)
        if apply_objective:
            merged_constraints["optimize_objective"] = apply_objective
        normalized_constraints = SchedulingConstraints.model_validate(merged_constraints).model_dump()

        result = await self._scheduler.intelligent_scheduling(
            tenant_id=tenant_id,
            work_order_ids=self._normalize_work_order_ids(row.work_order_ids),
            constraints=normalized_constraints,
            apply_results=False,
            updated_by=updated_by,
        )
        stats = result.get("statistics", {})
        metrics = {
            "scheduled_count": stats.get("scheduled_count", 0),
            "unscheduled_count": stats.get("unscheduled_count", 0),
            "scheduling_rate": stats.get("scheduling_rate", 0),
            "conflict_count": len(result.get("conflicts") or []),
            "run_at": datetime.now().isoformat(),
        }
        row.constraints = normalized_constraints
        row.objective = normalized_constraints.get("optimize_objective", row.objective)
        row.result_snapshot = result
        row.metrics = metrics
        row.status = "simulated"
        row.updated_by = updated_by
        await row.save()
        return self._to_response(row)

    async def publish_scenario(
        self,
        tenant_id: int,
        scenario_id: int,
        updated_by: int,
    ) -> SchedulingScenarioResponse:
        row = await SchedulingScenario.get_or_none(
            tenant_id=tenant_id,
            id=scenario_id,
            deleted_at__isnull=True,
        )
        if not row:
            raise NotFoundError(f"排程场景不存在: {scenario_id}")

        snapshot = row.result_snapshot or {}
        scheduled_orders = snapshot.get("scheduled_orders") or []
        if not scheduled_orders:
            raise NotFoundError("场景尚未运行或无可发布结果")

        async with in_transaction():
            await self._scheduler.apply_scheduling_results(
                tenant_id=tenant_id,
                results=scheduled_orders,
                updated_by=updated_by,
            )
            row.status = "published"
            row.published_at = datetime.now()
            row.published_by = updated_by
            row.updated_by = updated_by
            await row.save()
        return self._to_response(row)
