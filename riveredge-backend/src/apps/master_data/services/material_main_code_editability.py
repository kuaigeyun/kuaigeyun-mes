"""
物料主编号可编辑性（唯一路径）

规则：同一 main_code 家族内任一物料被 BOM / 批次 / 业务单据引用 → 主编号不可改。
无引用时允许改主编号（改时同步整族 main_code，且 code==旧主编号的行同步 code）。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Tuple, Type

from tortoise import Model

from apps.master_data.models.material import BOM, Material
from apps.master_data.models.material_batch import MaterialBatch


async def family_material_ids(tenant_id: int, material: Material) -> List[int]:
    main = (material.main_code or "").strip()
    if not main:
        return [material.id]
    ids = await Material.filter(
        tenant_id=tenant_id,
        main_code=main,
        deleted_at__isnull=True,
    ).values_list("id", flat=True)
    return list(ids) if ids else [material.id]


async def _count_material_refs(
    model: Type[Model],
    *,
    tenant_id: int,
    material_ids: Sequence[int],
    material_field: str = "material_id",
    require_tenant: bool = True,
) -> int:
    fields_map = getattr(getattr(model, "_meta", None), "fields_map", {}) or {}
    if material_field not in fields_map:
        return 0
    filters: Dict[str, Any] = {f"{material_field}__in": list(material_ids)}
    if require_tenant and "tenant_id" in fields_map:
        filters["tenant_id"] = tenant_id
    if "deleted_at" in fields_map:
        filters["deleted_at__isnull"] = True
    return int(await model.filter(**filters).count())


def _doc_ref_specs() -> List[Tuple[str, str, Any, str]]:
    """
    (key, label, lazy_model_loader, material_field)
    lazy_model_loader 返回 Model 类，避免模块级循环导入。
    """

    def sales_order_item():
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

        return SalesOrderItem

    def purchase_order_item():
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

        return PurchaseOrderItem

    def quotation_item():
        from apps.kuaizhizao.models.quotation_item import QuotationItem

        return QuotationItem

    def sales_contract_item():
        from apps.kuaizhizao.models.sales_contract_item import SalesContractItem

        return SalesContractItem

    def sales_forecast_item():
        from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem

        return SalesForecastItem

    def demand_item():
        from apps.kuaizhizao.models.demand_item import DemandItem

        return DemandItem

    def demand_computation_item():
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem

        return DemandComputationItem

    def purchase_requisition_item():
        from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisitionItem

        return PurchaseRequisitionItem

    def sales_delivery_item():
        from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem

        return SalesDeliveryItem

    def purchase_receipt_item():
        from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem

        return PurchaseReceiptItem

    def purchase_return_item():
        from apps.kuaizhizao.models.purchase_return_item import PurchaseReturnItem

        return PurchaseReturnItem

    def sales_return_item():
        from apps.kuaizhizao.models.sales_return_item import SalesReturnItem

        return SalesReturnItem

    def shipment_notice_item():
        from apps.kuaizhizao.models.shipment_notice_item import ShipmentNoticeItem

        return ShipmentNoticeItem

    def receipt_notice_item():
        from apps.kuaizhizao.models.receipt_notice_item import ReceiptNoticeItem

        return ReceiptNoticeItem

    def delivery_notice_item():
        from apps.kuaizhizao.models.delivery_notice_item import DeliveryNoticeItem

        return DeliveryNoticeItem

    def production_picking_item():
        from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem

        return ProductionPickingItem

    def production_return_item():
        from apps.kuaizhizao.models.production_return_item import ProductionReturnItem

        return ProductionReturnItem

    def finished_goods_receipt_item():
        from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem

        return FinishedGoodsReceiptItem

    def semi_finished_goods_receipt_item():
        from apps.kuaizhizao.models.semi_finished_goods_receipt_item import (
            SemiFinishedGoodsReceiptItem,
        )

        return SemiFinishedGoodsReceiptItem

    def other_outbound_item():
        from apps.kuaizhizao.models.other_outbound_item import OtherOutboundItem

        return OtherOutboundItem

    def other_inbound_item():
        from apps.kuaizhizao.models.other_inbound_item import OtherInboundItem

        return OtherInboundItem

    def material_return_item():
        from apps.kuaizhizao.models.material_return_item import MaterialReturnItem

        return MaterialReturnItem

    def material_borrow_item():
        from apps.kuaizhizao.models.material_borrow_item import MaterialBorrowItem

        return MaterialBorrowItem

    def material_call_request_item():
        from apps.kuaizhizao.models.material_call_request_item import MaterialCallRequestItem

        return MaterialCallRequestItem

    def inventory_transfer_item():
        from apps.kuaizhizao.models.inventory_transfer import InventoryTransferItem

        return InventoryTransferItem

    def stocktaking_item():
        from apps.kuaizhizao.models.stocktaking import StocktakingItem

        return StocktakingItem

    def material_stock_movement():
        from apps.kuaizhizao.models.material_stock_movement import MaterialStockMovement

        return MaterialStockMovement

    def incoming_inspection():
        from apps.kuaizhizao.models.incoming_inspection import IncomingInspection

        return IncomingInspection

    def process_inspection():
        from apps.kuaizhizao.models.process_inspection import ProcessInspection

        return ProcessInspection

    def finished_goods_inspection():
        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

        return FinishedGoodsInspection

    def oqc_inspection():
        from apps.kuaizhizao.models.oqc_inspection import OQCInspection

        return OQCInspection

    def work_order():
        from apps.kuaizhizao.models.work_order import WorkOrder

        return WorkOrder

    def production_plan_item():
        from apps.kuaizhizao.models.production_plan_item import ProductionPlanItem

        return ProductionPlanItem

    def batching_order_item():
        from apps.kuaizhizao.models.batching_order import BatchingOrderItem

        return BatchingOrderItem

    def assembly_order():
        from apps.kuaizhizao.models.assembly_order import AssemblyOrder

        return AssemblyOrder

    def assembly_order_item():
        from apps.kuaizhizao.models.assembly_order import AssemblyOrderItem

        return AssemblyOrderItem

    def disassembly_order():
        from apps.kuaizhizao.models.disassembly_order import DisassemblyOrder

        return DisassemblyOrder

    def disassembly_order_item():
        from apps.kuaizhizao.models.disassembly_order import DisassemblyOrderItem

        return DisassemblyOrderItem

    return [
        ("sales_order", "销售订单", sales_order_item, "material_id"),
        ("purchase_order", "采购订单", purchase_order_item, "material_id"),
        ("quotation", "报价单", quotation_item, "material_id"),
        ("sales_contract", "销售合同", sales_contract_item, "material_id"),
        ("sales_forecast", "销售预测", sales_forecast_item, "material_id"),
        ("demand", "需求", demand_item, "material_id"),
        ("demand_computation", "需求计算", demand_computation_item, "material_id"),
        ("purchase_requisition", "采购申请", purchase_requisition_item, "material_id"),
        ("sales_delivery", "销售出库", sales_delivery_item, "material_id"),
        ("purchase_receipt", "采购入库", purchase_receipt_item, "material_id"),
        ("purchase_return", "采购退货", purchase_return_item, "material_id"),
        ("sales_return", "销售退货", sales_return_item, "material_id"),
        ("shipment_notice", "发货通知", shipment_notice_item, "material_id"),
        ("receipt_notice", "收货通知", receipt_notice_item, "material_id"),
        ("delivery_notice", "交货通知", delivery_notice_item, "material_id"),
        ("production_picking", "生产领料", production_picking_item, "material_id"),
        ("production_return", "生产退料", production_return_item, "material_id"),
        ("finished_goods_receipt", "成品入库", finished_goods_receipt_item, "material_id"),
        ("semi_finished_goods_receipt", "半成品入库", semi_finished_goods_receipt_item, "material_id"),
        ("other_outbound", "其他出库", other_outbound_item, "material_id"),
        ("other_inbound", "其他入库", other_inbound_item, "material_id"),
        ("material_return", "退料", material_return_item, "material_id"),
        ("material_borrow", "借料", material_borrow_item, "material_id"),
        ("material_call_request", "叫料", material_call_request_item, "material_id"),
        ("inventory_transfer", "库存调拨", inventory_transfer_item, "material_id"),
        ("stocktaking", "盘点", stocktaking_item, "material_id"),
        ("material_stock_movement", "库存流水", material_stock_movement, "material_id"),
        ("incoming_inspection", "来料检验", incoming_inspection, "material_id"),
        ("process_inspection", "过程检验", process_inspection, "material_id"),
        ("finished_goods_inspection", "成品检验", finished_goods_inspection, "material_id"),
        ("oqc_inspection", "出货检验", oqc_inspection, "material_id"),
        ("work_order", "工单", work_order, "product_id"),
        ("production_plan", "生产计划", production_plan_item, "material_id"),
        ("batching_order", "配料单", batching_order_item, "material_id"),
        ("assembly_order", "组装单", assembly_order, "product_material_id"),
        ("assembly_order_item", "组装单明细", assembly_order_item, "material_id"),
        ("disassembly_order", "拆卸单", disassembly_order, "product_material_id"),
        ("disassembly_order_item", "拆卸单明细", disassembly_order_item, "material_id"),
    ]


async def summarize_material_main_code_blockers(
    tenant_id: int,
    material: Material,
    *,
    stop_on_first: bool = False,
) -> Dict[str, Any]:
    """
    汇总主编号锁定原因。

    Returns:
        {
          "editable": bool,
          "items": [{"key": str, "label": str, "count": int}, ...],
          "total": int,
        }
    """
    material_ids = await family_material_ids(tenant_id, material)
    items: List[Dict[str, Any]] = []
    total = 0

    bom_parent = await BOM.filter(
        tenant_id=tenant_id,
        material_id__in=material_ids,
        deleted_at__isnull=True,
    ).count()
    bom_child = await BOM.filter(
        tenant_id=tenant_id,
        component_id__in=material_ids,
        deleted_at__isnull=True,
    ).count()
    bom_count = int(bom_parent) + int(bom_child)
    if bom_count > 0:
        items.append({"key": "bom", "label": "BOM", "count": bom_count})
        total += bom_count
        if stop_on_first:
            return {"editable": False, "items": items, "total": total}

    batch_count = await MaterialBatch.filter(
        tenant_id=tenant_id,
        material_id__in=material_ids,
        deleted_at__isnull=True,
    ).count()
    if batch_count > 0:
        items.append({"key": "material_batch", "label": "物料批次", "count": int(batch_count)})
        total += int(batch_count)
        if stop_on_first:
            return {"editable": False, "items": items, "total": total}

    for key, label, loader, field in _doc_ref_specs():
        try:
            model = loader()
        except Exception:
            continue
        count = await _count_material_refs(
            model,
            tenant_id=tenant_id,
            material_ids=material_ids,
            material_field=field,
        )
        if count <= 0:
            continue
        items.append({"key": key, "label": label, "count": count})
        total += count
        if stop_on_first:
            return {"editable": False, "items": items, "total": total}

    items.sort(key=lambda x: (-x["count"], x["label"]))
    return {"editable": total <= 0, "items": items, "total": total}


async def is_material_main_code_editable(tenant_id: int, material: Material) -> bool:
    summary = await summarize_material_main_code_blockers(
        tenant_id, material, stop_on_first=True
    )
    return bool(summary.get("editable"))


def format_main_code_locked_message(summary: Dict[str, Any]) -> str:
    items = summary.get("items") or []
    if not items:
        return "该物料已被业务引用，主编号不可修改"
    top = items[:5]
    labels = [str(it.get("label") or "").strip() for it in top if str(it.get("label") or "").strip()]
    text = "、".join(labels)
    if len(items) > 5:
        text = f"{text} 等"
    return f"该物料已被业务引用（{text}），主编号不可修改"


async def apply_family_main_code_change(
    tenant_id: int,
    material: Material,
    new_main_code: str,
    *,
    current_user: Optional[Any] = None,
) -> None:
    """
    将同一旧 main_code 家族全部改为 new_main_code；
    若行的 code 等于旧主编号，同步改为新主编号（SKU 独立 code 保留）。
    """
    from apps.common.audit_actor import apply_update_audit

    old_main = (material.main_code or "").strip()
    new_main = (new_main_code or "").strip()
    if not new_main or new_main == old_main:
        return

    family = await Material.filter(
        tenant_id=tenant_id,
        main_code=old_main,
        deleted_at__isnull=True,
    ).all()
    if not family:
        family = [material]

    for row in family:
        old_code = (getattr(row, "code", None) or "").strip()
        row.main_code = new_main
        if not old_code or old_code == old_main:
            row.code = new_main
        apply_update_audit(row, current_user)
        await row.save()
