"""
追溯事件采集：从真实业务单据读取，禁止推断与兜底
"""

from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Set

from apps.kuaizhizao.models.customer_material_registration import (
    CustomerMaterialRegistration,
    CustomerMaterialRegistrationItem,
)
from apps.kuaizhizao.models.defect_record import DefectRecord
from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem
from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
from apps.kuaizhizao.models.material_binding import MaterialBinding
from apps.kuaizhizao.models.oqc_inspection import OQCInspection
from apps.kuaizhizao.models.process_inspection import ProcessInspection
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaizhizao.models.sales_return import SalesReturn
from apps.kuaizhizao.models.sales_return_item import SalesReturnItem
from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt
from apps.kuaizhizao.models.semi_finished_goods_receipt_item import SemiFinishedGoodsReceiptItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.traceability_schemas import TraceBizStep, TraceEventResponse, TraceIdentifierType
from apps.kuaizhizao.services.traceability.identifier_resolver import ResolvedTraceAnchor
from apps.kuaizhizao.services.traceability.serial_match import serial_numbers_contain

# 已确认发料的明细状态（与 warehouse_service 确认领料回写一致）
_PICKED_ITEM_STATUSES = ("已领料", "已确认", "picked", "confirmed", "部分领料")


def _hdr_receipt_code(hdr, receipt_id: int) -> str:
    code = getattr(hdr, "receipt_code", None) if hdr is not None else None
    if code is not None and str(code).strip():
        return str(code).strip()
    return str(receipt_id)


def _hdr_delivery_code(hdr, delivery_id: int) -> str:
    code = getattr(hdr, "delivery_code", None) if hdr is not None else None
    if code is not None and str(code).strip():
        return str(code).strip()
    return str(delivery_id)


def _hdr_return_code(hdr, return_id: int) -> str:
    code = getattr(hdr, "return_code", None) if hdr is not None else None
    if code is not None and str(code).strip():
        return str(code).strip()
    return str(return_id)


def _hdr_picking_code(hdr, picking_id: int) -> str:
    code = getattr(hdr, "picking_code", None) if hdr is not None else None
    if code is not None and str(code).strip():
        return str(code).strip()
    return str(picking_id)


def _reporting_document_code(rec: ReportingRecord) -> str:
    wo_code = (getattr(rec, "work_order_code", None) or "").strip()
    op_code = (getattr(rec, "operation_code", None) or "").strip()
    op_name = (getattr(rec, "operation_name", None) or "").strip()
    if wo_code and op_code:
        return f"{wo_code}/{op_code}"
    if wo_code and op_name:
        return f"{wo_code}/{op_name}"
    if wo_code:
        return wo_code
    return f"BG-{rec.id}"


