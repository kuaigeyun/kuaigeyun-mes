"""采购订单行影响总成解析（MRP/PR 溯源 + 工单组 + 销售需求明细）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisitionItem
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.models.demand_item import DemandItem
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.work_order_group import WorkOrderGroup
from apps.kuaizhizao.models.sales_order import SalesOrder


def _norm_source_key(raw: Any) -> str:
    return str(raw or "").strip().lower().replace("_", "").replace("-", "")


class PurchasePoLineImpactService:
    async def _resolve_dc_item_id(self, tenant_id: int, item: PurchaseOrderItem) -> Optional[int]:
        dc_item_id = getattr(item, "demand_computation_item_id", None)
        if dc_item_id:
            return int(dc_item_id)
        src_type = _norm_source_key(item.source_type)
        if src_type in {"purchaserequisition", "purchasereq"} and item.source_id:
            pr_line = await PurchaseRequisitionItem.get_or_none(
                tenant_id=tenant_id, id=int(item.source_id)
            )
            if pr_line and pr_line.demand_computation_item_id:
                return int(pr_line.demand_computation_item_id)
        # 需求计算直推采购且历史行未写 demand_computation_item_id：按计算头+物料回查
        if src_type in {"demandcomputation", "demandcomp"} and item.source_id and item.material_id:
            dc_item = (
                await DemandComputationItem.filter(
                    tenant_id=tenant_id,
                    computation_id=int(item.source_id),
                    material_id=int(item.material_id),
                )
                .order_by("id")
                .first()
            )
            if dc_item and dc_item.id is not None:
                return int(dc_item.id)
        return None

    def _label_with_so(self, assembly: str, order_code: Optional[str]) -> str:
        assembly = (assembly or "").strip()
        code = (order_code or "").strip()
        if assembly and code:
            return f"{assembly} ({code})"
        return assembly or code

    async def _labels_from_work_order_groups(
        self, tenant_id: int, computation_id: int
    ) -> List[str]:
        parts: List[str] = []
        groups = (
            await WorkOrderGroup.filter(
                tenant_id=tenant_id,
                demand_computation_id=computation_id,
                deleted_at__isnull=True,
            )
            .limit(5)
            .values("root_material_code", "root_material_name", "sales_order_id")
        )
        so_ids = {
            int(g["sales_order_id"])
            for g in groups
            if g.get("sales_order_id") is not None
        }
        so_by_id: Dict[int, SalesOrder] = {}
        if so_ids:
            sos = await SalesOrder.filter(
                tenant_id=tenant_id, id__in=list(so_ids), deleted_at__isnull=True
            ).all()
            so_by_id = {int(s.id): s for s in sos}

        for g in groups:
            label = str(g.get("root_material_name") or g.get("root_material_code") or "").strip()
            so_id = g.get("sales_order_id")
            so_code = None
            if so_id is not None:
                so = so_by_id.get(int(so_id))
                if so:
                    so_code = so.order_code
            text = self._label_with_so(label, so_code)
            if text:
                parts.append(text)
        return parts

    async def _labels_from_demand_items(
        self, tenant_id: int, demand_item_ids: List[Any]
    ) -> List[str]:
        """
        demand_item_ids 真源是 DemandItem.id（销售/预测需求明细），不是 Demand.id。
        销售订单下推采购件时，这些明细物料即影响总成（成品）。
        """
        ids: List[int] = []
        for raw in demand_item_ids:
            try:
                ids.append(int(raw))
            except (TypeError, ValueError):
                continue
        if not ids:
            return []

        di_rows = (
            await DemandItem.filter(tenant_id=tenant_id, id__in=ids[:20])
            .order_by("id")
            .all()
        )
        if not di_rows:
            return []

        demand_ids = {int(di.demand_id) for di in di_rows if di.demand_id is not None}
        demand_by_id: Dict[int, Demand] = {}
        if demand_ids:
            demands = await Demand.filter(
                tenant_id=tenant_id, id__in=list(demand_ids), deleted_at__isnull=True
            ).all()
            demand_by_id = {int(d.id): d for d in demands}

        so_ids: Set[int] = set()
        for d in demand_by_id.values():
            src = _norm_source_key(d.source_type)
            if "sales" in src and d.source_id:
                try:
                    so_ids.add(int(d.source_id))
                except (TypeError, ValueError):
                    continue
        so_by_id: Dict[int, SalesOrder] = {}
        if so_ids:
            sos = await SalesOrder.filter(
                tenant_id=tenant_id, id__in=list(so_ids), deleted_at__isnull=True
            ).all()
            so_by_id = {int(s.id): s for s in sos}

        parts: List[str] = []
        seen: Set[str] = set()
        for di in di_rows:
            assembly = str(di.material_name or di.material_code or "").strip()
            demand = demand_by_id.get(int(di.demand_id)) if di.demand_id is not None else None
            so_code = None
            project = None
            if demand:
                src = _norm_source_key(demand.source_type)
                if "sales" in src and demand.source_id:
                    so = so_by_id.get(int(demand.source_id))
                    if so:
                        so_code = so.order_code
                project = getattr(demand, "project_name", None)
            text = self._label_with_so(assembly, so_code)
            if not text and project:
                text = str(project).strip()
            if text and text not in seen:
                seen.add(text)
                parts.append(text)
            if len(parts) >= 3:
                break
        return parts

    async def _labels_from_computation_demand(
        self, tenant_id: int, computation_id: int
    ) -> List[str]:
        """无 demand_item_ids / 工单组时，回落到计算头关联的销售需求。"""
        computation = await DemandComputation.get_or_none(
            tenant_id=tenant_id, id=computation_id, deleted_at__isnull=True
        )
        if not computation:
            return []

        demand_ids: List[int] = []
        if computation.demand_id:
            demand_ids.append(int(computation.demand_id))
        raw_ids = computation.demand_ids if isinstance(computation.demand_ids, list) else []
        for raw in raw_ids:
            try:
                did = int(raw)
            except (TypeError, ValueError):
                continue
            if did not in demand_ids:
                demand_ids.append(did)
        if not demand_ids:
            return []

        demands = await Demand.filter(
            tenant_id=tenant_id, id__in=demand_ids[:5], deleted_at__isnull=True
        ).all()
        if not demands:
            return []

        so_ids = []
        for d in demands:
            src = _norm_source_key(d.source_type)
            if "sales" in src and d.source_id:
                try:
                    so_ids.append(int(d.source_id))
                except (TypeError, ValueError):
                    continue
        so_by_id: Dict[int, SalesOrder] = {}
        if so_ids:
            sos = await SalesOrder.filter(
                tenant_id=tenant_id, id__in=so_ids, deleted_at__isnull=True
            ).all()
            so_by_id = {int(s.id): s for s in sos}

        # 用需求头下成品明细作总成名
        di_rows = (
            await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id__in=[int(d.id) for d in demands],
            )
            .order_by("id")
            .limit(10)
            .all()
        )
        parts: List[str] = []
        seen: Set[str] = set()
        demand_by_id = {int(d.id): d for d in demands}
        for di in di_rows:
            demand = demand_by_id.get(int(di.demand_id))
            so_code = None
            if demand and demand.source_id:
                so = so_by_id.get(int(demand.source_id))
                if so:
                    so_code = so.order_code
            text = self._label_with_so(
                str(di.material_name or di.material_code or "").strip(), so_code
            )
            if text and text not in seen:
                seen.add(text)
                parts.append(text)
            if len(parts) >= 3:
                break
        if parts:
            return parts

        # 仅有销售单号时仍展示
        for d in demands:
            if d.source_id:
                so = so_by_id.get(int(d.source_id))
                if so and so.order_code:
                    return [str(so.order_code)]
            if getattr(d, "project_name", None):
                return [str(d.project_name)]
        return []

    async def resolve_impact_summary(self, tenant_id: int, item: PurchaseOrderItem) -> str:
        dc_item_id = await self._resolve_dc_item_id(tenant_id, item)
        if not dc_item_id:
            return ""
        dc_item = await DemandComputationItem.get_or_none(
            tenant_id=tenant_id, id=dc_item_id
        )
        if not dc_item:
            return ""

        computation_id = int(dc_item.computation_id)
        parts = await self._labels_from_work_order_groups(tenant_id, computation_id)

        if not parts:
            demand_item_ids = (
                dc_item.demand_item_ids if isinstance(dc_item.demand_item_ids, list) else []
            )
            parts = await self._labels_from_demand_items(tenant_id, demand_item_ids)

        if not parts:
            parts = await self._labels_from_computation_demand(tenant_id, computation_id)

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
