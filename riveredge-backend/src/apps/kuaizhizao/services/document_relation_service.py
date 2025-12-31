"""
单据关联服务模块

提供单据关联关系查询和展示功能，支持单据上下游关联追溯。

Author: Luigi Lu
Date: 2025-01-01
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.mrp_result import MRPResult
from apps.kuaizhizao.models.lrp_result import LRPResult

from infra.exceptions.exceptions import NotFoundError, ValidationError


class DocumentRelationService:
    """单据关联服务"""

    # 单据类型映射
    DOCUMENT_TYPES = {
        "sales_forecast": {"model": SalesForecast, "code_field": "forecast_code", "name_field": "forecast_name"},
        "sales_order": {"model": SalesOrder, "code_field": "order_code", "name_field": "order_name"},
        "mrp_result": {"model": MRPResult, "code_field": None, "name_field": None},
        "lrp_result": {"model": LRPResult, "code_field": None, "name_field": None},
        "work_order": {"model": WorkOrder, "code_field": "code", "name_field": "name"},
        "production_picking": {"model": ProductionPicking, "code_field": "picking_code", "name_field": None},
        "reporting_record": {"model": ReportingRecord, "code_field": "reporting_code", "name_field": None},
        "finished_goods_receipt": {"model": FinishedGoodsReceipt, "code_field": "receipt_code", "name_field": None},
        "sales_delivery": {"model": SalesDelivery, "code_field": "delivery_code", "name_field": None},
        "purchase_order": {"model": PurchaseOrder, "code_field": "order_code", "name_field": "order_name"},
        "purchase_receipt": {"model": PurchaseReceipt, "code_field": "receipt_code", "name_field": None},
    }

    async def get_document_relations(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int
    ) -> Dict[str, Any]:
        """
        获取单据的关联关系（上游和下游单据）

        Args:
            tenant_id: 租户ID
            document_type: 单据类型（如：work_order, sales_forecast等）
            document_id: 单据ID

        Returns:
            Dict: 包含上游单据和下游单据的字典
        """
        if document_type not in self.DOCUMENT_TYPES:
            raise ValidationError(f"不支持的单据类型: {document_type}")

        upstream_documents = []
        downstream_documents = []

        # 根据单据类型查询关联关系
        if document_type == "sales_forecast":
            # 销售预测的下游：MRP运算结果、工单、销售出库单
            upstream_documents = []
            downstream_documents = await self._get_sales_forecast_downstream(tenant_id, document_id)

        elif document_type == "sales_order":
            # 销售订单的下游：LRP运算结果、工单、销售出库单
            upstream_documents = []
            downstream_documents = await self._get_sales_order_downstream(tenant_id, document_id)

        elif document_type == "mrp_result":
            # MRP运算结果的上游：销售预测，下游：工单、采购单
            upstream_documents = await self._get_mrp_result_upstream(tenant_id, document_id)
            downstream_documents = await self._get_mrp_result_downstream(tenant_id, document_id)

        elif document_type == "lrp_result":
            # LRP运算结果的上游：销售订单，下游：工单、采购单
            upstream_documents = await self._get_lrp_result_upstream(tenant_id, document_id)
            downstream_documents = await self._get_lrp_result_downstream(tenant_id, document_id)

        elif document_type == "work_order":
            # 工单的上游：销售预测/销售订单、MRP/LRP运算，下游：生产领料、报工记录、成品入库、销售出库
            upstream_documents = await self._get_work_order_upstream(tenant_id, document_id)
            downstream_documents = await self._get_work_order_downstream(tenant_id, document_id)

        elif document_type == "production_picking":
            # 生产领料的上游：工单，下游：报工记录
            upstream_documents = await self._get_production_picking_upstream(tenant_id, document_id)
            downstream_documents = await self._get_production_picking_downstream(tenant_id, document_id)

        elif document_type == "finished_goods_receipt":
            # 成品入库的上游：工单、报工记录，下游：销售出库单
            upstream_documents = await self._get_finished_goods_receipt_upstream(tenant_id, document_id)
            downstream_documents = await self._get_finished_goods_receipt_downstream(tenant_id, document_id)

        elif document_type == "purchase_order":
            # 采购单的上游：MRP/LRP运算，下游：采购入库单
            upstream_documents = await self._get_purchase_order_upstream(tenant_id, document_id)
            downstream_documents = await self._get_purchase_order_downstream(tenant_id, document_id)

        return {
            "document_type": document_type,
            "document_id": document_id,
            "upstream_documents": upstream_documents,
            "downstream_documents": downstream_documents,
            "upstream_count": len(upstream_documents),
            "downstream_count": len(downstream_documents)
        }

    async def trace_document_chain(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        direction: str = "both"  # "upstream", "downstream", "both"
    ) -> Dict[str, Any]:
        """
        追溯单据关联链（完整追溯）

        Args:
            tenant_id: 租户ID
            document_type: 单据类型
            document_id: 单据ID
            direction: 追溯方向（upstream: 向上追溯, downstream: 向下追溯, both: 双向追溯）

        Returns:
            Dict: 完整的关联链
        """
        chain = {
            "document_type": document_type,
            "document_id": document_id,
            "upstream_chain": [],
            "downstream_chain": []
        }

        if direction in ["upstream", "both"]:
            chain["upstream_chain"] = await self._trace_upstream(tenant_id, document_type, document_id)

        if direction in ["downstream", "both"]:
            chain["downstream_chain"] = await self._trace_downstream(tenant_id, document_type, document_id)

        return chain

    # ============ 上游单据查询方法 ============

    async def _get_sales_forecast_upstream(self, tenant_id: int, forecast_id: int) -> List[Dict[str, Any]]:
        """获取销售预测的上游单据（通常没有）"""
        return []

    async def _get_sales_order_upstream(self, tenant_id: int, order_id: int) -> List[Dict[str, Any]]:
        """获取销售订单的上游单据（通常没有）"""
        return []

    async def _get_mrp_result_upstream(self, tenant_id: int, result_id: int) -> List[Dict[str, Any]]:
        """获取MRP运算结果的上游单据（销售预测）"""
        result = await MRPResult.get_or_none(tenant_id=tenant_id, id=result_id)
        if not result:
            return []

        forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=result.forecast_id)
        if not forecast:
            return []

        return [{
            "document_type": "sales_forecast",
            "document_id": forecast.id,
            "document_code": forecast.forecast_code,
            "document_name": forecast.forecast_name,
            "status": forecast.status,
            "created_at": forecast.created_at.isoformat() if forecast.created_at else None
        }]

    async def _get_lrp_result_upstream(self, tenant_id: int, result_id: int) -> List[Dict[str, Any]]:
        """获取LRP运算结果的上游单据（销售订单）"""
        result = await LRPResult.get_or_none(tenant_id=tenant_id, id=result_id)
        if not result:
            return []

        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=result.sales_order_id)
        if not order:
            return []

        return [{
            "document_type": "sales_order",
            "document_id": order.id,
            "document_code": order.order_code,
            "document_name": order.order_name,
            "status": order.status,
            "created_at": order.created_at.isoformat() if order.created_at else None
        }]

    async def _get_work_order_upstream(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> List[Dict[str, Any]]:
        """获取工单的上游单据（销售预测/销售订单、MRP/LRP运算）"""
        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
        if not work_order:
            return []

        upstream = []

        # 如果是MTO模式，关联销售订单
        if work_order.sales_order_id:
            order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=work_order.sales_order_id)
            if order:
                upstream.append({
                    "document_type": "sales_order",
                    "document_id": order.id,
                    "document_code": order.order_code,
                    "document_name": order.order_name,
                    "status": order.status,
                    "created_at": order.created_at.isoformat() if order.created_at else None
                })

                # 查找关联的LRP运算结果
                lrp_results = await LRPResult.filter(
                    tenant_id=tenant_id,
                    sales_order_id=order.id
                ).limit(5)
                for lrp_result in lrp_results:
                    upstream.append({
                        "document_type": "lrp_result",
                        "document_id": lrp_result.id,
                        "document_code": None,
                        "document_name": f"LRP运算结果-{order.order_code}",
                        "status": lrp_result.computation_status,
                        "created_at": lrp_result.computation_time.isoformat() if lrp_result.computation_time else None
                    })

        # 查找MRP运算结果（通过物料ID和预测关联）
        # TODO: 这里需要更精确的关联逻辑

        return upstream

    async def _get_production_picking_upstream(
        self,
        tenant_id: int,
        picking_id: int
    ) -> List[Dict[str, Any]]:
        """获取生产领料的上游单据（工单）"""
        picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=picking_id)
        if not picking:
            return []

        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=picking.work_order_id)
        if not work_order:
            return []

        return [{
            "document_type": "work_order",
            "document_id": work_order.id,
            "document_code": work_order.code,
            "document_name": work_order.name,
            "status": work_order.status,
            "created_at": work_order.created_at.isoformat() if work_order.created_at else None
        }]

    async def _get_finished_goods_receipt_upstream(
        self,
        tenant_id: int,
        receipt_id: int
    ) -> List[Dict[str, Any]]:
        """获取成品入库的上游单据（工单、报工记录）"""
        receipt = await FinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            return []

        upstream = []

        # 关联工单
        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=receipt.work_order_id)
        if work_order:
            upstream.append({
                "document_type": "work_order",
                "document_id": work_order.id,
                "document_code": work_order.code,
                "document_name": work_order.name,
                "status": work_order.status,
                "created_at": work_order.created_at.isoformat() if work_order.created_at else None
            })

        # 关联报工记录
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=receipt.work_order_id
        ).limit(10)
        for record in reporting_records:
            upstream.append({
                "document_type": "reporting_record",
                "document_id": record.id,
                "document_code": record.work_order_code if hasattr(record, 'work_order_code') else None,
                "document_name": None,
                "status": record.status if hasattr(record, 'status') else None,
                "created_at": record.created_at.isoformat() if record.created_at else None
            })

        return upstream

    async def _get_purchase_order_upstream(
        self,
        tenant_id: int,
        order_id: int
    ) -> List[Dict[str, Any]]:
        """获取采购单的上游单据（MRP/LRP运算）"""
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order or not order.source_type or not order.source_id:
            return []

        upstream = []

        if order.source_type == "MRP":
            # 查找MRP运算结果
            mrp_result = await MRPResult.get_or_none(tenant_id=tenant_id, id=order.source_id)
            if mrp_result:
                upstream.append({
                    "document_type": "mrp_result",
                    "document_id": mrp_result.id,
                    "document_code": None,
                    "document_name": f"MRP运算结果",
                    "status": mrp_result.computation_status,
                    "created_at": mrp_result.computation_time.isoformat() if mrp_result.computation_time else None
                })

                # 查找关联的销售预测
                forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=mrp_result.forecast_id)
                if forecast:
                    upstream.append({
                        "document_type": "sales_forecast",
                        "document_id": forecast.id,
                        "document_code": forecast.forecast_code,
                        "document_name": forecast.forecast_name,
                        "status": forecast.status,
                        "created_at": forecast.created_at.isoformat() if forecast.created_at else None
                    })

        elif order.source_type == "LRP":
            # 查找LRP运算结果
            lrp_result = await LRPResult.get_or_none(tenant_id=tenant_id, id=order.source_id)
            if lrp_result:
                upstream.append({
                    "document_type": "lrp_result",
                    "document_id": lrp_result.id,
                    "document_code": None,
                    "document_name": f"LRP运算结果",
                    "status": lrp_result.computation_status,
                    "created_at": lrp_result.computation_time.isoformat() if lrp_result.computation_time else None
                })

                # 查找关联的销售订单
                sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=lrp_result.sales_order_id)
                if sales_order:
                    upstream.append({
                        "document_type": "sales_order",
                        "document_id": sales_order.id,
                        "document_code": sales_order.order_code,
                        "document_name": sales_order.order_name,
                        "status": sales_order.status,
                        "created_at": sales_order.created_at.isoformat() if sales_order.created_at else None
                    })

        return upstream

    # ============ 下游单据查询方法 ============

    async def _get_sales_forecast_downstream(
        self,
        tenant_id: int,
        forecast_id: int
    ) -> List[Dict[str, Any]]:
        """获取销售预测的下游单据（MRP运算结果、工单、销售出库单）"""
        downstream = []

        # MRP运算结果
        mrp_results = await MRPResult.filter(tenant_id=tenant_id, forecast_id=forecast_id).limit(10)
        for result in mrp_results:
            downstream.append({
                "document_type": "mrp_result",
                "document_id": result.id,
                "document_code": None,
                "document_name": f"MRP运算结果",
                "status": result.computation_status,
                "created_at": result.computation_time.isoformat() if result.computation_time else None
            })

        # TODO: 通过MRP结果查找工单和销售出库单

        return downstream

    async def _get_sales_order_downstream(
        self,
        tenant_id: int,
        order_id: int
    ) -> List[Dict[str, Any]]:
        """获取销售订单的下游单据（LRP运算结果、工单、销售出库单）"""
        downstream = []

        # LRP运算结果
        lrp_results = await LRPResult.filter(tenant_id=tenant_id, sales_order_id=order_id).limit(10)
        for result in lrp_results:
            downstream.append({
                "document_type": "lrp_result",
                "document_id": result.id,
                "document_code": None,
                "document_name": f"LRP运算结果",
                "status": result.computation_status,
                "created_at": result.computation_time.isoformat() if result.computation_time else None
            })

        # 工单（MTO模式）
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            sales_order_id=order_id
        ).limit(10)
        for wo in work_orders:
            downstream.append({
                "document_type": "work_order",
                "document_id": wo.id,
                "document_code": wo.code,
                "document_name": wo.name,
                "status": wo.status,
                "created_at": wo.created_at.isoformat() if wo.created_at else None
            })

        # 销售出库单
        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_id=order_id
        ).limit(10)
        for delivery in deliveries:
            downstream.append({
                "document_type": "sales_delivery",
                "document_id": delivery.id,
                "document_code": delivery.delivery_code if hasattr(delivery, 'delivery_code') else None,
                "document_name": None,
                "status": delivery.status if hasattr(delivery, 'status') else None,
                "created_at": delivery.created_at.isoformat() if delivery.created_at else None
            })

        return downstream

    async def _get_mrp_result_downstream(
        self,
        tenant_id: int,
        result_id: int
    ) -> List[Dict[str, Any]]:
        """获取MRP运算结果的下游单据（工单、采购单）"""
        downstream = []

        # TODO: 通过MRP结果查找工单和采购单
        # 这里需要更精确的关联逻辑

        return downstream

    async def _get_lrp_result_downstream(
        self,
        tenant_id: int,
        result_id: int
    ) -> List[Dict[str, Any]]:
        """获取LRP运算结果的下游单据（工单、采购单）"""
        downstream = []

        # TODO: 通过LRP结果查找工单和采购单
        # 这里需要更精确的关联逻辑

        return downstream

    async def _get_work_order_downstream(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> List[Dict[str, Any]]:
        """获取工单的下游单据（生产领料、报工记录、成品入库、销售出库）"""
        downstream = []

        # 生产领料单
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        ).limit(10)
        for picking in pickings:
            downstream.append({
                "document_type": "production_picking",
                "document_id": picking.id,
                "document_code": picking.picking_code,
                "document_name": None,
                "status": picking.status,
                "created_at": picking.created_at.isoformat() if picking.created_at else None
            })

        # 报工记录
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        ).limit(10)
        for record in reporting_records:
            downstream.append({
                "document_type": "reporting_record",
                "document_id": record.id,
                "document_code": record.work_order_code if hasattr(record, 'work_order_code') else None,
                "document_name": None,
                "status": record.status if hasattr(record, 'status') else None,
                "created_at": record.created_at.isoformat() if record.created_at else None
            })

        # 成品入库单
        receipts = await FinishedGoodsReceipt.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        ).limit(10)
        for receipt in receipts:
            downstream.append({
                "document_type": "finished_goods_receipt",
                "document_id": receipt.id,
                "document_code": receipt.receipt_code,
                "document_name": None,
                "status": receipt.status,
                "created_at": receipt.created_at.isoformat() if receipt.created_at else None
            })

        # 销售出库单（通过成品入库单关联）
        for receipt in receipts:
            if receipt.sales_order_id:
                deliveries = await SalesDelivery.filter(
                    tenant_id=tenant_id,
                    sales_order_id=receipt.sales_order_id
                ).limit(5)
                for delivery in deliveries:
                    downstream.append({
                        "document_type": "sales_delivery",
                        "document_id": delivery.id,
                        "document_code": delivery.delivery_code if hasattr(delivery, 'delivery_code') else None,
                        "document_name": None,
                        "status": delivery.status if hasattr(delivery, 'status') else None,
                        "created_at": delivery.created_at.isoformat() if delivery.created_at else None
                    })

        return downstream

    async def _get_production_picking_downstream(
        self,
        tenant_id: int,
        picking_id: int
    ) -> List[Dict[str, Any]]:
        """获取生产领料的下游单据（报工记录）"""
        picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=picking_id)
        if not picking:
            return []

        downstream = []

        # 报工记录
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=picking.work_order_id
        ).limit(10)
        for record in reporting_records:
            downstream.append({
                "document_type": "reporting_record",
                "document_id": record.id,
                "document_code": record.work_order_code if hasattr(record, 'work_order_code') else None,
                "document_name": None,
                "status": record.status if hasattr(record, 'status') else None,
                "created_at": record.created_at.isoformat() if record.created_at else None
            })

        return downstream

    async def _get_finished_goods_receipt_downstream(
        self,
        tenant_id: int,
        receipt_id: int
    ) -> List[Dict[str, Any]]:
        """获取成品入库的下游单据（销售出库单）"""
        receipt = await FinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            return []

        downstream = []

        # 销售出库单
        if receipt.sales_order_id:
            deliveries = await SalesDelivery.filter(
                tenant_id=tenant_id,
                sales_order_id=receipt.sales_order_id
            ).limit(10)
            for delivery in deliveries:
                downstream.append({
                    "document_type": "sales_delivery",
                    "document_id": delivery.id,
                    "document_code": delivery.delivery_code if hasattr(delivery, 'delivery_code') else None,
                    "document_name": None,
                    "status": delivery.status if hasattr(delivery, 'status') else None,
                    "created_at": delivery.created_at.isoformat() if delivery.created_at else None
                })

        return downstream

    async def _get_purchase_order_downstream(
        self,
        tenant_id: int,
        order_id: int
    ) -> List[Dict[str, Any]]:
        """获取采购单的下游单据（采购入库单）"""
        downstream = []

        # 采购入库单
        receipts = await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            purchase_order_id=order_id
        ).limit(10)
        for receipt in receipts:
            downstream.append({
                "document_type": "purchase_receipt",
                "document_id": receipt.id,
                "document_code": receipt.receipt_code if hasattr(receipt, 'receipt_code') else None,
                "document_name": None,
                "status": receipt.status if hasattr(receipt, 'status') else None,
                "created_at": receipt.created_at.isoformat() if receipt.created_at else None
            })

        return downstream

    # ============ 追溯方法 ============

    async def _trace_upstream(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        visited: Optional[set] = None
    ) -> List[Dict[str, Any]]:
        """向上追溯关联链"""
        if visited is None:
            visited = set()

        key = f"{document_type}:{document_id}"
        if key in visited:
            return []  # 避免循环引用

        visited.add(key)

        relations = await self.get_document_relations(tenant_id, document_type, document_id)
        chain = []

        for upstream in relations["upstream_documents"]:
            upstream_chain = await self._trace_upstream(
                tenant_id,
                upstream["document_type"],
                upstream["document_id"],
                visited
            )
            chain.append({
                "document": upstream,
                "upstream_chain": upstream_chain
            })

        return chain

    async def _trace_downstream(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        visited: Optional[set] = None
    ) -> List[Dict[str, Any]]:
        """向下追溯关联链"""
        if visited is None:
            visited = set()

        key = f"{document_type}:{document_id}"
        if key in visited:
            return []  # 避免循环引用

        visited.add(key)

        relations = await self.get_document_relations(tenant_id, document_type, document_id)
        chain = []

        for downstream in relations["downstream_documents"]:
            downstream_chain = await self._trace_downstream(
                tenant_id,
                downstream["document_type"],
                downstream["document_id"],
                visited
            )
            chain.append({
                "document": downstream,
                "downstream_chain": downstream_chain
            })

        return chain

