"""采购订单行影响总成解析（MRP/PR 溯源 + 工单组）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisitionItem
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.work_order_group import WorkOrderGroup
from apps.kuaizhizao.models.sales_order import SalesOrder


class PurchasePoLineImpactService:
    async def _resolve_dc_item_id(self, tenant_id: int, item: PurchaseOrderItem) -> Optional[int]:
        dc_item_id = getattr(item, "demand_computation_item_id", None)
        if dc_item_id:
            return int(dc_item_id)
        src_type = str(item.source_type or "").strip().lower().replace("_", "")
        if src_type in {"purchaserequisition", "purchasereq"} and item.source_id:
            pr_line = await PurchaseRequisitionItem.get_or_none(
                tenant_id=tenant_id, id=int(item.source_id)
            )
            if pr_line and pr_line.demand_computation_item_id:
                return int(pr_line.demand_computation_item_id)
        return None

    async def resolve_impact_summary(self, tenant_id: int, item: PurchaseOrderItem) -> str:
        dc_item_id = await self._resolve_dc_item_id(tenant_id, item)
        if not dc_item_id:
            return ""
        dc_item = await DemandComputationItem.get_or_none(
            tenant_id=tenant_id, id=dc_item_id
        )
        if not dc_item:
            return ""

        parts: List[str] = []
        computation_id = int(dc_item.computation_id)

        groups = await WorkOrderGroup.filter(
            tenant_id=tenant_id,
            demand_computation_id=computation_id,
            deleted_at__isnull=True,
        ).limit(5).values("root_material_code", "root_material_name", "sales_order_id")
        for g in groups:
            label = str(g.get("root_material_name") or g.get("root_material_code") or "").strip()
            so_id = g.get("sales_order_id")
            if so_id:
                so = await SalesOrder.get_or_none(tenant_id=tenant_id, id=int(so_id), deleted_at__isnull=True)
                if so and so.order_code:
                    label = f"{label} ({so.order_code})" if label else str(so.order_code)
            if label:
                parts.append(label)

        if not parts and dc_item.demand_item_ids:
            demand_ids = dc_item.demand_item_ids if isinstance(dc_item.demand_item_ids, list) else []
            for did in demand_ids[:3]:
                try:
                    demand = await Demand.get_or_none(tenant_id=tenant_id, id=int(did), deleted_at__isnull=True)
                except (TypeError, ValueError):
                    continue
                if not demand:
                    continue
                src = str(demand.source_type or "").lower()
                if "sales" in src and demand.source_id:
                    so = await SalesOrder.get_or_none(
                        tenant_id=tenant_id, id=int(demand.source_id), deleted_at__isnull=True
                    )
                    if so:
                        parts.append(str(so.order_code or so.customer_name or ""))
                elif demand.project_name:
                    parts.append(str(demand.project_name))

        return "；".join([p for p in parts if p][:3])

    async def batch_resolve_impact_summaries(
        self, tenant_id: int, items: List[PurchaseOrderItem]
    ) -> Dict[int, str]:
        out: Dict[int, str] = {}
        for item in items:
            if item.id is None:
                continue
            summary = await self.resolve_impact_summary(tenant_id, item)
            if summary:
                out[int(item.id)] = summary
        return out
