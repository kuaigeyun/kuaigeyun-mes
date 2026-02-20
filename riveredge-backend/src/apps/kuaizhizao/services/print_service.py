"""
单据打印服务模块

提供业务单据的打印功能，支持使用打印模板渲染单据。

Author: Luigi Lu
Date: 2025-01-01
"""

from typing import Optional, Dict, Any
from loguru import logger

from core.services.print.print_template_service import PrintTemplateService
from core.schemas.print_template import PrintTemplateRenderRequest
from infra.exceptions.exceptions import NotFoundError, ValidationError

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_return import ProductionReturn
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.other_inbound import OtherInbound
from apps.kuaizhizao.models.other_inbound_item import OtherInboundItem
from apps.kuaizhizao.models.other_outbound import OtherOutbound
from apps.kuaizhizao.models.other_outbound_item import OtherOutboundItem
from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.quotation_item import QuotationItem
from apps.kuaizhizao.models.material_borrow import MaterialBorrow
from apps.kuaizhizao.models.material_borrow_item import MaterialBorrowItem
from apps.kuaizhizao.models.material_return import MaterialReturn
from apps.kuaizhizao.models.material_return_item import MaterialReturnItem


class DocumentPrintService:
    """单据打印服务"""

    # 单据类型到模板代码的映射
    DOCUMENT_TEMPLATE_CODES = {
        "work_order": "WORK_ORDER_PRINT",
        "production_picking": "PRODUCTION_PICKING_PRINT",
        "production_return": "PRODUCTION_RETURN_PRINT",
        "finished_goods_receipt": "FINISHED_GOODS_RECEIPT_PRINT",
        "sales_delivery": "SALES_DELIVERY_PRINT",
        "purchase_order": "PURCHASE_ORDER_PRINT",
        "purchase_receipt": "PURCHASE_RECEIPT_PRINT",
        "sales_forecast": "SALES_FORECAST_PRINT",
        "sales_order": "SALES_ORDER_PRINT",
        "other_inbound": "OTHER_INBOUND_PRINT",
        "other_outbound": "OTHER_OUTBOUND_PRINT",
        "quotation": "QUOTATION_PRINT",
        "material_borrow": "MATERIAL_BORROW_PRINT",
        "material_return": "MATERIAL_RETURN_PRINT",
        "delivery_notice": "DELIVERY_NOTICE_PRINT",
        "sample_trial": "SAMPLE_TRIAL_PRINT",
    }

    async def print_document(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        template_code: Optional[str] = None,
        template_uuid: Optional[str] = None,
        output_format: str = "html"
    ) -> Dict[str, Any]:
        """
        打印单据

        Args:
            tenant_id: 租户ID
            document_type: 单据类型
            document_id: 单据ID
            template_code: 模板代码（可选，与 template_uuid 二选一）
            template_uuid: 模板UUID（可选，优先于 template_code）
            output_format: 输出格式（html/pdf）

        Returns:
            Dict: 打印结果
        """
        # 获取单据数据
        document_data = await self._get_document_data(tenant_id, document_type, document_id)
        
        # 查找打印模板：优先 template_uuid，其次 template_code，最后默认模板
        try:
            from core.models.print_template import PrintTemplate
            
            if template_uuid:
                template = await PrintTemplate.filter(
                    tenant_id=tenant_id,
                    uuid=template_uuid,
                    is_active=True,
                    deleted_at__isnull=True
                ).first()
            else:
                if not template_code:
                    template_code = self.DOCUMENT_TEMPLATE_CODES.get(document_type)
                    if not template_code:
                        raise ValidationError(f"未找到单据类型 {document_type} 的默认打印模板")
                template = await PrintTemplate.filter(
                    tenant_id=tenant_id,
                    code=template_code,
                    is_active=True,
                    deleted_at__isnull=True
                ).first()
            
            if not template:
                # 如果没有找到模板，返回基础HTML格式
                logger.warning(f"未找到打印模板 {template_code}，使用默认格式")
                return await self._generate_default_print(document_type, document_data, output_format)
        except Exception as e:
            logger.error(f"获取打印模板失败: {e}")
            return await self._generate_default_print(document_type, document_data, output_format)

        # 渲染模板
        render_request = PrintTemplateRenderRequest(
            data=document_data,
            output_format=output_format,
            async_execution=False
        )
        
        render_result = await PrintTemplateService.render_print_template(
            tenant_id=tenant_id,
            uuid=str(template.uuid),
            data=render_request
        )

        return {
            "success": True,
            "document_type": document_type,
            "document_id": document_id,
            "template_code": template_code,
            "output_format": output_format,
            "content": render_result.get("content", ""),
            "message": "打印成功"
        }

    async def _get_document_data(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int
    ) -> Dict[str, Any]:
        """获取单据数据"""
        if document_type == "work_order":
            document = await WorkOrder.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"工单不存在: {document_id}")
            return await self._format_work_order_data(document)
        
        elif document_type == "production_picking":
            document = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"生产领料单不存在: {document_id}")
            return await self._format_production_picking_data(document)
        
        elif document_type == "production_return":
            document = await ProductionReturn.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"生产退料单不存在: {document_id}")
            return await self._format_production_return_data(document)
        
        elif document_type == "finished_goods_receipt":
            document = await FinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"成品入库单不存在: {document_id}")
            return await self._format_finished_goods_receipt_data(document)
        
        elif document_type == "sales_delivery":
            document = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"销售出库单不存在: {document_id}")
            return await self._format_sales_delivery_data(document)
        
        elif document_type == "purchase_order":
            document = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"采购单不存在: {document_id}")
            return await self._format_purchase_order_data(document)
        
        elif document_type == "purchase_receipt":
            document = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"采购入库单不存在: {document_id}")
            return await self._format_purchase_receipt_data(document)
        
        elif document_type == "sales_forecast":
            document = await SalesForecast.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"销售预测不存在: {document_id}")
            return await self._format_sales_forecast_data(document)
        
        elif document_type == "sales_order":
            document = await SalesOrder.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"销售订单不存在: {document_id}")
            return await self._format_sales_order_data(document)
        
        elif document_type == "other_inbound":
            document = await OtherInbound.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"其他入库单不存在: {document_id}")
            return await self._format_other_inbound_data(document)
        
        elif document_type == "other_outbound":
            document = await OtherOutbound.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"其他出库单不存在: {document_id}")
            return await self._format_other_outbound_data(document)
        
        elif document_type == "quotation":
            document = await Quotation.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"报价单不存在: {document_id}")
            return await self._format_quotation_data(document)
        
        elif document_type == "material_borrow":
            document = await MaterialBorrow.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"借料单不存在: {document_id}")
            return await self._format_material_borrow_data(document)
        
        elif document_type == "material_return":
            document = await MaterialReturn.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"还料单不存在: {document_id}")
            return await self._format_material_return_data(document)
        
        elif document_type == "delivery_notice":
            from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
            from apps.kuaizhizao.models.delivery_notice_item import DeliveryNoticeItem
            document = await DeliveryNotice.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"送货单不存在: {document_id}")
            return await self._format_delivery_notice_data(document)
        
        elif document_type == "sample_trial":
            from apps.kuaizhizao.models.sample_trial import SampleTrial
            from apps.kuaizhizao.models.sample_trial_item import SampleTrialItem
            document = await SampleTrial.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"样品试用单不存在: {document_id}")
            return await self._format_sample_trial_data(document)
        
        else:
            raise ValidationError(f"不支持的单据类型: {document_type}")

    async def _format_work_order_data(self, work_order: WorkOrder) -> Dict[str, Any]:
        """格式化工单数据，包含工序列表"""
        operations = await WorkOrderOperation.filter(
            work_order_id=work_order.id, deleted_at__isnull=True
        ).order_by("sequence")

        data: Dict[str, Any] = {
            "document_type": "work_order",
            "code": work_order.code,
            "name": work_order.name,
            "product_code": work_order.product_code,
            "product_name": work_order.product_name,
            "quantity": str(work_order.quantity),
            "status": work_order.status,
            "production_mode": work_order.production_mode,
            "workshop_name": work_order.workshop_name,
            "work_center_name": work_order.work_center_name,
            "planned_start_date": work_order.planned_start_date.isoformat() if work_order.planned_start_date else None,
            "planned_end_date": work_order.planned_end_date.isoformat() if work_order.planned_end_date else None,
            "priority": work_order.priority,
            "remarks": work_order.remarks,
            "created_by_name": work_order.created_by_name,
            "created_at": work_order.created_at.isoformat() if work_order.created_at else None,
        }

        ops_list = []
        for op in operations:
            ops_list.append({
                "operation_code": op.operation_code,
                "operation_name": op.operation_name,
                "sequence": op.sequence,
                "status": op.status,
                "workshop_name": op.workshop_name,
                "work_center_name": op.work_center_name,
                "planned_start_date": op.planned_start_date.isoformat() if op.planned_start_date else None,
                "planned_end_date": op.planned_end_date.isoformat() if op.planned_end_date else None,
                "actual_start_date": op.actual_start_date.isoformat() if op.actual_start_date else None,
                "actual_end_date": op.actual_end_date.isoformat() if op.actual_end_date else None,
                "completed_quantity": str(op.completed_quantity) if op.completed_quantity is not None else "",
                "qualified_quantity": str(op.qualified_quantity) if op.qualified_quantity is not None else "",
                "unqualified_quantity": str(op.unqualified_quantity) if op.unqualified_quantity is not None else "",
                "assigned_worker_name": op.assigned_worker_name,
                "assigned_equipment_name": op.assigned_equipment_name,
                "remarks": op.remarks,
            })
        data["operations"] = ops_list

        return data

    async def _format_production_picking_data(self, picking: ProductionPicking) -> Dict[str, Any]:
        """格式化生产领料单数据"""
        # TODO: 加载明细数据
        return {
            "document_type": "production_picking",
            "code": picking.picking_code,
            "work_order_code": picking.work_order_code,
            "workshop_name": picking.workshop_name,
            "status": picking.status,
            "picker_name": picking.picker_name,
            "picking_time": picking.picking_time.isoformat() if picking.picking_time else None,
            "created_at": picking.created_at.isoformat() if picking.created_at else None,
        }

    async def _format_production_return_data(self, ret: ProductionReturn) -> Dict[str, Any]:
        """格式化生产退料单数据"""
        return {
            "document_type": "production_return",
            "code": ret.return_code,
            "work_order_code": ret.work_order_code,
            "picking_code": ret.picking_code,
            "workshop_name": ret.workshop_name,
            "warehouse_name": ret.warehouse_name,
            "status": ret.status,
            "returner_name": ret.returner_name,
            "return_time": ret.return_time.isoformat() if ret.return_time else None,
            "created_at": ret.created_at.isoformat() if ret.created_at else None,
        }

    async def _format_finished_goods_receipt_data(self, receipt: FinishedGoodsReceipt) -> Dict[str, Any]:
        """格式化成品入库单数据"""
        # TODO: 加载明细数据
        return {
            "document_type": "finished_goods_receipt",
            "code": receipt.receipt_code,
            "work_order_code": receipt.work_order_code,
            "warehouse_name": receipt.warehouse_name,
            "total_quantity": str(receipt.total_quantity),
            "status": receipt.status,
            "receiver_name": receipt.receiver_name,
            "receipt_time": receipt.receipt_time.isoformat() if receipt.receipt_time else None,
            "created_at": receipt.created_at.isoformat() if receipt.created_at else None,
        }

    async def _format_sales_delivery_data(self, delivery: SalesDelivery) -> Dict[str, Any]:
        """格式化销售出库单数据"""
        # TODO: 加载明细数据
        return {
            "document_type": "sales_delivery",
            "code": delivery.delivery_code,
            "sales_order_code": delivery.sales_order_code,
            "customer_name": delivery.customer_name,
            "warehouse_name": delivery.warehouse_name,
            "total_quantity": str(delivery.total_quantity),
            "total_amount": str(delivery.total_amount),
            "status": delivery.status,
            "deliverer_name": delivery.deliverer_name,
            "delivery_time": delivery.delivery_time.isoformat() if delivery.delivery_time else None,
            "created_at": delivery.created_at.isoformat() if delivery.created_at else None,
        }

    async def _format_purchase_order_data(self, order: PurchaseOrder) -> Dict[str, Any]:
        """格式化采购单数据"""
        # TODO: 加载明细数据
        return {
            "document_type": "purchase_order",
            "code": order.order_code,
            "order_name": getattr(order, "order_name", None) or order.order_code,
            "supplier_name": order.supplier_name,
            "order_date": order.order_date.isoformat() if order.order_date else None,
            "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
            "total_amount": str(order.total_amount),
            "status": order.status,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }

    async def _format_purchase_receipt_data(self, receipt: PurchaseReceipt) -> Dict[str, Any]:
        """格式化采购入库单数据"""
        # TODO: 加载明细数据
        return {
            "document_type": "purchase_receipt",
            "code": receipt.receipt_code,
            "purchase_order_code": receipt.purchase_order_code,
            "supplier_name": receipt.supplier_name,
            "warehouse_name": receipt.warehouse_name,
            "total_quantity": str(receipt.total_quantity),
            "total_amount": str(receipt.total_amount),
            "status": receipt.status,
            "receiver_name": receipt.receiver_name,
            "receipt_time": receipt.receipt_time.isoformat() if receipt.receipt_time else None,
            "created_at": receipt.created_at.isoformat() if receipt.created_at else None,
        }

    async def _format_sales_forecast_data(self, forecast: SalesForecast) -> Dict[str, Any]:
        """格式化销售预测数据"""
        # TODO: 加载明细数据
        return {
            "document_type": "sales_forecast",
            "code": forecast.forecast_code,
            "name": forecast.forecast_name,
            "forecast_type": forecast.forecast_type,
            "start_date": forecast.start_date.isoformat() if forecast.start_date else None,
            "end_date": forecast.end_date.isoformat() if forecast.end_date else None,
            "status": forecast.status,
            "created_at": forecast.created_at.isoformat() if forecast.created_at else None,
        }

    async def _format_sales_order_data(self, order: SalesOrder) -> Dict[str, Any]:
        """格式化销售订单数据"""
        # TODO: 加载明细数据
        return {
            "document_type": "sales_order",
            "code": order.order_code,
            "order_name": getattr(order, "order_name", None) or order.order_code,
            "customer_name": order.customer_name,
            "order_date": order.order_date.isoformat() if order.order_date else None,
            "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
            "total_quantity": str(order.total_quantity),
            "total_amount": str(order.total_amount),
            "status": order.status,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }

    async def _format_other_inbound_data(self, inbound: OtherInbound) -> Dict[str, Any]:
        """格式化其他入库单数据"""
        items = await OtherInboundItem.filter(tenant_id=inbound.tenant_id, inbound_id=inbound.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_unit": i.material_unit,
                "inbound_quantity": str(i.inbound_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_amount),
                "batch_number": i.batch_number,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "other_inbound",
            "code": inbound.inbound_code,
            "reason_type": inbound.reason_type,
            "reason_desc": inbound.reason_desc,
            "warehouse_name": inbound.warehouse_name,
            "total_quantity": str(inbound.total_quantity),
            "total_amount": str(inbound.total_amount),
            "status": inbound.status,
            "receiver_name": inbound.receiver_name,
            "receipt_time": inbound.receipt_time.isoformat() if inbound.receipt_time else None,
            "notes": inbound.notes,
            "created_at": inbound.created_at.isoformat() if inbound.created_at else None,
            "items": items_data,
        }

    async def _format_other_outbound_data(self, outbound: OtherOutbound) -> Dict[str, Any]:
        """格式化其他出库单数据"""
        items = await OtherOutboundItem.filter(tenant_id=outbound.tenant_id, outbound_id=outbound.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_unit": i.material_unit,
                "outbound_quantity": str(i.outbound_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_amount),
                "batch_number": i.batch_number,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "other_outbound",
            "code": outbound.outbound_code,
            "reason_type": outbound.reason_type,
            "reason_desc": outbound.reason_desc,
            "warehouse_name": outbound.warehouse_name,
            "total_quantity": str(outbound.total_quantity),
            "total_amount": str(outbound.total_amount),
            "status": outbound.status,
            "deliverer_name": outbound.deliverer_name,
            "delivery_time": outbound.delivery_time.isoformat() if outbound.delivery_time else None,
            "notes": outbound.notes,
            "created_at": outbound.created_at.isoformat() if outbound.created_at else None,
            "items": items_data,
        }

    async def _format_quotation_data(self, quotation: Quotation) -> Dict[str, Any]:
        """格式化报价单数据"""
        items = await QuotationItem.filter(tenant_id=quotation.tenant_id, quotation_id=quotation.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "quote_quantity": str(i.quote_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_amount),
                "delivery_date": i.delivery_date.isoformat() if i.delivery_date else None,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "quotation",
            "code": quotation.quotation_code,
            "customer_name": quotation.customer_name,
            "customer_contact": quotation.customer_contact,
            "customer_phone": quotation.customer_phone,
            "quotation_date": quotation.quotation_date.isoformat() if quotation.quotation_date else None,
            "valid_until": quotation.valid_until.isoformat() if quotation.valid_until else None,
            "delivery_date": quotation.delivery_date.isoformat() if quotation.delivery_date else None,
            "total_quantity": str(quotation.total_quantity),
            "total_amount": str(quotation.total_amount),
            "status": quotation.status,
            "salesman_name": quotation.salesman_name,
            "shipping_address": quotation.shipping_address,
            "shipping_method": quotation.shipping_method,
            "payment_terms": quotation.payment_terms,
            "notes": quotation.notes,
            "created_at": quotation.created_at.isoformat() if quotation.created_at else None,
            "items": items_data,
        }

    async def _format_material_borrow_data(self, borrow: MaterialBorrow) -> Dict[str, Any]:
        """格式化借料单数据"""
        items = await MaterialBorrowItem.filter(tenant_id=borrow.tenant_id, borrow_id=borrow.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "borrow_quantity": str(i.borrow_quantity),
                "returned_quantity": str(i.returned_quantity or 0),
                "warehouse_name": i.warehouse_name,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "material_borrow",
            "code": borrow.borrow_code,
            "warehouse_name": borrow.warehouse_name,
            "borrower_name": borrow.borrower_name,
            "department": borrow.department,
            "expected_return_date": borrow.expected_return_date.isoformat() if borrow.expected_return_date else None,
            "borrow_time": borrow.borrow_time.isoformat() if borrow.borrow_time else None,
            "total_quantity": str(borrow.total_quantity),
            "status": borrow.status,
            "notes": borrow.notes,
            "created_at": borrow.created_at.isoformat() if borrow.created_at else None,
            "items": items_data,
        }

    async def _format_material_return_data(self, return_obj: MaterialReturn) -> Dict[str, Any]:
        """格式化还料单数据"""
        items = await MaterialReturnItem.filter(tenant_id=return_obj.tenant_id, return_id=return_obj.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "return_quantity": str(i.return_quantity),
                "warehouse_name": i.warehouse_name,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "material_return",
            "code": return_obj.return_code,
            "borrow_code": return_obj.borrow_code,
            "warehouse_name": return_obj.warehouse_name,
            "returner_name": return_obj.returner_name,
            "return_time": return_obj.return_time.isoformat() if return_obj.return_time else None,
            "total_quantity": str(return_obj.total_quantity),
            "status": return_obj.status,
            "notes": return_obj.notes,
            "created_at": return_obj.created_at.isoformat() if return_obj.created_at else None,
            "items": items_data,
        }

    async def _format_delivery_notice_data(self, notice) -> Dict[str, Any]:
        """格式化送货单数据"""
        from apps.kuaizhizao.models.delivery_notice_item import DeliveryNoticeItem
        items = await DeliveryNoticeItem.filter(tenant_id=notice.tenant_id, notice_id=notice.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "notice_quantity": str(i.notice_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_amount),
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "delivery_notice",
            "code": notice.notice_code,
            "sales_delivery_code": notice.sales_delivery_code,
            "sales_order_code": notice.sales_order_code,
            "customer_name": notice.customer_name,
            "customer_contact": notice.customer_contact,
            "customer_phone": notice.customer_phone,
            "planned_delivery_date": notice.planned_delivery_date.isoformat() if notice.planned_delivery_date else None,
            "carrier": notice.carrier,
            "tracking_number": notice.tracking_number,
            "shipping_address": notice.shipping_address,
            "status": notice.status,
            "sent_at": notice.sent_at.isoformat() if notice.sent_at else None,
            "total_quantity": str(notice.total_quantity),
            "total_amount": str(notice.total_amount),
            "notes": notice.notes,
            "created_at": notice.created_at.isoformat() if notice.created_at else None,
            "items": items_data,
        }

    async def _format_sample_trial_data(self, trial) -> Dict[str, Any]:
        """格式化样品试用单数据"""
        from apps.kuaizhizao.models.sample_trial_item import SampleTrialItem
        items = await SampleTrialItem.filter(tenant_id=trial.tenant_id, trial_id=trial.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "trial_quantity": str(i.trial_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_amount),
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "sample_trial",
            "code": trial.trial_code,
            "customer_name": trial.customer_name,
            "customer_contact": trial.customer_contact,
            "customer_phone": trial.customer_phone,
            "trial_purpose": trial.trial_purpose,
            "trial_period_start": trial.trial_period_start.isoformat() if trial.trial_period_start else None,
            "trial_period_end": trial.trial_period_end.isoformat() if trial.trial_period_end else None,
            "sales_order_code": trial.sales_order_code,
            "other_outbound_code": trial.other_outbound_code,
            "status": trial.status,
            "total_quantity": str(trial.total_quantity),
            "total_amount": str(trial.total_amount),
            "notes": trial.notes,
            "created_at": trial.created_at.isoformat() if trial.created_at else None,
            "items": items_data,
        }

    async def _generate_default_print(
        self,
        document_type: str,
        document_data: Dict[str, Any],
        output_format: str
    ) -> Dict[str, Any]:
        """生成默认打印格式（当没有模板时）"""
        # 生成简单的HTML格式
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>{document_data.get('code', '单据')}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                h1 {{ color: #333; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <h1>{document_data.get('code', '单据')}</h1>
            <table>
        """
        
        for key, value in document_data.items():
            if value is not None and key != "document_type":
                html_content += f"<tr><th>{key}</th><td>{value}</td></tr>\n"
        
        html_content += """
            </table>
        </body>
        </html>
        """
        
        return {
            "success": True,
            "document_type": document_type,
            "output_format": output_format,
            "content": html_content,
            "message": "使用默认格式打印"
        }

