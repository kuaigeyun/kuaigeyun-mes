"""工单物料移动查询：优先流水表，无流水时单据并集兜底。"""

from __future__ import annotations

from decimal import Decimal
from typing import List

from apps.kuaizhizao.models.backflush_record import BackflushRecord
from apps.kuaizhizao.models.batching_order import BatchingOrder, BatchingOrderItem
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem
from apps.kuaizhizao.models.material_call_request import MaterialCallRequest
from apps.kuaizhizao.models.material_call_request_item import MaterialCallRequestItem
from apps.kuaizhizao.models.material_stock_movement import MaterialStockMovement
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaizhizao.models.production_return import ProductionReturn
from apps.kuaizhizao.models.production_return_item import ProductionReturnItem
from apps.kuaizhizao.models.scrap_record import ScrapRecord
from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt
from apps.kuaizhizao.models.semi_finished_goods_receipt_item import SemiFinishedGoodsReceiptItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.material_stock_movement import (
    WorkOrderMaterialMovementItem,
    WorkOrderMaterialMovementListResponse,
)
from apps.kuaizhizao.utils.picking_posting import is_staging_transfer_picking_notes
from infra.exceptions.exceptions import NotFoundError


class MaterialStockMovementService:
    async def list_for_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        *,
        limit: int = 200,
    ) -> WorkOrderMaterialMovementListResponse:
        wo = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        )
        if not wo:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        ledger_rows = (
            await MaterialStockMovement.filter(
                tenant_id=tenant_id, work_order_id=work_order_id
            )
            .order_by("-created_at", "-id")
            .limit(limit)
            .all()
        )
        if ledger_rows:
            items = [
                WorkOrderMaterialMovementItem(
                    id=r.id,
                    source="ledger",
                    movement_type=r.movement_type,
                    material_id=r.material_id,
                    material_code=r.material_code,
                    batch_no=r.batch_no,
                    quantity=Decimal(str(r.quantity or 0)),
                    qty_before=r.qty_before,
                    qty_after=r.qty_after,
                    from_warehouse_id=r.from_warehouse_id,
                    from_warehouse_name=r.from_warehouse_name,
                    to_warehouse_id=r.to_warehouse_id,
                    to_warehouse_name=r.to_warehouse_name,
                    source_doc_type=r.source_doc_type,
                    source_doc_id=r.source_doc_id,
                    source_doc_code=r.source_doc_code,
                    work_order_id=r.work_order_id,
                    work_order_code=r.work_order_code,
                    operator_id=r.operator_id,
                    operator_name=r.operator_name,
                    remark=r.remark,
                    occurred_at=r.created_at,
                )
                for r in ledger_rows
            ]
            return WorkOrderMaterialMovementListResponse(
                work_order_id=work_order_id,
                total=len(items),
                items=items,
                source_mode="ledger",
            )

        doc_items = await self._document_fallback(tenant_id, wo, limit=limit)
        return WorkOrderMaterialMovementListResponse(
            work_order_id=work_order_id,
            total=len(doc_items),
            items=doc_items,
            source_mode="document",
        )

    async def _document_fallback(
        self,
        tenant_id: int,
        wo: WorkOrder,
        *,
        limit: int,
    ) -> List[WorkOrderMaterialMovementItem]:
        items: List[WorkOrderMaterialMovementItem] = []
        wo_id = wo.id
        wo_code = wo.code

        # 线边备料单（已确认/部分确认）
        batching_orders = await BatchingOrder.filter(
            tenant_id=tenant_id, work_order_id=wo_id
        ).limit(50)
        for order in batching_orders:
            st = str(order.status or "")
            if st in ("draft", "cancelled", "草稿", "已取消"):
                continue
            order_items = await BatchingOrderItem.filter(
                tenant_id=tenant_id, batching_order_id=order.id
            ).all()
            for it in order_items:
                qty = Decimal(str(getattr(it, "picked_quantity", None) or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="staging_to_line",
                        material_id=it.material_id,
                        material_code=getattr(it, "material_code", None),
                        material_name=getattr(it, "material_name", None),
                        batch_no=getattr(it, "batch_no", None),
                        quantity=qty,
                        from_warehouse_id=order.warehouse_id,
                        from_warehouse_name=getattr(order, "warehouse_name", None),
                        to_warehouse_id=order.target_warehouse_id,
                        to_warehouse_name=getattr(order, "target_warehouse_name", None),
                        source_doc_type="batching_order",
                        source_doc_id=order.id,
                        source_doc_code=order.code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=order.updated_at or order.created_at,
                    )
                )

        # 补料申请（已完成）
        calls = await MaterialCallRequest.filter(
            tenant_id=tenant_id, work_order_id=wo_id
        ).limit(50)
        for call in calls:
            if str(call.status or "") not in ("completed", "已完成"):
                continue
            call_items = await MaterialCallRequestItem.filter(
                tenant_id=tenant_id, request_id=call.id
            ).all()
            for it in call_items:
                qty = Decimal(str(it.delivered_quantity or it.requested_quantity or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="staging_to_line",
                        material_id=it.material_id,
                        material_code=it.material_code,
                        material_name=it.material_name,
                        batch_no=getattr(it, "batch_no", None),
                        quantity=qty,
                        from_warehouse_id=call.source_warehouse_id,
                        to_warehouse_id=call.target_warehouse_id,
                        source_doc_type="material_call_request",
                        source_doc_id=call.id,
                        source_doc_code=call.code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=call.updated_at or call.created_at,
                    )
                )

        # 生产领料（正式发料，排除历史备料型）
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id, work_order_id=wo_id
        ).limit(50)
        for picking in pickings:
            if is_staging_transfer_picking_notes(getattr(picking, "notes", None)):
                continue
            st = str(picking.status or "")
            if st not in ("已领料", "confirmed", "completed"):
                continue
            p_items = await ProductionPickingItem.filter(
                tenant_id=tenant_id, picking_id=picking.id
            ).all()
            for it in p_items:
                qty = Decimal(str(it.picked_quantity or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="production_issue",
                        material_id=it.material_id,
                        material_code=getattr(it, "material_code", None),
                        material_name=getattr(it, "material_name", None),
                        batch_no=getattr(it, "batch_number", None),
                        quantity=-qty,
                        from_warehouse_id=it.warehouse_id or picking.warehouse_id,
                        source_doc_type="production_picking",
                        source_doc_id=picking.id,
                        source_doc_code=picking.picking_code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=getattr(picking, "picking_time", None)
                        or picking.updated_at
                        or picking.created_at,
                    )
                )

        # 生产退料
        returns = await ProductionReturn.filter(
            tenant_id=tenant_id, work_order_id=wo_id
        ).limit(50)
        for ret in returns:
            st = str(ret.status or "")
            if st not in ("已退料", "confirmed", "completed"):
                continue
            r_items = await ProductionReturnItem.filter(
                tenant_id=tenant_id, return_id=ret.id
            ).all()
            for it in r_items:
                qty = Decimal(str(it.return_quantity or getattr(it, "quantity", 0) or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="production_return",
                        material_id=it.material_id,
                        material_code=getattr(it, "material_code", None),
                        material_name=getattr(it, "material_name", None),
                        batch_no=getattr(it, "batch_number", None),
                        quantity=qty,
                        to_warehouse_id=it.warehouse_id or ret.warehouse_id,
                        source_doc_type="production_return",
                        source_doc_id=ret.id,
                        source_doc_code=ret.return_code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=getattr(ret, "return_time", None)
                        or ret.updated_at
                        or ret.created_at,
                    )
                )

        # 倒冲
        bfs = await BackflushRecord.filter(
            tenant_id=tenant_id,
            work_order_id=wo_id,
            status="completed",
            deleted_at__isnull=True,
        ).limit(100)
        for bf in bfs:
            qty = Decimal(str(bf.backflush_quantity or 0))
            if qty <= 0:
                continue
            items.append(
                WorkOrderMaterialMovementItem(
                    source="document",
                    movement_type="backflush_consume",
                    material_id=bf.material_id,
                    material_code=bf.material_code,
                    material_name=bf.material_name,
                    batch_no=bf.batch_no,
                    quantity=-qty,
                    from_warehouse_id=bf.warehouse_id,
                    from_warehouse_name=bf.warehouse_name,
                    source_doc_type="backflush_record",
                    source_doc_id=bf.id,
                    source_doc_code=bf.work_order_code,
                    work_order_id=wo_id,
                    work_order_code=wo_code,
                    occurred_at=bf.processed_at or bf.created_at,
                )
            )

        # 成品入库
        fgs = await FinishedGoodsReceipt.filter(
            tenant_id=tenant_id, work_order_id=wo_id
        ).limit(50)
        for receipt in fgs:
            if str(receipt.status or "") not in ("已入库", "confirmed", "completed"):
                continue
            fg_items = await FinishedGoodsReceiptItem.filter(
                tenant_id=tenant_id, receipt_id=receipt.id
            ).all()
            for it in fg_items:
                qty = Decimal(str(it.receipt_quantity or getattr(it, "quantity", 0) or 0))
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="fg_receipt",
                        material_id=it.material_id,
                        material_code=getattr(it, "material_code", None),
                        material_name=getattr(it, "material_name", None),
                        batch_no=getattr(it, "batch_number", None),
                        quantity=qty,
                        to_warehouse_id=it.warehouse_id or receipt.warehouse_id,
                        source_doc_type="finished_goods_receipt",
                        source_doc_id=receipt.id,
                        source_doc_code=receipt.receipt_code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=getattr(receipt, "receipt_time", None)
                        or receipt.updated_at
                        or receipt.created_at,
                    )
                )

        # 半成品入库
        sfs = await SemiFinishedGoodsReceipt.filter(
            tenant_id=tenant_id, work_order_id=wo_id, deleted_at__isnull=True
        ).limit(50)
        for receipt in sfs:
            if str(receipt.status or "") not in ("已入库", "confirmed", "completed"):
                continue
            sf_items = await SemiFinishedGoodsReceiptItem.filter(
                tenant_id=tenant_id, receipt_id=receipt.id
            ).all()
            for it in sf_items:
                qty = Decimal(
                    str(it.receipt_quantity or it.qualified_quantity or 0)
                )
                if qty <= 0:
                    continue
                items.append(
                    WorkOrderMaterialMovementItem(
                        source="document",
                        movement_type="semi_fg_receipt",
                        material_id=it.material_id,
                        material_code=getattr(it, "material_code", None),
                        material_name=getattr(it, "material_name", None),
                        batch_no=getattr(it, "batch_number", None),
                        quantity=qty,
                        to_warehouse_id=getattr(it, "warehouse_id", None)
                        or receipt.warehouse_id,
                        source_doc_type="semi_finished_goods_receipt",
                        source_doc_id=receipt.id,
                        source_doc_code=receipt.receipt_code,
                        work_order_id=wo_id,
                        work_order_code=wo_code,
                        occurred_at=getattr(receipt, "receipt_time", None)
                        or receipt.updated_at
                        or receipt.created_at,
                    )
                )

        # 报废（已确认；可能未过账的历史单也展示）
        scraps = await ScrapRecord.filter(
            tenant_id=tenant_id,
            work_order_id=wo_id,
            deleted_at__isnull=True,
            status="confirmed",
        ).limit(50)
        for scrap in scraps:
            qty = Decimal(str(scrap.scrap_quantity or 0))
            if qty <= 0:
                continue
            items.append(
                WorkOrderMaterialMovementItem(
                    source="document",
                    movement_type="scrap",
                    material_id=scrap.product_id,
                    material_code=scrap.product_code,
                    material_name=scrap.product_name,
                    quantity=-qty,
                    from_warehouse_id=scrap.warehouse_id,
                    from_warehouse_name=scrap.warehouse_name,
                    source_doc_type="scrap_record",
                    source_doc_id=scrap.id,
                    source_doc_code=scrap.code,
                    work_order_id=wo_id,
                    work_order_code=wo_code,
                    remark=scrap.scrap_reason,
                    occurred_at=scrap.confirmed_at or scrap.updated_at or scrap.created_at,
                )
            )

        items.sort(key=lambda x: x.occurred_at or wo.created_at, reverse=True)
        return items[:limit]
