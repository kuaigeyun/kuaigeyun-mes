"""
库存成本服务：移动加权平均、出库成本、成品入库成本结转。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from loguru import logger

from infra.exceptions.exceptions import ValidationError

from apps.master_data.models.material import Material
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaicaiwu.models.cost_calculation import CostCalculation
from apps.kuaizhizao.utils.inventory_helper import get_material_inventory_info


class InventoryCostService:
    """移动加权平均与出入库成本核算。"""

    @staticmethod
    def _decimal(value: Any) -> Decimal:
        try:
            return Decimal(str(value or 0))
        except Exception:
            return Decimal("0")

    @staticmethod
    def _read_defaults_cost(defaults: Any, *keys: str) -> Optional[Decimal]:
        if not isinstance(defaults, dict):
            return None
        for key in keys:
            raw = defaults.get(key)
            if raw in (None, ""):
                continue
            try:
                val = Decimal(str(raw))
                # 0 视为未维护，继续试下一候选（避免有采购价却被 0 的移动平均挡死）
                if val > 0:
                    return val
            except Exception:
                continue
        purchase = defaults.get("purchase") if isinstance(defaults.get("purchase"), dict) else {}
        for key in (
            "standard_price",
            "purchase_price",
            "default_purchase_price",
            "defaultPurchasePrice",
        ):
            raw = purchase.get(key)
            if raw in (None, ""):
                continue
            try:
                val = Decimal(str(raw))
                if val > 0:
                    return val
            except Exception:
                continue
        for key in ("default_purchase_price", "defaultPurchasePrice"):
            raw = defaults.get(key)
            if raw in (None, ""):
                continue
            try:
                val = Decimal(str(raw))
                if val > 0:
                    return val
            except Exception:
                continue
        return None

    @staticmethod
    def _read_source_config_purchase_price(source_config: Any) -> Optional[Decimal]:
        if not isinstance(source_config, dict):
            return None
        for key in ("purchase_price", "standard_price", "default_purchase_price"):
            raw = source_config.get(key)
            if raw in (None, ""):
                continue
            try:
                val = Decimal(str(raw))
                if val > 0:
                    return val
            except Exception:
                continue
        return None

    async def get_material_unit_cost(self, tenant_id: int, material_id: int) -> Optional[Decimal]:
        """移动加权 → 标准成本 → 采购价（含 defaults.purchase / source_config）；全部缺失返回 None。"""
        material = await Material.get_or_none(
            tenant_id=tenant_id, id=material_id, deleted_at__isnull=True
        )
        if not material:
            return None
        from_defaults = self._read_defaults_cost(
            material.defaults,
            "moving_average_cost",
            "standard_cost",
            "purchase_price",
        )
        if from_defaults is not None:
            return from_defaults
        return self._read_source_config_purchase_price(getattr(material, "source_config", None))

    async def get_material_unit_cost_or_zero(self, tenant_id: int, material_id: int) -> Decimal:
        """库存计价内部使用：无单价时按 0 处理。"""
        cost = await self.get_material_unit_cost(tenant_id, material_id)
        return cost if cost is not None else Decimal("0")

    async def require_material_unit_cost(self, tenant_id: int, material_id: int) -> Decimal:
        cost = await self.get_material_unit_cost(tenant_id, material_id)
        if cost is not None:
            return cost
        material = await Material.get_or_none(
            tenant_id=tenant_id, id=material_id, deleted_at__isnull=True
        )
        if material:
            code = (material.main_code or material.code or "").strip()
            name = (material.name or "").strip()
            label = f"{code} {name}".strip() or str(material_id)
        else:
            label = str(material_id)
        raise ValidationError(
            f"物料 {label} 无可用单价，请维护标准成本或完成一次采购入库"
        )

    async def _persist_moving_average_cost(
        self,
        tenant_id: int,
        material_id: int,
        new_avg: Decimal,
    ) -> None:
        material = await Material.get_or_none(
            tenant_id=tenant_id, id=material_id, deleted_at__isnull=True
        )
        if not material:
            return
        defaults = dict(material.defaults or {})
        defaults["moving_average_cost"] = float(new_avg.quantize(Decimal("0.0001")))
        material.defaults = defaults
        await material.save(update_fields=["defaults", "updated_at"])

    async def update_moving_average_cost(
        self,
        tenant_id: int,
        material_id: int,
        inbound_qty: Decimal,
        inbound_unit_price: Decimal,
    ) -> Decimal:
        """采购/入库确认后更新物料移动加权平均成本。"""
        inbound_qty = self._decimal(inbound_qty)
        inbound_unit_price = self._decimal(inbound_unit_price)
        if inbound_qty <= 0:
            return await self.get_material_unit_cost_or_zero(tenant_id, material_id)

        info = await get_material_inventory_info(tenant_id=tenant_id, material_id=material_id)
        on_hand = self._decimal(info.get("on_hand") or info.get("total_quantity"))
        prior_qty = max(on_hand - inbound_qty, Decimal("0"))
        prior_avg = await self.get_material_unit_cost_or_zero(tenant_id, material_id)

        if prior_qty <= 0:
            new_avg = inbound_unit_price
        else:
            new_avg = (prior_qty * prior_avg + inbound_qty * inbound_unit_price) / (prior_qty + inbound_qty)

        await self._persist_moving_average_cost(tenant_id, material_id, new_avg)
        return new_avg.quantize(Decimal("0.0001"))

    async def on_purchase_return_confirmed(self, tenant_id: int, return_id: int) -> None:
        """采购退货出库：按当前移动平均价写入明细出库成本（均价不变）。"""
        from apps.kuaizhizao.models.purchase_return_item import PurchaseReturnItem

        items = await PurchaseReturnItem.filter(
            tenant_id=tenant_id, return_id=return_id
        ).all()
        for item in items:
            qty = self._decimal(item.return_quantity)
            if qty <= 0:
                continue
            material_id = int(item.material_id)
            unit_cost = await self.get_material_unit_cost_or_zero(tenant_id, material_id)
            if unit_cost <= 0:
                unit_cost = self._decimal(item.unit_price)
            item.unit_price = unit_cost
            item.total_amount = (qty * unit_cost).quantize(Decimal("0.01"))
            await item.save(update_fields=["unit_price", "total_amount", "updated_at"])

    async def on_sales_return_confirmed(self, tenant_id: int, return_id: int) -> None:
        """销售退货入库：按退货单价或当前均价回写移动加权平均。"""
        from apps.kuaizhizao.models.sales_return_item import SalesReturnItem

        items = await SalesReturnItem.filter(
            tenant_id=tenant_id, return_id=return_id
        ).all()
        for item in items:
            qty = self._decimal(item.return_quantity)
            if qty <= 0:
                continue
            unit_price = self._decimal(item.unit_price)
            if unit_price <= 0:
                unit_price = await self.get_material_unit_cost_or_zero(tenant_id, int(item.material_id))
            try:
                await self.update_moving_average_cost(
                    tenant_id=tenant_id,
                    material_id=int(item.material_id),
                    inbound_qty=qty,
                    inbound_unit_price=unit_price,
                )
            except Exception as exc:
                logger.warning(
                    "销售退货移动平均成本更新失败 return={} material={}: {}",
                    return_id,
                    item.material_id,
                    exc,
                )

    async def on_purchase_receipt_confirmed(self, tenant_id: int, receipt_id: int) -> None:
        items = await PurchaseReceiptItem.filter(
            tenant_id=tenant_id, receipt_id=receipt_id
        ).all()
        for item in items:
            qty = self._decimal(item.receipt_quantity)
            if qty <= 0:
                continue
            unit_price = self._decimal(item.unit_price)
            try:
                await self.update_moving_average_cost(
                    tenant_id=tenant_id,
                    material_id=int(item.material_id),
                    inbound_qty=qty,
                    inbound_unit_price=unit_price,
                )
            except Exception as exc:
                logger.warning(
                    "采购入库移动平均成本更新失败 receipt={} material={}: {}",
                    receipt_id,
                    item.material_id,
                    exc,
                )
                raise

    async def resolve_outbound_unit_cost(self, tenant_id: int, material_id: int) -> Decimal:
        """销售出库确认时取当前移动平均/标准成本作为出库单位成本。"""
        return await self.get_material_unit_cost_or_zero(tenant_id, material_id)

    async def apply_sales_delivery_outbound_costs(
        self,
        tenant_id: int,
        delivery_items: List[SalesDeliveryItem],
    ) -> Dict[int, Decimal]:
        """为出库明细写入 unit_cost 并返回 material_id -> unit_cost。"""
        costs: Dict[int, Decimal] = {}
        for line in delivery_items:
            qty = self._decimal(line.delivery_quantity)
            if qty <= 0:
                continue
            unit_cost = await self.resolve_outbound_unit_cost(tenant_id, int(line.material_id))
            line.unit_cost = unit_cost
            await line.save(update_fields=["unit_cost", "updated_at"])
            costs[int(line.material_id)] = unit_cost
        return costs

    async def apply_other_outbound_costs(
        self,
        tenant_id: int,
        outbound_items: List[Any],
    ) -> None:
        """其他出库确认：按移动平均写入明细 unit_price（均价不变）。"""
        for line in outbound_items:
            qty = self._decimal(line.outbound_quantity)
            if qty <= 0:
                continue
            unit_cost = await self.resolve_outbound_unit_cost(tenant_id, int(line.material_id))
            line.unit_price = unit_cost
            line.total_amount = (qty * unit_cost).quantize(Decimal("0.01"))
            await line.save(update_fields=["unit_price", "total_amount", "updated_at"])

    async def compute_work_order_unit_cost(self, tenant_id: int, work_order_id: int) -> Decimal:
        """基于最新工单成本核算或领料实际成本估算单位成本。"""
        latest = await CostCalculation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            calculation_type="工单成本",
            deleted_at__isnull=True,
        ).order_by("-created_at").first()
        if latest and latest.unit_cost and self._decimal(latest.unit_cost) > 0:
            return self._decimal(latest.unit_cost)

        wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True)
        if not wo:
            return Decimal("0")

        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            status__in=("已确认", "已完成"),
            deleted_at__isnull=True,
        ).all()
        material_cost = Decimal("0")
        for picking in pickings:
            items = await ProductionPickingItem.filter(
                tenant_id=tenant_id, picking_id=picking.id, deleted_at__isnull=True
            ).all()
            for item in items:
                qty = self._decimal(item.picked_quantity)
                if qty <= 0:
                    continue
                unit = await self.get_material_unit_cost_or_zero(tenant_id, int(item.material_id))
                material_cost += qty * unit

        qty = self._decimal(wo.quantity)
        if qty <= 0:
            return Decimal("0")
        return (material_cost / qty).quantize(Decimal("0.0001"))

    async def apply_finished_goods_receipt_cost(
        self,
        tenant_id: int,
        receipt_id: int,
        work_order_id: Optional[int],
    ) -> Optional[Decimal]:
        """成品入库确认：按工单单位成本写入明细 unit_cost 并更新成品移动平均。"""
        from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem

        if not work_order_id:
            return None

        unit_cost = await self.compute_work_order_unit_cost(tenant_id, int(work_order_id))
        if unit_cost <= 0:
            return None

        items = await FinishedGoodsReceiptItem.filter(
            tenant_id=tenant_id, receipt_id=receipt_id
        ).all()
        total_inbound = Decimal("0")
        for item in items:
            qty = self._decimal(item.receipt_quantity or item.qualified_quantity)
            if qty <= 0:
                continue
            item.unit_cost = unit_cost
            await item.save(update_fields=["unit_cost", "updated_at"])
            total_inbound += qty
            try:
                await self.update_moving_average_cost(
                    tenant_id=tenant_id,
                    material_id=int(item.material_id),
                    inbound_qty=qty,
                    inbound_unit_price=unit_cost,
                )
            except Exception as exc:
                logger.warning(
                    "成品入库成本结转失败 receipt={} material={}: {}",
                    receipt_id,
                    item.material_id,
                    exc,
                )
        return unit_cost if total_inbound > 0 else None

    async def on_other_inbound_confirmed(self, tenant_id: int, inbound_id: int) -> None:
        """其他入库确认：按明细单价更新移动加权平均。"""
        from apps.kuaizhizao.models.other_inbound_item import OtherInboundItem

        items = await OtherInboundItem.filter(
            tenant_id=tenant_id, inbound_id=inbound_id
        ).all()
        for item in items:
            qty = self._decimal(item.inbound_quantity)
            if qty <= 0:
                continue
            unit_price = self._decimal(item.unit_price)
            if unit_price <= 0:
                unit_price = await self.get_material_unit_cost_or_zero(tenant_id, int(item.material_id))
            try:
                await self.update_moving_average_cost(
                    tenant_id=tenant_id,
                    material_id=int(item.material_id),
                    inbound_qty=qty,
                    inbound_unit_price=unit_price,
                )
            except Exception as exc:
                logger.warning(
                    "其他入库移动平均成本更新失败 inbound={} material={}: {}",
                    inbound_id,
                    item.material_id,
                    exc,
                )

    async def on_stocktaking_difference_adjusted(
        self,
        tenant_id: int,
        *,
        material_id: int,
        difference_quantity: Decimal,
        unit_price: Decimal,
    ) -> None:
        """盘点差异调整：盘盈按单价/当前均价回写移动平均；盘亏不改变均价。"""
        diff = self._decimal(difference_quantity)
        if diff <= 0:
            return
        price = self._decimal(unit_price)
        if price <= 0:
            price = await self.get_material_unit_cost_or_zero(tenant_id, material_id)
        try:
            await self.update_moving_average_cost(
                tenant_id=tenant_id,
                material_id=material_id,
                inbound_qty=diff,
                inbound_unit_price=price,
            )
        except Exception as exc:
            logger.warning(
                "盘点盘盈成本回写失败 material={} qty={}: {}",
                material_id,
                diff,
                exc,
            )
