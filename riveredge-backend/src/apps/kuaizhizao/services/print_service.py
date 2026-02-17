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
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_order import SalesOrder


class DocumentPrintService:
    """单据打印服务"""

    # 单据类型到模板代码的映射
    DOCUMENT_TEMPLATE_CODES = {
        "work_order": "WORK_ORDER_PRINT",
        "production_picking": "PRODUCTION_PICKING_PRINT",
        "finished_goods_receipt": "FINISHED_GOODS_RECEIPT_PRINT",
        "sales_delivery": "SALES_DELIVERY_PRINT",
        "purchase_order": "PURCHASE_ORDER_PRINT",
        "purchase_receipt": "PURCHASE_RECEIPT_PRINT",
        "sales_forecast": "SALES_FORECAST_PRINT",
        "sales_order": "SALES_ORDER_PRINT",
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
            "order_name": order.order_name,
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
            "order_name": order.order_name,
            "customer_name": order.customer_name,
            "order_date": order.order_date.isoformat() if order.order_date else None,
            "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
            "total_quantity": str(order.total_quantity),
            "total_amount": str(order.total_amount),
            "status": order.status,
            "created_at": order.created_at.isoformat() if order.created_at else None,
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

