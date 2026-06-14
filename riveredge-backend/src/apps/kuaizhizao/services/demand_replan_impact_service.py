"""
需求重算影响分析服务

将变更事件转换为受影响对象集合（需求/需求计算/计划等），
并输出风险与审批建议，用于后续编排器决策。
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Set

from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_change_event import DemandChangeEvent
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.models.demand_impact_record import DemandImpactRecord
from apps.kuaizhizao.models.demand_item import DemandItem
from apps.kuaizhizao.models.production_plan import ProductionPlan
from apps.kuaizhizao.models.work_order import WorkOrder


class DemandReplanImpactService:
    """需求重算影响分析"""

    @staticmethod
    def _is_within_frozen_horizon(effective_at: datetime | None, frozen_days: int = 7) -> bool:
        if not effective_at:
            return False
        try:
            return (effective_at.date() - date.today()).days <= frozen_days
        except Exception:
            return False

    async def analyze_event(
        self,
        tenant_id: int,
        event: DemandChangeEvent,
    ) -> Dict[str, Any]:
        """执行影响分析并写入 DemandImpactRecord。"""
        await DemandImpactRecord.filter(tenant_id=tenant_id, event_id=event.id).delete()

        if event.source_type == "sales_order":
            result = await self._analyze_sales_order_change(tenant_id, event)
        elif event.source_type == "sales_forecast":
            result = await self._analyze_sales_forecast_change(tenant_id, event)
        elif event.source_type == "bom_change":
            result = await self._analyze_bom_change(tenant_id, event)
        elif event.source_type == "process_route_change":
            result = await self._analyze_process_route_change(tenant_id, event)
        else:
            result = {
                "records": [],
                "demand_ids": [],
                "computation_ids": [],
                "plan_ids": [],
                "material_ids": [],
            }

        for rec in result["records"]:
            await DemandImpactRecord.create(tenant_id=tenant_id, event_id=event.id, **rec)

        await DemandChangeEvent.filter(tenant_id=tenant_id, id=event.id).update(event_status="analyzed")
        return {
            "event_id": event.id,
            "impact_count": len(result["records"]),
            "demand_ids": result["demand_ids"],
            "computation_ids": result["computation_ids"],
            "plan_ids": result["plan_ids"],
            "material_ids": result["material_ids"],
        }

    async def _analyze_sales_order_change(self, tenant_id: int, event: DemandChangeEvent) -> Dict[str, Any]:
        demands = await Demand.filter(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id=event.source_id,
            deleted_at__isnull=True,
        ).all()
        return await self._build_common_result(
            tenant_id=tenant_id,
            event=event,
            demands=demands,
            reason="销售订单变更影响需求与需求计算",
            risk_level="medium",
        )

    async def _analyze_sales_forecast_change(self, tenant_id: int, event: DemandChangeEvent) -> Dict[str, Any]:
        demands = await Demand.filter(
            tenant_id=tenant_id,
            source_type="sales_forecast",
            source_id=event.source_id,
            deleted_at__isnull=True,
        ).all()
        return await self._build_common_result(
            tenant_id=tenant_id,
            event=event,
            demands=demands,
            reason="销售预测变更影响需求与需求计算",
            risk_level="low",
        )

    async def _analyze_bom_change(self, tenant_id: int, event: DemandChangeEvent) -> Dict[str, Any]:
        payload = event.payload or {}
        material_id = payload.get("material_id") or event.source_id
        demand_ids = set(
            await DemandItem.filter(
                tenant_id=tenant_id,
                material_id=material_id,
            ).values_list("demand_id", flat=True)
        )
        demands = []
        if demand_ids:
            demands = await Demand.filter(
                tenant_id=tenant_id,
                id__in=list(demand_ids),
                deleted_at__isnull=True,
            ).all()
        result = await self._build_common_result(
            tenant_id=tenant_id,
            event=event,
            demands=demands,
            reason="BOM变更影响物料需求展开结果",
            risk_level="high",
            extra_material_ids=[material_id] if material_id else [],
            force_approval=True,
        )
        return result

    async def _analyze_process_route_change(self, tenant_id: int, event: DemandChangeEvent) -> Dict[str, Any]:
        payload = event.payload or {}
        process_route_id = payload.get("process_route_id") or event.source_id
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            process_route_id=process_route_id,
            deleted_at__isnull=True,
        ).all()
        sales_order_ids = [int(wo.sales_order_id) for wo in work_orders if wo.sales_order_id]
        demands = []
        if sales_order_ids:
            demands = await Demand.filter(
                tenant_id=tenant_id,
                source_type="sales_order",
                source_id__in=sales_order_ids,
                deleted_at__isnull=True,
            ).all()
        return await self._build_common_result(
            tenant_id=tenant_id,
            event=event,
            demands=demands,
            reason="工艺路线变更影响工单与需求交期",
            risk_level="high",
            force_approval=True,
        )

    async def _build_common_result(
        self,
        tenant_id: int,
        event: DemandChangeEvent,
        demands: List[Demand],
        reason: str,
        risk_level: str,
        extra_material_ids: List[int] | None = None,
        force_approval: bool = False,
    ) -> Dict[str, Any]:
        frozen_hit = self._is_within_frozen_horizon(event.effective_at)
        needs_approval = force_approval or frozen_hit or risk_level in ("high",)

        demand_ids: Set[int] = {int(d.id) for d in demands}
        computation_ids: Set[int] = set()
        plan_ids: Set[int] = set()
        material_ids: Set[int] = set(extra_material_ids or [])
        records: List[Dict[str, Any]] = []

        for d in demands:
            records.append(
                {
                    "impact_type": "demand",
                    "impact_id": int(d.id),
                    "impact_code": d.demand_code,
                    "impact_scope": "direct",
                    "impact_reason": reason,
                    "impact_payload": {"source_type": d.source_type, "source_id": d.source_id},
                    "risk_level": risk_level,
                    "needs_approval": needs_approval,
                    "frozen_horizon_hit": frozen_hit,
                }
            )
            if d.computation_id:
                computation_ids.add(int(d.computation_id))

        if demand_ids:
            extra_computation_ids = await DemandComputation.filter(
                tenant_id=tenant_id,
                demand_id__in=list(demand_ids),
            ).values_list("id", flat=True)
            computation_ids.update(int(i) for i in extra_computation_ids)

            plan_rows = await ProductionPlan.filter(
                tenant_id=tenant_id,
                demand_id__in=list(demand_ids),
                deleted_at__isnull=True,
            ).values_list("id", "plan_code")
            for pid, pcode in plan_rows:
                plan_ids.add(int(pid))
                records.append(
                    {
                        "impact_type": "plan",
                        "impact_id": int(pid),
                        "impact_code": pcode,
                        "impact_scope": "transitive",
                        "impact_reason": "上游变更将影响计划可执行性，建议重算",
                        "impact_payload": {"demand_ids": list(demand_ids)},
                        "risk_level": "medium" if risk_level != "high" else "high",
                        "needs_approval": needs_approval,
                        "frozen_horizon_hit": frozen_hit,
                    }
                )

        if computation_ids:
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id__in=list(computation_ids),
            ).values_list("material_id", flat=True)
            material_ids.update(int(mid) for mid in items if mid)
            for cid, ccode in await DemandComputation.filter(
                tenant_id=tenant_id,
                id__in=list(computation_ids),
            ).values_list("id", "computation_code"):
                records.append(
                    {
                        "impact_type": "computation",
                        "impact_id": int(cid),
                        "impact_code": ccode,
                        "impact_scope": "direct",
                        "impact_reason": "需求计算输入已变化，建议重算",
                        "impact_payload": {"demand_ids": list(demand_ids)},
                        "risk_level": risk_level,
                        "needs_approval": needs_approval,
                        "frozen_horizon_hit": frozen_hit,
                    }
                )

        for mid in material_ids:
            records.append(
                {
                    "impact_type": "material",
                    "impact_id": int(mid),
                    "impact_code": str(mid),
                    "impact_scope": "transitive",
                    "impact_reason": "变更涉及物料主数据/结构，需刷新建议量",
                    "impact_payload": None,
                    "risk_level": risk_level,
                    "needs_approval": needs_approval,
                    "frozen_horizon_hit": frozen_hit,
                }
            )

        return {
            "records": records,
            "demand_ids": sorted(demand_ids),
            "computation_ids": sorted(computation_ids),
            "plan_ids": sorted(plan_ids),
            "material_ids": sorted(material_ids),
        }