class TraceEventCollector:
    def __init__(self) -> None:
        self._seen: Set[str] = set()
        self._events: List[TraceEventResponse] = []
        self._work_order_ids: Set[int] = set()
        self._batch_nos: Set[str] = set()

    async def collect(self, anchor: ResolvedTraceAnchor) -> List[TraceEventResponse]:
        self._seen.clear()
        self._events.clear()
        self._work_order_ids.clear()
        self._batch_nos.clear()

        self._add(
            event_id=f"anchor-{anchor.identifier_type.value}-{anchor.code}",
            event_time=None,
            biz_step=TraceBizStep.storing,
            document_type=anchor.identifier_type.value,
            document_code=anchor.code,
            document_id=anchor.work_order_id,
            material_code=anchor.material_code,
            material_name=anchor.material_name,
            quantity=None,
            operator=None,
            remark=f"status:{anchor.status}" if anchor.status else None,
            source_table="trace_anchor",
            quality_status=None,
        )

        if anchor.identifier_type == TraceIdentifierType.serial:
            await self._collect_for_serial(anchor)
        elif anchor.identifier_type == TraceIdentifierType.batch:
            self._batch_nos.add(anchor.code)
            await self._collect_for_batch(anchor)
        else:
            if anchor.work_order_id:
                self._work_order_ids.add(anchor.work_order_id)
            await self._collect_for_work_order(anchor)

        if self._work_order_ids:
            await self._collect_upstream_materials(anchor.tenant_id)

        if self._batch_nos:
            await self._collect_material_bindings(anchor.tenant_id)

        if self._work_order_ids:
            await self._collect_work_order_context(anchor.tenant_id)
            await self._collect_inspections(anchor.tenant_id)
            await self._collect_reporting(anchor.tenant_id)

        self._events.sort(key=lambda e: (e.event_time is None, e.event_time or datetime.min))
        return list(self._events)

    def _add(
        self,
        *,
        event_id: str,
        event_time: Optional[datetime],
        biz_step: TraceBizStep,
        document_type: str,
        document_code: str,
        document_id: Optional[int],
        material_code: Optional[str],
        material_name: Optional[str],
        quantity: Optional[Decimal],
        operator: Optional[str],
        remark: Optional[str],
        source_table: str,
        quality_status: Optional[str] = None,
        related_batch_no: Optional[str] = None,
    ) -> None:
        if event_id in self._seen:
            return
        self._seen.add(event_id)
        self._events.append(
            TraceEventResponse(
                event_id=event_id,
                event_time=event_time,
                biz_step=biz_step,
                document_type=document_type,
                document_code=document_code,
                document_id=document_id,
                material_code=material_code,
                material_name=material_name,
                quantity=quantity,
                location=None,
                operator=operator,
                remark=remark,
                source_table=source_table,
                quality_status=quality_status,
                related_batch_no=related_batch_no,
            )
        )

    async def _collect_for_serial(self, anchor: ResolvedTraceAnchor) -> None:
        tenant_id = anchor.tenant_id
        serial_no = anchor.code
        material_id = anchor.material_id

        await self._collect_purchase_receipts(tenant_id, material_id=material_id, serial_no=serial_no)
        await self._collect_customer_material(tenant_id, material_id=material_id, serial_no=serial_no)
        await self._collect_finished_goods_receipts(tenant_id, material_id=material_id, serial_no=serial_no)
        await self._collect_semi_finished_receipts(tenant_id, material_id=material_id, serial_no=serial_no)
        await self._collect_production_pickings(tenant_id, material_id=material_id, serial_no=serial_no)
        await self._collect_sales_delivery(tenant_id, material_id=material_id, serial_no=serial_no)
        await self._collect_sales_return(tenant_id, material_id=material_id, serial_no=serial_no)

    async def _collect_for_batch(self, anchor: ResolvedTraceAnchor) -> None:
        tenant_id = anchor.tenant_id
        batch_no = anchor.code
        material_id = anchor.material_id

        await self._collect_purchase_receipts(tenant_id, material_id=material_id, batch_no=batch_no)
        await self._collect_customer_material(tenant_id, material_id=material_id, batch_no=batch_no)
        await self._collect_finished_goods_receipts(tenant_id, material_id=material_id, batch_no=batch_no)
        await self._collect_semi_finished_receipts(tenant_id, material_id=material_id, batch_no=batch_no)
        await self._collect_production_pickings(tenant_id, material_id=material_id, batch_no=batch_no)
        await self._collect_sales_delivery(tenant_id, material_id=material_id, batch_no=batch_no)
        await self._collect_sales_return(tenant_id, material_id=material_id, batch_no=batch_no)

    async def _collect_for_work_order(self, anchor: ResolvedTraceAnchor) -> None:
        if not anchor.work_order_id:
            return
        wo = await WorkOrder.get_or_none(id=anchor.work_order_id, tenant_id=anchor.tenant_id, deleted_at__isnull=True)
        if not wo:
            return
        self._add(
            event_id=f"work_order-{wo.id}",
            event_time=getattr(wo, "created_at", None),
            biz_step=TraceBizStep.commissioning,
            document_type="work_order",
            document_code=wo.code,
            document_id=wo.id,
            material_code=getattr(wo, "product_code", None),
            material_name=getattr(wo, "product_name", None),
            quantity=getattr(wo, "quantity", None),
            operator=None,
            remark=f"status:{getattr(wo, 'status', '')}" if getattr(wo, "status", None) else None,
            source_table="apps_kuaizhizao_work_orders",
        )
        await self._collect_finished_goods_receipts(anchor.tenant_id, work_order_id=wo.id)
        await self._collect_semi_finished_receipts(anchor.tenant_id, work_order_id=wo.id)
        await self._collect_production_pickings(anchor.tenant_id, work_order_ids=[int(wo.id)])

    async def _collect_purchase_receipts(
        self,
        tenant_id: int,
        *,
        material_id: Optional[int] = None,
        serial_no: Optional[str] = None,
        batch_no: Optional[str] = None,
    ) -> None:
        q = PurchaseReceiptItem.filter(tenant_id=tenant_id, status="已入库")
        if material_id:
            q = q.filter(material_id=material_id)
        items = await q.all()
        receipt_ids = {int(i.receipt_id) for i in items}
        receipts: Dict[int, PurchaseReceipt] = {}
        if receipt_ids:
            for r in await PurchaseReceipt.filter(tenant_id=tenant_id, id__in=list(receipt_ids)).all():
                receipts[int(r.id)] = r

        for item in items:
            if serial_no and not serial_numbers_contain(getattr(item, "serial_numbers", None), serial_no):
                continue
            if batch_no and (getattr(item, "batch_number", None) or "") != batch_no:
                continue
            hdr = receipts.get(int(item.receipt_id))
            event_time = getattr(item, "receipt_time", None) or (hdr.receipt_time if hdr else None)
            item_batch = (getattr(item, "batch_number", None) or "").strip() or None
            self._add(
                event_id=f"purchase_receipt-{item.receipt_id}-{item.id}",
                event_time=event_time,
                biz_step=TraceBizStep.receiving,
                document_type="purchase_receipt",
                document_code=_hdr_receipt_code(hdr, int(item.receipt_id)),
                document_id=int(item.receipt_id),
                material_code=getattr(item, "material_code", None),
                material_name=getattr(item, "material_name", None),
                quantity=getattr(item, "receipt_quantity", None),
                operator=getattr(hdr, "receiver_name", None) if hdr else None,
                remark=None,
                source_table="apps_kuaizhizao_purchase_receipt_items",
                related_batch_no=item_batch,
            )
            await self._collect_incoming_for_purchase(tenant_id, int(item.receipt_id), getattr(item, "material_id", None))

    async def _collect_incoming_for_purchase(self, tenant_id: int, receipt_id: int, material_id: Optional[int]) -> None:
        q = IncomingInspection.filter(
            tenant_id=tenant_id,
            purchase_receipt_id=receipt_id,
            deleted_at__isnull=True,
        )
        if material_id:
            q = q.filter(material_id=material_id)
        for insp in await q.all():
            self._add(
                event_id=f"incoming_inspection-{insp.id}",
                event_time=getattr(insp, "inspection_time", None),
                biz_step=TraceBizStep.inspecting,
                document_type="incoming_inspection",
                document_code=insp.inspection_code,
                document_id=insp.id,
                material_code=getattr(insp, "material_code", None),
                material_name=getattr(insp, "material_name", None),
                quantity=getattr(insp, "inspection_quantity", None),
                operator=getattr(insp, "inspector_name", None),
                remark=getattr(insp, "inspection_result", None),
                source_table="apps_kuaizhizao_incoming_inspections",
                quality_status=getattr(insp, "quality_status", None),
            )

    async def _collect_customer_material(
        self,
        tenant_id: int,
        *,
        material_id: Optional[int] = None,
        serial_no: Optional[str] = None,
        batch_no: Optional[str] = None,
    ) -> None:
        q = CustomerMaterialRegistrationItem.filter(tenant_id=tenant_id)
        if material_id:
            q = q.filter(material_id=material_id)
        items = await q.all()
        reg_ids = {int(i.registration_id) for i in items}
        regs: Dict[int, CustomerMaterialRegistration] = {}
        if reg_ids:
            for reg in await CustomerMaterialRegistration.filter(
                tenant_id=tenant_id, id__in=list(reg_ids), status="processed"
            ).all():
                regs[int(reg.id)] = reg

        for item in items:
            if serial_no and not serial_numbers_contain(getattr(item, "serial_numbers", None), serial_no):
                continue
            if batch_no and (getattr(item, "batch_number", None) or "") != batch_no:
                continue
            reg = regs.get(int(item.registration_id))
            if not reg:
                continue
            item_batch = (getattr(item, "batch_number", None) or "").strip() or None
            self._add(
                event_id=f"customer_material-{reg.id}-{item.id}",
                event_time=getattr(reg, "processed_at", None),
                biz_step=TraceBizStep.receiving,
                document_type="customer_material_registration",
                document_code=reg.registration_code,
                document_id=reg.id,
                material_code=getattr(item, "material_code", None),
                material_name=getattr(item, "material_name", None),
                quantity=getattr(item, "quantity", None),
                operator=getattr(reg, "processed_by_name", None),
                remark=None,
                source_table="apps_kuaizhizao_customer_material_registration_items",
                related_batch_no=item_batch,
            )
            await self._collect_incoming_for_customer_material(tenant_id, reg.id, getattr(item, "material_id", None))

    async def _collect_incoming_for_customer_material(
        self, tenant_id: int, registration_id: int, material_id: Optional[int]
    ) -> None:
        q = IncomingInspection.filter(
            tenant_id=tenant_id,
            customer_material_registration_id=registration_id,
            deleted_at__isnull=True,
        )
        if material_id:
            q = q.filter(material_id=material_id)
        for insp in await q.all():
            self._add(
                event_id=f"incoming_inspection-{insp.id}",
                event_time=getattr(insp, "inspection_time", None),
                biz_step=TraceBizStep.inspecting,
                document_type="incoming_inspection",
                document_code=insp.inspection_code,
                document_id=insp.id,
                material_code=getattr(insp, "material_code", None),
                material_name=getattr(insp, "material_name", None),
                quantity=getattr(insp, "inspection_quantity", None),
                operator=getattr(insp, "inspector_name", None),
                remark=getattr(insp, "inspection_result", None),
                source_table="apps_kuaizhizao_incoming_inspections",
                quality_status=getattr(insp, "quality_status", None),
            )

    async def _collect_finished_goods_receipts(
        self,
        tenant_id: int,
        *,
        material_id: Optional[int] = None,
        serial_no: Optional[str] = None,
        batch_no: Optional[str] = None,
        work_order_id: Optional[int] = None,
    ) -> None:
        q = FinishedGoodsReceiptItem.filter(tenant_id=tenant_id, status="已入库")
        if material_id:
            q = q.filter(material_id=material_id)
        if work_order_id:
            hdr_ids = [
                int(r.id)
                for r in await FinishedGoodsReceipt.filter(
                    tenant_id=tenant_id, work_order_id=work_order_id, deleted_at__isnull=True
                ).all()
            ]
            if not hdr_ids:
                return
            q = q.filter(receipt_id__in=hdr_ids)
        items = await q.all()
        receipt_ids = {int(i.receipt_id) for i in items}
        receipts: Dict[int, FinishedGoodsReceipt] = {}
        if receipt_ids:
            for r in await FinishedGoodsReceipt.filter(tenant_id=tenant_id, id__in=list(receipt_ids)).all():
                receipts[int(r.id)] = r

        for item in items:
            if serial_no and not serial_numbers_contain(getattr(item, "serial_numbers", None), serial_no):
                continue
            if batch_no and (getattr(item, "batch_number", None) or "") != batch_no:
                continue
            hdr = receipts.get(int(item.receipt_id))
            if hdr and hdr.work_order_id:
                self._work_order_ids.add(int(hdr.work_order_id))
            if getattr(item, "batch_number", None):
                self._batch_nos.add(str(item.batch_number))
            event_time = getattr(item, "receipt_time", None) or (hdr.receipt_time if hdr else None)
            self._add(
                event_id=f"finished_goods_receipt-{item.receipt_id}-{item.id}",
                event_time=event_time,
                biz_step=TraceBizStep.storing,
                document_type="finished_goods_receipt",
                document_code=_hdr_receipt_code(hdr, int(item.receipt_id)),
                document_id=int(item.receipt_id),
                material_code=getattr(item, "material_code", None),
                material_name=getattr(item, "material_name", None),
                quantity=getattr(item, "receipt_quantity", None) or getattr(item, "qualified_quantity", None),
                operator=getattr(hdr, "receiver_name", None) if hdr else None,
                remark=None,
                source_table="apps_kuaizhizao_finished_goods_receipt_items",
            )

    async def _collect_semi_finished_receipts(
        self,
        tenant_id: int,
        *,
        material_id: Optional[int] = None,
        serial_no: Optional[str] = None,
        batch_no: Optional[str] = None,
        work_order_id: Optional[int] = None,
    ) -> None:
        q = SemiFinishedGoodsReceiptItem.filter(tenant_id=tenant_id, status="已入库")
        if material_id:
            q = q.filter(material_id=material_id)
        if work_order_id:
            hdr_ids = [
                int(r.id)
                for r in await SemiFinishedGoodsReceipt.filter(
                    tenant_id=tenant_id, work_order_id=work_order_id, deleted_at__isnull=True
                ).all()
            ]
            if not hdr_ids:
                return
            q = q.filter(receipt_id__in=hdr_ids)
        items = await q.all()
        receipt_ids = {int(i.receipt_id) for i in items}
        receipts: Dict[int, SemiFinishedGoodsReceipt] = {}
        if receipt_ids:
            for r in await SemiFinishedGoodsReceipt.filter(tenant_id=tenant_id, id__in=list(receipt_ids)).all():
                receipts[int(r.id)] = r

        for item in items:
            if batch_no and (getattr(item, "batch_number", None) or "") != batch_no:
                continue
            if serial_no:
                continue
            hdr = receipts.get(int(item.receipt_id))
            if hdr and hdr.work_order_id:
                self._work_order_ids.add(int(hdr.work_order_id))
            if getattr(item, "batch_number", None):
                self._batch_nos.add(str(item.batch_number))
            event_time = getattr(item, "receipt_time", None) or (hdr.receipt_time if hdr else None)
            self._add(
                event_id=f"semi_finished_goods_receipt-{item.receipt_id}-{item.id}",
                event_time=event_time,
                biz_step=TraceBizStep.storing,
                document_type="semi_finished_goods_receipt",
                document_code=_hdr_receipt_code(hdr, int(item.receipt_id)),
                document_id=int(item.receipt_id),
                material_code=getattr(item, "material_code", None),
                material_name=getattr(item, "material_name", None),
                quantity=getattr(item, "receipt_quantity", None) or getattr(item, "qualified_quantity", None),
                operator=getattr(hdr, "receiver_name", None) if hdr else None,
                remark=None,
                source_table="apps_kuaizhizao_semi_finished_goods_receipt_items",
            )

    async def _collect_sales_delivery(
        self,
        tenant_id: int,
        *,
        material_id: Optional[int] = None,
        serial_no: Optional[str] = None,
        batch_no: Optional[str] = None,
    ) -> None:
        q = SalesDeliveryItem.filter(tenant_id=tenant_id)
        if material_id:
            q = q.filter(material_id=material_id)
        items = await q.filter(status="已出库").all()
        delivery_ids = {int(i.delivery_id) for i in items}
        deliveries: Dict[int, SalesDelivery] = {}
        if delivery_ids:
            for d in await SalesDelivery.filter(tenant_id=tenant_id, id__in=list(delivery_ids)).all():
                deliveries[int(d.id)] = d

        for item in items:
            if serial_no and not serial_numbers_contain(getattr(item, "serial_numbers", None), serial_no):
                continue
            if batch_no and (getattr(item, "batch_number", None) or "") != batch_no:
                continue
            hdr = deliveries.get(int(item.delivery_id))
            event_time = getattr(item, "delivery_time", None) or (hdr.delivery_time if hdr else None)
            self._add(
                event_id=f"sales_delivery-{item.delivery_id}-{item.id}",
                event_time=event_time,
                biz_step=TraceBizStep.shipping,
                document_type="sales_delivery",
                document_code=_hdr_delivery_code(hdr, int(item.delivery_id)),
                document_id=int(item.delivery_id),
                material_code=getattr(item, "material_code", None),
                material_name=getattr(item, "material_name", None),
                quantity=getattr(item, "delivery_quantity", None),
                operator=getattr(hdr, "deliverer_name", None) if hdr else None,
                remark=None,
                source_table="apps_kuaizhizao_sales_delivery_items",
            )

    async def _collect_sales_return(
        self,
        tenant_id: int,
        *,
        material_id: Optional[int] = None,
        serial_no: Optional[str] = None,
        batch_no: Optional[str] = None,
    ) -> None:
        q = SalesReturnItem.filter(tenant_id=tenant_id, status="已退货")
        if material_id:
            q = q.filter(material_id=material_id)
        items = await q.all()
        return_ids = {int(i.return_id) for i in items}
        returns: Dict[int, SalesReturn] = {}
        if return_ids:
            for r in await SalesReturn.filter(tenant_id=tenant_id, id__in=list(return_ids)).all():
                returns[int(r.id)] = r

        for item in items:
            if serial_no and not serial_numbers_contain(getattr(item, "serial_numbers", None), serial_no):
                continue
            if batch_no and (getattr(item, "batch_number", None) or "") != batch_no:
                continue
            hdr = returns.get(int(item.return_id))
            event_time = getattr(item, "return_time", None) or (hdr.return_time if hdr else None)
            self._add(
                event_id=f"sales_return-{item.return_id}-{item.id}",
                event_time=event_time,
                biz_step=TraceBizStep.accepting,
                document_type="sales_return",
                document_code=_hdr_return_code(hdr, int(item.return_id)),
                document_id=int(item.return_id),
                material_code=getattr(item, "material_code", None),
                material_name=getattr(item, "material_name", None),
                quantity=getattr(item, "return_quantity", None),
                operator=getattr(hdr, "returner_name", None) if hdr else None,
                remark=None,
                source_table="apps_kuaizhizao_sales_return_items",
            )

    async def _collect_production_pickings(
        self,
        tenant_id: int,
        *,
        material_id: Optional[int] = None,
        serial_no: Optional[str] = None,
        batch_no: Optional[str] = None,
        work_order_ids: Optional[List[int]] = None,
    ) -> None:
        """采集已确认的生产领料单（仓库发料单据，非上料绑定）。"""
        q = ProductionPickingItem.filter(
            tenant_id=tenant_id,
            status__in=list(_PICKED_ITEM_STATUSES),
            deleted_at__isnull=True,
        )
        if material_id:
            q = q.filter(material_id=material_id)
        if work_order_ids:
            hdr_ids = [
                int(p.id)
                for p in await ProductionPicking.filter(
                    tenant_id=tenant_id,
                    work_order_id__in=list(work_order_ids),
                    deleted_at__isnull=True,
                ).all()
            ]
            if not hdr_ids:
                return
            q = q.filter(picking_id__in=hdr_ids)
        items = await q.all()
        if not items:
            return

        picking_ids = {int(i.picking_id) for i in items}
        pickings: Dict[int, ProductionPicking] = {}
        if picking_ids:
            for p in await ProductionPicking.filter(
                tenant_id=tenant_id,
                id__in=list(picking_ids),
                deleted_at__isnull=True,
            ).all():
                pickings[int(p.id)] = p

        for item in items:
            if serial_no and not serial_numbers_contain(getattr(item, "serial_numbers", None), serial_no):
                continue
            if batch_no and (getattr(item, "batch_number", None) or "") != batch_no:
                continue
            hdr = pickings.get(int(item.picking_id))
            if not hdr:
                continue
            if hdr.work_order_id:
                self._work_order_ids.add(int(hdr.work_order_id))
            item_batch = (getattr(item, "batch_number", None) or "").strip() or None
            if item_batch:
                self._batch_nos.add(item_batch)
            event_time = getattr(item, "picking_time", None) or getattr(hdr, "picking_time", None)
            self._add(
                event_id=f"production_picking-{item.picking_id}-{item.id}",
                event_time=event_time,
                biz_step=TraceBizStep.picking,
                document_type="production_picking",
                document_code=_hdr_picking_code(hdr, int(item.picking_id)),
                document_id=int(item.picking_id),
                material_code=getattr(item, "material_code", None),
                material_name=getattr(item, "material_name", None),
                quantity=getattr(item, "picked_quantity", None) or getattr(item, "required_quantity", None),
                operator=getattr(hdr, "picker_name", None),
                remark=getattr(item, "warehouse_name", None),
                source_table="apps_kuaizhizao_production_picking_items",
                related_batch_no=item_batch,
            )

    async def _collect_upstream_materials(self, tenant_id: int) -> None:
        """沿工单领料单与上料绑定反查原材料/半成品批次，并采集采购入库、代工来料及来料检验。"""
        visited_wo: Set[int] = set()
        visited_batch: Set[str] = set(self._batch_nos)
        pending_wo: Set[int] = set(self._work_order_ids)

        while pending_wo:
            wo_ids = [wid for wid in pending_wo if wid not in visited_wo]
            if not wo_ids:
                break
            visited_wo.update(wo_ids)
            pending_wo.difference_update(visited_wo)

            feedings = await MaterialBinding.filter(
                tenant_id=tenant_id,
                work_order_id__in=wo_ids,
                binding_type="feeding",
                deleted_at__isnull=True,
            ).all()

            new_batches: Set[str] = set()
            for binding in feedings:
                batch_text = (getattr(binding, "batch_no", None) or "").strip()
                if batch_text and batch_text not in visited_batch:
                    new_batches.add(batch_text)

            # 仓库生产领料单是领料真源之一；无上料绑定时仍须反查组件批次
            await self._collect_production_pickings(tenant_id, work_order_ids=wo_ids)
            for batch_text in self._batch_nos:
                if batch_text not in visited_batch:
                    new_batches.add(batch_text)

            for batch_no in new_batches:
                visited_batch.add(batch_no)
                self._batch_nos.add(batch_no)
                await self._collect_purchase_receipts(tenant_id, batch_no=batch_no)
                await self._collect_customer_material(tenant_id, batch_no=batch_no)
                await self._collect_semi_finished_receipts(tenant_id, batch_no=batch_no)

                dischargings = await MaterialBinding.filter(
                    tenant_id=tenant_id,
                    batch_no=batch_no,
                    binding_type="discharging",
                    deleted_at__isnull=True,
                ).all()
                for discharging in dischargings:
                    if discharging.work_order_id:
                        pending_wo.add(int(discharging.work_order_id))

    async def _collect_material_bindings(self, tenant_id: int) -> None:
        for batch_no in self._batch_nos:
            bindings = await MaterialBinding.filter(
                tenant_id=tenant_id,
                batch_no=batch_no,
                deleted_at__isnull=True,
            ).all()
            for b in bindings:
                if b.work_order_id:
                    self._work_order_ids.add(int(b.work_order_id))
                step = TraceBizStep.picking if b.binding_type == "feeding" else TraceBizStep.transforming
                self._add(
                    event_id=f"material_binding-{b.id}",
                    event_time=getattr(b, "bound_at", None),
                    biz_step=step,
                    document_type="material_binding",
                    document_code=f"{b.work_order_code}-{b.binding_type}",
                    document_id=b.id,
                    material_code=getattr(b, "material_code", None),
                    material_name=getattr(b, "material_name", None),
                    quantity=getattr(b, "quantity", None),
                    operator=getattr(b, "bound_by_name", None),
                    remark=f"{getattr(b, 'operation_name', '')} / {b.binding_type}",
                    source_table="apps_kuaizhizao_material_bindings",
                )

    async def _collect_work_order_context(self, tenant_id: int) -> None:
        for wo_id in self._work_order_ids:
            wo = await WorkOrder.get_or_none(id=wo_id, tenant_id=tenant_id, deleted_at__isnull=True)
            if not wo:
                continue
            self._add(
                event_id=f"work_order-{wo.id}",
                event_time=getattr(wo, "created_at", None),
                biz_step=TraceBizStep.commissioning,
                document_type="work_order",
                document_code=wo.code,
                document_id=wo.id,
                material_code=getattr(wo, "product_code", None),
                material_name=getattr(wo, "product_name", None),
                quantity=getattr(wo, "quantity", None),
                operator=None,
                remark=f"status:{getattr(wo, 'status', '')}" if getattr(wo, "status", None) else None,
                source_table="apps_kuaizhizao_work_orders",
            )

    async def _collect_inspections(self, tenant_id: int) -> None:
        wo_ids = list(self._work_order_ids)
        if not wo_ids:
            return
        base = {"tenant_id": tenant_id, "work_order_id__in": wo_ids, "deleted_at__isnull": True}

        for insp in await ProcessInspection.filter(**base).all():
            self._add(
                event_id=f"process_inspection-{insp.id}",
                event_time=getattr(insp, "inspection_time", None),
                biz_step=TraceBizStep.inspecting,
                document_type="process_inspection",
                document_code=insp.inspection_code,
                document_id=insp.id,
                material_code=getattr(insp, "material_code", None),
                material_name=getattr(insp, "material_name", None),
                quantity=getattr(insp, "inspection_quantity", None),
                operator=getattr(insp, "inspector_name", None),
                remark=getattr(insp, "operation_name", None),
                source_table="apps_kuaizhizao_process_inspections",
                quality_status=getattr(insp, "quality_status", None),
            )

        for insp in await FinishedGoodsInspection.filter(**base).all():
            self._add(
                event_id=f"finished_goods_inspection-{insp.id}",
                event_time=getattr(insp, "inspection_time", None),
                biz_step=TraceBizStep.inspecting,
                document_type="finished_goods_inspection",
                document_code=insp.inspection_code,
                document_id=insp.id,
                material_code=getattr(insp, "material_code", None),
                material_name=getattr(insp, "material_name", None),
                quantity=getattr(insp, "inspection_quantity", None),
                operator=getattr(insp, "inspector_name", None),
                remark=None,
                source_table="apps_kuaizhizao_finished_goods_inspections",
                quality_status=getattr(insp, "quality_status", None),
            )

        for defect in await DefectRecord.filter(**base).all():
            self._add(
                event_id=f"defect_record-{defect.id}",
                event_time=getattr(defect, "created_at", None),
                biz_step=TraceBizStep.inspecting,
                document_type="defect_record",
                document_code=defect.code,
                document_id=defect.id,
                material_code=getattr(defect, "material_code", None),
                material_name=getattr(defect, "material_name", None),
                quantity=getattr(defect, "defect_quantity", None),
                operator=None,
                remark=getattr(defect, "disposition", None),
                source_table="apps_kuaizhizao_defect_records",
                quality_status="不合格",
            )

        material_ids = set()
        for e in self._events:
            if e.material_code:
                pass
        if wo_ids:
            wos = await WorkOrder.filter(tenant_id=tenant_id, id__in=wo_ids).all()
            for wo in wos:
                if getattr(wo, "product_id", None):
                    material_ids.add(int(wo.product_id))

        if material_ids:
            for oqc in await OQCInspection.filter(
                tenant_id=tenant_id,
                material_id__in=list(material_ids),
                deleted_at__isnull=True,
            ).all():
                self._add(
                    event_id=f"oqc_inspection-{oqc.id}",
                    event_time=getattr(oqc, "inspection_time", None),
                    biz_step=TraceBizStep.inspecting,
                    document_type="oqc_inspection",
                    document_code=oqc.inspection_code,
                    document_id=oqc.id,
                    material_code=getattr(oqc, "material_code", None),
                    material_name=getattr(oqc, "material_name", None),
                    quantity=getattr(oqc, "inspection_quantity", None),
                    operator=getattr(oqc, "inspector_name", None),
                    remark=None,
                    source_table="apps_kuaizhizao_oqc_inspections",
                    quality_status=getattr(oqc, "quality_status", None),
                )

    async def _collect_reporting(self, tenant_id: int) -> None:
        wo_ids = list(self._work_order_ids)
        if not wo_ids:
            return
        for rec in await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id__in=wo_ids,
            deleted_at__isnull=True,
        ).all():
            self._add(
                event_id=f"reporting_record-{rec.id}",
                event_time=getattr(rec, "reported_at", None) or getattr(rec, "created_at", None),
                biz_step=TraceBizStep.transforming,
                document_type="reporting_record",
                document_code=_reporting_document_code(rec),
                document_id=rec.id,
                material_code=None,
                material_name=None,
                quantity=getattr(rec, "qualified_quantity", None) or getattr(rec, "reported_quantity", None),
                operator=getattr(rec, "worker_name", None),
                remark=getattr(rec, "operation_name", None),
                source_table="apps_kuaizhizao_reporting_records",
            )
