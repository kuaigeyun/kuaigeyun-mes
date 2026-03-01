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
from apps.kuaizhizao.models.production_return import ProductionReturn
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.material_borrow import MaterialBorrow
from apps.kuaizhizao.models.material_return import MaterialReturn
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_return import SalesReturn
from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_return import PurchaseReturn
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.production_plan import ProductionPlan
from apps.kuaizhizao.models.payable import Payable
from apps.kuaizhizao.models.receivable import Receivable
from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
from apps.kuaizhizao.models.process_inspection import ProcessInspection
from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
from apps.kuaizhizao.models.rework_order import ReworkOrder
from apps.kuaizhizao.models.outsource_order import OutsourceOrder
from apps.kuaizhizao.models.document_relation import DocumentRelation

from infra.exceptions.exceptions import NotFoundError, ValidationError


class DocumentRelationService:
    """单据关联服务"""

    # 单据类型映射
    DOCUMENT_TYPES = {
        "demand": {"model": Demand, "code_field": "demand_code", "name_field": "demand_name"},
        "sales_forecast": {"model": SalesForecast, "code_field": "forecast_code", "name_field": "forecast_name"},
        "sales_order": {"model": SalesOrder, "code_field": "order_code", "name_field": "order_name"},
        "quotation": {"model": Quotation, "code_field": "quotation_code", "name_field": None},
        "material_borrow": {"model": MaterialBorrow, "code_field": "borrow_code", "name_field": None},
        "material_return": {"model": MaterialReturn, "code_field": "return_code", "name_field": None},
        "demand_computation": {"model": DemandComputation, "code_field": "computation_code", "name_field": None},
        "work_order": {"model": WorkOrder, "code_field": "code", "name_field": "name"},
        "production_picking": {"model": ProductionPicking, "code_field": "picking_code", "name_field": None},
        "production_return": {"model": ProductionReturn, "code_field": "return_code", "name_field": None},
        "reporting_record": {"model": ReportingRecord, "code_field": "reporting_code", "name_field": None},
        "finished_goods_receipt": {"model": FinishedGoodsReceipt, "code_field": "receipt_code", "name_field": None},
        "sales_delivery": {"model": SalesDelivery, "code_field": "delivery_code", "name_field": None},
        "delivery_notice": {"model": DeliveryNotice, "code_field": "notice_code", "name_field": None},
        "purchase_order": {"model": PurchaseOrder, "code_field": "order_code", "name_field": "order_name"},
        "purchase_receipt": {"model": PurchaseReceipt, "code_field": "receipt_code", "name_field": None},
        "payable": {"model": Payable, "code_field": "payable_code", "name_field": None},
        "receivable": {"model": Receivable, "code_field": "receivable_code", "name_field": None},
        "incoming_inspection": {"model": IncomingInspection, "code_field": "inspection_code", "name_field": None},
        "process_inspection": {"model": ProcessInspection, "code_field": "inspection_code", "name_field": None},
        "finished_goods_inspection": {"model": FinishedGoodsInspection, "code_field": "inspection_code", "name_field": None},
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
        if document_type == "demand":
            # 统一需求的下游：需求计算、工单、销售出库单
            upstream_documents = []
            downstream_documents = await self._get_demand_downstream(tenant_id, document_id)
        
        elif document_type == "sales_forecast":
            # 销售预测的下游：MRP运算结果、工单、销售出库单
            upstream_documents = []
            downstream_documents = await self._get_sales_forecast_downstream(tenant_id, document_id)

        elif document_type == "sales_order":
            # 销售订单的下游：LRP运算结果、工单、销售出库单
            upstream_documents = []
            downstream_documents = await self._get_sales_order_downstream(tenant_id, document_id)

        elif document_type == "quotation":
            # 报价单的下游：销售订单（转订单后）
            upstream_documents = []
            downstream_documents = await self._get_quotation_downstream(tenant_id, document_id)

        elif document_type == "material_borrow":
            # 借料单的下游：还料单
            upstream_documents = []
            downstream_documents = await self._get_material_borrow_downstream(tenant_id, document_id)

        elif document_type == "material_return":
            # 还料单的上游：借料单
            upstream_documents = await self._get_material_return_upstream(tenant_id, document_id)
            downstream_documents = []

        elif document_type == "demand_computation":
            # 需求计算的上游：需求/销售预测/销售订单，下游：工单、采购单
            upstream_documents = await self._get_demand_computation_upstream(tenant_id, document_id)
            downstream_documents = await self._get_demand_computation_downstream(tenant_id, document_id)

        elif document_type == "work_order":
            # 工单的上游：销售预测/销售订单、MRP/LRP运算，下游：生产领料、报工记录、成品入库、销售出库
            upstream_documents = await self._get_work_order_upstream(tenant_id, document_id)
            downstream_documents = await self._get_work_order_downstream(tenant_id, document_id)

        elif document_type == "production_picking":
            # 生产领料的上游：工单，下游：报工记录、生产退料
            upstream_documents = await self._get_production_picking_upstream(tenant_id, document_id)
            downstream_documents = await self._get_production_picking_downstream(tenant_id, document_id)

        elif document_type == "production_return":
            # 生产退料的上游：工单、生产领料，下游：无
            upstream_documents = await self._get_production_return_upstream(tenant_id, document_id)
            downstream_documents = []

        elif document_type == "finished_goods_receipt":
            # 成品入库的上游：工单、报工记录，下游：销售出库单
            upstream_documents = await self._get_finished_goods_receipt_upstream(tenant_id, document_id)
            downstream_documents = await self._get_finished_goods_receipt_downstream(tenant_id, document_id)

        elif document_type == "purchase_order":
            # 采购单的上游：MRP/LRP运算，下游：采购入库单
            upstream_documents = await self._get_purchase_order_upstream(tenant_id, document_id)
            downstream_documents = await self._get_purchase_order_downstream(tenant_id, document_id)

        elif document_type == "purchase_receipt":
            # 采购入库单的上游：采购单，下游：应付单
            upstream_documents = await self._get_purchase_receipt_upstream(tenant_id, document_id)
            downstream_documents = await self._get_purchase_receipt_downstream(tenant_id, document_id)

        elif document_type == "payable":
            # 应付单的上游：采购入库单
            upstream_documents = await self._get_payable_upstream(tenant_id, document_id)
            downstream_documents = []

        elif document_type == "receivable":
            # 应收单的上游：销售出库单
            upstream_documents = await self._get_receivable_upstream(tenant_id, document_id)
            downstream_documents = []

        elif document_type == "incoming_inspection":
            # 来料检验单的上游：采购入库单
            upstream_documents = await self._get_incoming_inspection_upstream(tenant_id, document_id)
            downstream_documents = []

        elif document_type == "process_inspection":
            # 过程检验单的上游：工单、报工记录
            upstream_documents = await self._get_process_inspection_upstream(tenant_id, document_id)
            downstream_documents = []

        elif document_type == "finished_goods_inspection":
            # 成品检验单的上游：工单、成品入库单
            upstream_documents = await self._get_finished_goods_inspection_upstream(tenant_id, document_id)
            downstream_documents = []

        elif document_type == "sales_delivery":
            # 销售出库单的上游：销售订单/销售预测、工单、成品入库单，下游：应收单、送货单
            upstream_documents = await self._get_sales_delivery_upstream(tenant_id, document_id)
            downstream_documents = await self._get_sales_delivery_downstream(tenant_id, document_id)

        elif document_type == "delivery_notice":
            # 送货单的上游：销售出库单、销售订单
            upstream_documents = await self._get_delivery_notice_upstream(tenant_id, document_id)
            downstream_documents = []

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

    async def _get_demand_computation_upstream(self, tenant_id: int, computation_id: int) -> List[Dict[str, Any]]:
        """获取需求计算的上游单据（需求、销售预测/销售订单）"""
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            return []

        upstream = []

        # 需求
        demand = await Demand.get_or_none(tenant_id=tenant_id, id=computation.demand_id)
        if demand:
            upstream.append({
                "document_type": "demand",
                "document_id": demand.id,
                "document_code": demand.demand_code,
                "document_name": getattr(demand, "demand_name", None) or demand.demand_code,
                "status": getattr(demand, "status", None),
                "created_at": demand.created_at.isoformat() if demand.created_at else None
            })

            # 根据需求来源追溯销售预测或销售订单
            if demand.source_type == "sales_forecast" and demand.source_id:
                forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                if forecast:
                    upstream.append({
                        "document_type": "sales_forecast",
                        "document_id": forecast.id,
                        "document_code": forecast.forecast_code,
                        "document_name": forecast.forecast_name,
                        "status": forecast.status,
                        "created_at": forecast.created_at.isoformat() if forecast.created_at else None
                    })
            elif demand.source_type == "sales_order" and demand.source_id:
                order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                if order:
                    upstream.append({
                        "document_type": "sales_order",
                        "document_id": order.id,
                        "document_code": order.order_code,
                        "document_name": getattr(order, "order_name", None) or order.order_code,
                        "status": order.status,
                        "created_at": order.created_at.isoformat() if order.created_at else None
                    })

        return upstream

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

        # MTO模式：关联销售订单及需求计算
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
                # 通过 Demand 查找关联的需求计算
                demand = await Demand.get_or_none(
                    tenant_id=tenant_id,
                    source_type="sales_order",
                    source_id=order.id,
                    deleted_at__isnull=True,
                )
                if demand and demand.computation_id:
                    comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=demand.computation_id)
                    if comp:
                        upstream.append({
                            "document_type": "demand_computation",
                            "document_id": comp.id,
                            "document_code": comp.computation_code,
                            "document_name": f"需求计算-{comp.computation_code}",
                            "status": comp.computation_status,
                            "created_at": comp.computation_start_time.isoformat() if comp.computation_start_time else None
                        })

        # MTS模式：通过 DocumentRelation 查找需求计算（工单作为 target 时）
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        comp_relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            target_type="work_order",
            target_id=work_order_id,
            source_type="demand_computation",
        ).limit(5)
        for rel in comp_relations:
            comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=rel.source_id)
            if comp and not any(u.get("document_type") == "demand_computation" and u.get("document_id") == comp.id for u in upstream):
                upstream.append({
                    "document_type": "demand_computation",
                    "document_id": comp.id,
                    "document_code": comp.computation_code,
                    "document_name": f"需求计算-{comp.computation_code}",
                    "status": comp.computation_status,
                    "created_at": comp.computation_start_time.isoformat() if comp.computation_start_time else None
                })
                demand = await Demand.get_or_none(tenant_id=tenant_id, id=comp.demand_id)
                if demand and demand.source_type == "sales_forecast" and demand.source_id:
                    forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                    if forecast and not any(u.get("document_type") == "sales_forecast" and u.get("document_id") == forecast.id for u in upstream):
                        upstream.append({
                            "document_type": "sales_forecast",
                            "document_id": forecast.id,
                            "document_code": forecast.forecast_code,
                            "document_name": forecast.forecast_name,
                            "status": forecast.status,
                            "created_at": forecast.created_at.isoformat() if forecast.created_at else None
                        })

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

    async def _get_production_return_upstream(
        self,
        tenant_id: int,
        return_id: int
    ) -> List[Dict[str, Any]]:
        """获取生产退料的上游单据（工单、生产领料）"""
        ret = await ProductionReturn.get_or_none(tenant_id=tenant_id, id=return_id)
        if not ret:
            return []

        upstream = []

        # 工单
        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=ret.work_order_id)
        if work_order:
            upstream.append({
                "document_type": "work_order",
                "document_id": work_order.id,
                "document_code": work_order.code,
                "document_name": work_order.name,
                "status": work_order.status,
                "created_at": work_order.created_at.isoformat() if work_order.created_at else None
            })

        # 领料单
        if ret.picking_id:
            picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=ret.picking_id)
            if picking:
                upstream.append({
                    "document_type": "production_picking",
                    "document_id": picking.id,
                    "document_code": picking.picking_code,
                    "document_name": None,
                    "status": picking.status,
                    "created_at": picking.created_at.isoformat() if picking.created_at else None
                })

        return upstream

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
        """获取采购单的上游单据（需求计算，统一替代 MRP/LRP）"""
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order or not order.source_type or not order.source_id:
            return []

        upstream = []

        # source_type 为 MRP/LRP 或 demand_computation 时，source_id 均为 DemandComputation.id
        if order.source_type in ("MRP", "LRP", "demand_computation"):
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=order.source_id)
            if computation:
                upstream.append({
                    "document_type": "demand_computation",
                    "document_id": computation.id,
                    "document_code": computation.computation_code,
                    "document_name": f"需求计算-{computation.computation_code}",
                    "status": computation.computation_status,
                    "created_at": computation.computation_start_time.isoformat() if computation.computation_start_time else None
                })
                demand = await Demand.get_or_none(tenant_id=tenant_id, id=computation.demand_id)
                if demand:
                    if demand.source_type == "sales_forecast" and demand.source_id:
                        forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                        if forecast:
                            upstream.append({
                                "document_type": "sales_forecast",
                                "document_id": forecast.id,
                                "document_code": forecast.forecast_code,
                                "document_name": forecast.forecast_name,
                                "status": forecast.status,
                                "created_at": forecast.created_at.isoformat() if forecast.created_at else None
                            })
                    elif demand.source_type == "sales_order" and demand.source_id:
                        sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                        if sales_order:
                            upstream.append({
                                "document_type": "sales_order",
                                "document_id": sales_order.id,
                                "document_code": sales_order.order_code,
                                "document_name": getattr(sales_order, "order_name", None) or sales_order.order_code,
                                "status": sales_order.status,
                                "created_at": sales_order.created_at.isoformat() if sales_order.created_at else None
                            })

        return upstream

    async def _get_purchase_receipt_upstream(
        self,
        tenant_id: int,
        receipt_id: int
    ) -> List[Dict[str, Any]]:
        """获取采购入库单的上游单据（采购单）"""
        receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=receipt_id)
        if not receipt:
            return []

        upstream = []

        # 关联采购单
        purchase_order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=receipt.purchase_order_id)
        if purchase_order:
            upstream.append({
                "document_type": "purchase_order",
                "document_id": purchase_order.id,
                "document_code": purchase_order.order_code,
                "document_name": purchase_order.order_name if hasattr(purchase_order, 'order_name') else None,
                "status": purchase_order.status,
                "created_at": purchase_order.created_at.isoformat() if purchase_order.created_at else None
            })

            # 如果采购单有来源，继续向上追溯（需求计算）
            if purchase_order.source_type and purchase_order.source_id and purchase_order.source_type in ("MRP", "LRP", "demand_computation"):
                computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=purchase_order.source_id)
                if computation:
                    upstream.append({
                        "document_type": "demand_computation",
                        "document_id": computation.id,
                        "document_code": computation.computation_code,
                        "document_name": f"需求计算-{computation.computation_code}",
                        "status": computation.computation_status,
                        "created_at": computation.computation_start_time.isoformat() if computation.computation_start_time else None
                    })
                    demand = await Demand.get_or_none(tenant_id=tenant_id, id=computation.demand_id)
                    if demand:
                        if demand.source_type == "sales_forecast" and demand.source_id:
                            forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                            if forecast:
                                upstream.append({
                                    "document_type": "sales_forecast",
                                    "document_id": forecast.id,
                                    "document_code": forecast.forecast_code,
                                    "document_name": forecast.forecast_name,
                                    "status": forecast.status,
                                    "created_at": forecast.created_at.isoformat() if forecast.created_at else None
                                })
                        elif demand.source_type == "sales_order" and demand.source_id:
                            sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                            if sales_order:
                                upstream.append({
                                    "document_type": "sales_order",
                                    "document_id": sales_order.id,
                                    "document_code": sales_order.order_code,
                                    "document_name": getattr(sales_order, "order_name", None) or sales_order.order_code,
                                    "status": sales_order.status,
                                    "created_at": sales_order.created_at.isoformat() if sales_order.created_at else None
                                })

        return upstream

    async def _get_payable_upstream(
        self,
        tenant_id: int,
        payable_id: int
    ) -> List[Dict[str, Any]]:
        """获取应付单的上游单据（采购入库单）"""
        payable = await Payable.get_or_none(tenant_id=tenant_id, id=payable_id)
        if not payable:
            return []

        upstream = []

        # 通过source_type和source_id查找来源单据
        if payable.source_type == "采购入库" and payable.source_id:
            receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=payable.source_id)
            if receipt:
                upstream.append({
                    "document_type": "purchase_receipt",
                    "document_id": receipt.id,
                    "document_code": receipt.receipt_code,
                    "document_name": None,
                    "status": receipt.status,
                    "created_at": receipt.created_at.isoformat() if receipt.created_at else None
                })

                # 继续向上追溯采购单
                purchase_order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=receipt.purchase_order_id)
                if purchase_order:
                    upstream.append({
                        "document_type": "purchase_order",
                        "document_id": purchase_order.id,
                        "document_code": purchase_order.order_code,
                        "document_name": purchase_order.order_name if hasattr(purchase_order, 'order_name') else None,
                        "status": purchase_order.status,
                        "created_at": purchase_order.created_at.isoformat() if purchase_order.created_at else None
                    })

        return upstream

    async def _get_incoming_inspection_upstream(
        self,
        tenant_id: int,
        inspection_id: int
    ) -> List[Dict[str, Any]]:
        """获取来料检验单的上游单据（采购入库单）"""
        inspection = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            return []

        upstream = []

        # 关联采购入库单
        if inspection.purchase_receipt_id:
            receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=inspection.purchase_receipt_id)
            if receipt:
                upstream.append({
                    "document_type": "purchase_receipt",
                    "document_id": receipt.id,
                    "document_code": receipt.receipt_code,
                    "document_name": None,
                    "status": receipt.status,
                    "created_at": receipt.created_at.isoformat() if receipt.created_at else None
                })

                # 继续向上追溯采购单
                purchase_order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=receipt.purchase_order_id)
                if purchase_order:
                    upstream.append({
                        "document_type": "purchase_order",
                        "document_id": purchase_order.id,
                        "document_code": purchase_order.order_code,
                        "document_name": purchase_order.order_name if hasattr(purchase_order, 'order_name') else None,
                        "status": purchase_order.status,
                        "created_at": purchase_order.created_at.isoformat() if purchase_order.created_at else None
                    })

        return upstream

    async def _get_process_inspection_upstream(
        self,
        tenant_id: int,
        inspection_id: int
    ) -> List[Dict[str, Any]]:
        """获取过程检验单的上游单据（工单、报工记录）"""
        inspection = await ProcessInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            return []

        upstream = []

        # 关联工单
        if inspection.work_order_id:
            from apps.kuaizhizao.models.work_order import WorkOrder
            work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=inspection.work_order_id)
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
        if inspection.work_order_id and inspection.operation_id:
            from apps.kuaizhizao.models.reporting_record import ReportingRecord
            reporting = await ReportingRecord.filter(
                tenant_id=tenant_id,
                work_order_id=inspection.work_order_id,
                operation_id=inspection.operation_id
            ).order_by('-created_at').first()
            
            if reporting:
                upstream.append({
                    "document_type": "reporting_record",
                    "document_id": reporting.id,
                    "document_code": reporting.reporting_code,
                    "document_name": None,
                    "status": reporting.status,
                    "created_at": reporting.created_at.isoformat() if reporting.created_at else None
                })

        return upstream

    async def _get_finished_goods_inspection_upstream(
        self,
        tenant_id: int,
        inspection_id: int
    ) -> List[Dict[str, Any]]:
        """获取成品检验单的上游单据（工单、成品入库单）"""
        inspection = await FinishedGoodsInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            return []

        upstream = []

        # 关联工单
        if inspection.work_order_id:
            from apps.kuaizhizao.models.work_order import WorkOrder
            work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=inspection.work_order_id)
            if work_order:
                upstream.append({
                    "document_type": "work_order",
                    "document_id": work_order.id,
                    "document_code": work_order.code,
                    "document_name": work_order.name,
                    "status": work_order.status,
                    "created_at": work_order.created_at.isoformat() if work_order.created_at else None
                })

        # 关联成品入库单
        if inspection.work_order_id:
            from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
            receipt = await FinishedGoodsReceipt.filter(
                tenant_id=tenant_id,
                work_order_id=inspection.work_order_id
            ).order_by('-created_at').first()
            
            if receipt:
                upstream.append({
                    "document_type": "finished_goods_receipt",
                    "document_id": receipt.id,
                    "document_code": receipt.receipt_code,
                    "document_name": None,
                    "status": receipt.status,
                    "created_at": receipt.created_at.isoformat() if receipt.created_at else None
                })

        return upstream

    async def _get_sales_delivery_upstream(
        self,
        tenant_id: int,
        delivery_id: int
    ) -> List[Dict[str, Any]]:
        """获取销售出库单的上游单据（销售订单、工单、成品入库单）"""
        delivery = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=delivery_id)
        if not delivery:
            return []

        upstream = []

        # 关联销售订单
        if delivery.sales_order_id:
            order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=delivery.sales_order_id)
            if order:
                upstream.append({
                    "document_type": "sales_order",
                    "document_id": order.id,
                    "document_code": order.order_code,
                    "document_name": order.order_name if hasattr(order, 'order_name') else None,
                    "status": order.status,
                    "created_at": order.created_at.isoformat() if order.created_at else None
                })

        # 关联工单（通过销售订单查找）
        if delivery.sales_order_id:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                sales_order_id=delivery.sales_order_id
            ).limit(10)
            for wo in work_orders:
                upstream.append({
                    "document_type": "work_order",
                    "document_id": wo.id,
                    "document_code": wo.code,
                    "document_name": wo.name,
                    "status": wo.status,
                    "created_at": wo.created_at.isoformat() if wo.created_at else None
                })

        # 关联成品入库单（通过工单查找）
        if delivery.sales_order_id:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                sales_order_id=delivery.sales_order_id
            ).limit(10)
            for wo in work_orders:
                receipts = await FinishedGoodsReceipt.filter(
                    tenant_id=tenant_id,
                    work_order_id=wo.id
                ).limit(10)
                for receipt in receipts:
                    upstream.append({
                        "document_type": "finished_goods_receipt",
                        "document_id": receipt.id,
                        "document_code": receipt.receipt_code if hasattr(receipt, 'receipt_code') else None,
                        "document_name": None,
                        "status": receipt.status if hasattr(receipt, 'status') else None,
                        "created_at": receipt.created_at.isoformat() if receipt.created_at else None
                    })

        return upstream

    async def _get_sales_delivery_downstream(
        self,
        tenant_id: int,
        delivery_id: int
    ) -> List[Dict[str, Any]]:
        """获取销售出库单的下游单据（应收单、送货单）"""
        downstream = []

        # 查找关联的送货单
        notices = await DeliveryNotice.filter(
            tenant_id=tenant_id,
            sales_delivery_id=delivery_id,
            deleted_at__isnull=True
        ).limit(10)
        for notice in notices:
            downstream.append({
                "document_type": "delivery_notice",
                "document_id": notice.id,
                "document_code": notice.notice_code,
                "document_name": None,
                "status": notice.status,
                "created_at": notice.created_at.isoformat() if notice.created_at else None,
            })

        # 通过source_type和source_id查找应收单
        receivables = await Receivable.filter(
            tenant_id=tenant_id,
            source_type="销售出库",
            source_id=delivery_id
        ).limit(10)
        for receivable in receivables:
            downstream.append({
                "document_type": "receivable",
                "document_id": receivable.id,
                "document_code": receivable.receivable_code if hasattr(receivable, 'receivable_code') else None,
                "document_name": None,
                "status": receivable.status if hasattr(receivable, 'status') else None,
                "created_at": receivable.created_at.isoformat() if receivable.created_at else None
            })

        # 销售退货单
        sales_returns = await SalesReturn.filter(
            tenant_id=tenant_id,
            sales_delivery_id=delivery_id,
            deleted_at__isnull=True
        ).limit(10)
        for sr in sales_returns:
            downstream.append({
                "document_type": "sales_return",
                "document_id": sr.id,
                "document_code": sr.return_code,
                "document_name": None,
                "status": sr.status if hasattr(sr, 'status') else None,
                "created_at": sr.created_at.isoformat() if sr.created_at else None
            })

        return downstream

    async def _get_receivable_upstream(
        self,
        tenant_id: int,
        receivable_id: int
    ) -> List[Dict[str, Any]]:
        """获取应收单的上游单据（销售出库单）"""
        receivable = await Receivable.get_or_none(tenant_id=tenant_id, id=receivable_id)
        if not receivable:
            return []

        upstream = []

        # 通过source_type和source_id查找来源单据
        if receivable.source_type == "销售出库" and receivable.source_id:
            delivery = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=receivable.source_id)
            if delivery:
                upstream.append({
                    "document_type": "sales_delivery",
                    "document_id": delivery.id,
                    "document_code": delivery.delivery_code if hasattr(delivery, 'delivery_code') else None,
                    "document_name": None,
                    "status": delivery.status if hasattr(delivery, 'status') else None,
                    "created_at": delivery.created_at.isoformat() if delivery.created_at else None
                })

                # 继续向上追溯销售订单
                if delivery.sales_order_id:
                    sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=delivery.sales_order_id)
                    if sales_order:
                        upstream.append({
                            "document_type": "sales_order",
                            "document_id": sales_order.id,
                            "document_code": sales_order.order_code,
                            "document_name": getattr(sales_order, "order_name", None) or sales_order.order_code,
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
        """获取销售预测的下游单据（需求计算、工单、采购单、销售出库单）"""
        downstream = []

        # 通过 Demand 查找需求计算
        demand = await Demand.get_or_none(
            tenant_id=tenant_id,
            source_type="sales_forecast",
            source_id=forecast_id,
            deleted_at__isnull=True,
        )
        if demand and demand.computation_id:
            comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=demand.computation_id)
            if comp:
                downstream.append({
                    "document_type": "demand_computation",
                    "document_id": comp.id,
                    "document_code": comp.computation_code,
                    "document_name": f"需求计算-{comp.computation_code}",
                    "status": comp.computation_status,
                    "created_at": comp.computation_start_time.isoformat() if comp.computation_start_time else None
                })
                # 通过需求计算查找采购单（source_type 为 MRP 或 demand_computation，source_id 为 computation_id）
                purchase_orders = await PurchaseOrder.filter(
                    tenant_id=tenant_id,
                    source_id=comp.id,
                ).limit(10)
                for po in purchase_orders:
                    downstream.append({
                        "document_type": "purchase_order",
                        "document_id": po.id,
                        "document_code": po.order_code,
                        "document_name": po.order_name if hasattr(po, 'order_name') else None,
                        "status": po.status,
                        "created_at": po.created_at.isoformat() if po.created_at else None
                    })

        # 通过 DemandItem 查找工单（MTS 模式）
        from apps.kuaizhizao.models.demand_item import DemandItem
        if demand:
            demand_items = await DemandItem.filter(tenant_id=tenant_id, demand_id=demand.id).limit(20)
            work_order_ids = [di.work_order_id for di in demand_items if di.work_order_id]
            if work_order_ids:
                work_orders = await WorkOrder.filter(tenant_id=tenant_id, id__in=work_order_ids).limit(10)
                for wo in work_orders:
                    downstream.append({
                        "document_type": "work_order",
                        "document_id": wo.id,
                        "document_code": wo.code,
                        "document_name": wo.name,
                        "status": wo.status,
                        "created_at": wo.created_at.isoformat() if wo.created_at else None
                    })

        return downstream

    async def _get_demand_downstream(
        self,
        tenant_id: int,
        demand_id: int
    ) -> List[Dict[str, Any]]:
        """获取统一需求的下游单据（需求计算、工单、销售出库单）"""
        downstream = []
        
        # 获取需求
        demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
        if not demand:
            return []
        
        # 如果已下推到需求计算，显示计算编码
        if demand.pushed_to_computation and demand.computation_code:
            downstream.append({
                "document_type": "demand_computation",
                "document_id": demand.computation_id or 0,
                "document_code": demand.computation_code,
                "document_name": f"需求计算-{demand.computation_code}",
                "status": "已下推",
                "created_at": demand.updated_at.isoformat() if demand.updated_at else None
            })
        
        # 根据需求类型查询下游单据
        if demand.demand_type == "sales_forecast":
            # 销售预测的下游：MRP运算结果、工单、销售出库单
            # TODO: 步骤1.2实现统一需求计算后，这里应该查询需求计算结果
            # 目前先查询通过需求明细关联的工单
            from apps.kuaizhizao.models.demand_item import DemandItem
            demand_items = await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id
            ).limit(10)
            
            # 通过需求明细的work_order_id查找工单
            work_order_ids = [item.work_order_id for item in demand_items if item.work_order_id]
            if work_order_ids:
                work_orders = await WorkOrder.filter(
                    tenant_id=tenant_id,
                    id__in=work_order_ids
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
        
        elif demand.demand_type == "sales_order":
            # 销售订单的下游：LRP运算结果、工单、销售出库单
            # TODO: 步骤1.2实现统一需求计算后，这里应该查询需求计算结果
            # 目前先查询通过需求明细关联的工单
            from apps.kuaizhizao.models.demand_item import DemandItem
            demand_items = await DemandItem.filter(
                tenant_id=tenant_id,
                demand_id=demand_id
            ).limit(10)
            
            # 通过需求明细的work_order_id查找工单
            work_order_ids = [item.work_order_id for item in demand_items if item.work_order_id]
            if work_order_ids:
                work_orders = await WorkOrder.filter(
                    tenant_id=tenant_id,
                    id__in=work_order_ids
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
            
            # 销售出库单（通过销售订单ID关联）
            sales_deliveries = await SalesDelivery.filter(
                tenant_id=tenant_id,
                sales_order_id=demand_id  # TODO: 需要确认SalesDelivery是否有sales_order_id字段
            ).limit(10)
            for delivery in sales_deliveries:
                downstream.append({
                    "document_type": "sales_delivery",
                    "document_id": delivery.id,
                    "document_code": delivery.delivery_code,
                    "document_name": None,
                    "status": delivery.status,
                    "created_at": delivery.created_at.isoformat() if delivery.created_at else None
                })
        
        return downstream

    async def _get_sales_order_downstream(
        self,
        tenant_id: int,
        order_id: int
    ) -> List[Dict[str, Any]]:
        """获取销售订单的下游单据（需求计算、工单、销售出库单）"""
        downstream = []

        # 通过 Demand 查找需求计算
        demand = await Demand.get_or_none(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id=order_id,
            deleted_at__isnull=True,
        )
        if demand and demand.computation_id:
            comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=demand.computation_id)
            if comp:
                downstream.append({
                    "document_type": "demand_computation",
                    "document_id": comp.id,
                    "document_code": comp.computation_code,
                    "document_name": f"需求计算-{comp.computation_code}",
                    "status": comp.computation_status,
                    "created_at": comp.computation_start_time.isoformat() if comp.computation_start_time else None
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

    async def get_change_impact_sales_order(
        self,
        tenant_id: int,
        order_id: int
    ) -> Dict[str, Any]:
        """
        获取销售订单变更对下游的影响范围（排程管理增强）
        用于上游单据变更时，展示受影响的需求、需求计算、生产计划、工单及建议操作。

        .. deprecated:: 请使用 DocumentRelationNewService.get_change_impact_sales_order，
           与 trace 使用相同数据源（get_relations），保证变更影响与追溯链一致。
        """
        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=order_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError(f"销售订单不存在: {order_id}")

        upstream_change = {
            "type": "sales_order",
            "id": order.id,
            "code": getattr(order, "order_code", None),
            "name": getattr(order, "order_name", None),
            "changed_at": order.updated_at.isoformat() if order.updated_at else None,
        }

        affected_demands = []
        affected_computations = []
        affected_plans = []
        affected_work_orders = []
        computation_ids = set()

        # 需求（source_type=sales_order, source_id=order_id）
        demands = await Demand.filter(
            tenant_id=tenant_id,
            source_type="sales_order",
            source_id=order_id,
            deleted_at__isnull=True,
        ).all()
        for d in demands:
            affected_demands.append({
                "id": d.id,
                "code": getattr(d, "demand_code", None),
                "name": getattr(d, "demand_name", None),
                "status": getattr(d, "status", None),
            })
            if getattr(d, "computation_id", None):
                computation_ids.add(d.computation_id)

        # 需求计算
        for cid in computation_ids:
            comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=cid)
            if comp:
                affected_computations.append({
                    "id": comp.id,
                    "code": getattr(comp, "computation_code", None),
                    "name": None,
                    "status": getattr(comp, "computation_status", None),
                })

        # 生产计划（source_type 可能为 DemandComputation 或 demand_computation）
        for cid in computation_ids:
            plans = await ProductionPlan.filter(
                tenant_id=tenant_id,
                source_id=cid,
                deleted_at__isnull=True,
            ).all()
            for p in plans:
                if getattr(p, "source_type", "") in ("DemandComputation", "demand_computation", "Demand"):
                    affected_plans.append({
                        "id": p.id,
                        "code": getattr(p, "plan_code", None),
                        "name": getattr(p, "plan_name", None),
                        "status": getattr(p, "plan_status", None) or getattr(p, "status", None),
                    })

        # 工单（sales_order_id 或 source_id 为 computation_id）
        wos = await WorkOrder.filter(
            tenant_id=tenant_id,
            sales_order_id=order_id,
            deleted_at__isnull=True,
        ).all()
        for wo in wos:
            affected_work_orders.append({
                "id": wo.id,
                "code": getattr(wo, "code", None),
                "name": getattr(wo, "name", None),
                "status": getattr(wo, "status", None),
            })
        wo_ids = {wo.id for wo in wos}
        for cid in computation_ids:
            more_wos = await WorkOrder.filter(
                tenant_id=tenant_id,
                source_id=cid,
                deleted_at__isnull=True,
            ).all()
            for wo in more_wos:
                if wo.id not in wo_ids:
                    wo_ids.add(wo.id)
                    affected_work_orders.append({
                        "id": wo.id,
                        "code": getattr(wo, "code", None),
                        "name": getattr(wo, "name", None),
                        "status": getattr(wo, "status", None),
                    })

        recommended_actions = []
        if affected_computations:
            recommended_actions.append("重算需求计算")
        if affected_plans or affected_work_orders:
            recommended_actions.append("重新排程")

        return {
            "upstream_change": upstream_change,
            "affected_demands": affected_demands,
            "affected_computations": affected_computations,
            "affected_plans": affected_plans,
            "affected_work_orders": affected_work_orders,
            "recommended_actions": recommended_actions,
        }

    async def get_change_impact_demand(
        self,
        tenant_id: int,
        demand_id: int
    ) -> Dict[str, Any]:
        """
        获取需求变更对下游的影响范围（排程管理增强）

        .. deprecated:: 请使用 DocumentRelationNewService.get_change_impact_demand，
           与 trace 使用相同数据源（get_relations），保证变更影响与追溯链一致。
        """
        demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
        if not demand:
            raise NotFoundError(f"需求不存在: {demand_id}")

        upstream_change = {
            "type": "demand",
            "id": demand.id,
            "code": getattr(demand, "demand_code", None),
            "name": getattr(demand, "demand_name", None),
            "changed_at": demand.updated_at.isoformat() if demand.updated_at else None,
        }

        affected_demands = [{
            "id": demand.id,
            "code": getattr(demand, "demand_code", None),
            "name": getattr(demand, "demand_name", None),
            "status": getattr(demand, "status", None),
        }]
        affected_computations = []
        affected_plans = []
        affected_work_orders = []
        computation_ids = set()

        if getattr(demand, "computation_id", None):
            computation_ids.add(demand.computation_id)

        for cid in computation_ids:
            comp = await DemandComputation.get_or_none(tenant_id=tenant_id, id=cid)
            if comp:
                affected_computations.append({
                    "id": comp.id,
                    "code": getattr(comp, "computation_code", None),
                    "name": None,
                    "status": getattr(comp, "computation_status", None),
                })

        for cid in computation_ids:
            plans = await ProductionPlan.filter(
                tenant_id=tenant_id,
                source_id=cid,
                deleted_at__isnull=True,
            ).all()
            for p in plans:
                if getattr(p, "source_type", "") in ("DemandComputation", "demand_computation", "Demand"):
                    affected_plans.append({
                        "id": p.id,
                        "code": getattr(p, "plan_code", None),
                        "name": getattr(p, "plan_name", None),
                        "status": getattr(p, "plan_status", None) or getattr(p, "status", None),
                    })

        for cid in computation_ids:
            wos = await WorkOrder.filter(
                tenant_id=tenant_id,
                source_id=cid,
                deleted_at__isnull=True,
            ).all()
            for wo in wos:
                affected_work_orders.append({
                    "id": wo.id,
                    "code": getattr(wo, "code", None),
                    "name": getattr(wo, "name", None),
                    "status": getattr(wo, "status", None),
                })
        if getattr(demand, "source_type", None) == "sales_order" and getattr(demand, "source_id", None):
            so_wos = await WorkOrder.filter(
                tenant_id=tenant_id,
                sales_order_id=demand.source_id,
                deleted_at__isnull=True,
            ).all()
            wo_ids = {w["id"] for w in affected_work_orders}
            for wo in so_wos:
                if wo.id not in wo_ids:
                    affected_work_orders.append({
                        "id": wo.id,
                        "code": getattr(wo, "code", None),
                        "name": getattr(wo, "name", None),
                        "status": getattr(wo, "status", None),
                    })

        recommended_actions = []
        if affected_computations:
            recommended_actions.append("重算需求计算")
        if affected_plans or affected_work_orders:
            recommended_actions.append("重新排程")

        return {
            "upstream_change": upstream_change,
            "affected_demands": affected_demands,
            "affected_computations": affected_computations,
            "affected_plans": affected_plans,
            "affected_work_orders": affected_work_orders,
            "recommended_actions": recommended_actions,
        }

    async def apply_upstream_change_impact(
        self,
        tenant_id: int,
        upstream_type: str,
        upstream_id: int,
        auto_mark_pending_recompute: bool = True,
    ) -> int:
        """
        上游变更后应用计划锁定策略（排程管理增强）
        - 计划 locked/executing：不自动标记，仅通过 change-impact API 提示
        - 计划 draft/submitted：可配置为自动标记 needs_recompute
        返回被标记为待重算的计划数量。
        """
        if upstream_type == "sales_order":
            impact = await self.get_change_impact_sales_order(tenant_id, upstream_id)
        elif upstream_type == "demand":
            impact = await self.get_change_impact_demand(tenant_id, upstream_id)
        else:
            return 0

        marked = 0
        if not auto_mark_pending_recompute:
            return 0

        for p in impact.get("affected_plans", []):
            plan_id = p.get("id")
            if not plan_id:
                continue
            plan = await ProductionPlan.get_or_none(tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True)
            if not plan:
                continue
            status = getattr(plan, "plan_status", None) or ""
            if status in ("draft", "submitted"):
                await ProductionPlan.filter(tenant_id=tenant_id, id=plan_id).update(needs_recompute=True)
                marked += 1
            # locked/executing: 不自动标记

        return marked

    async def _get_quotation_downstream(
        self,
        tenant_id: int,
        quotation_id: int
    ) -> List[Dict[str, Any]]:
        """获取报价单的下游单据（转订单后的销售订单）"""
        downstream = []
        quotation = await Quotation.get_or_none(
            tenant_id=tenant_id, id=quotation_id, deleted_at__isnull=True
        )
        if quotation and quotation.sales_order_id:
            downstream.append({
                "document_type": "sales_order",
                "document_id": quotation.sales_order_id,
                "document_code": quotation.sales_order_code,
                "document_name": None,
                "status": None,
                "created_at": None,
            })
        return downstream

    async def _get_material_borrow_downstream(
        self,
        tenant_id: int,
        borrow_id: int
    ) -> List[Dict[str, Any]]:
        """获取借料单的下游单据（还料单）"""
        downstream = []
        returns = await MaterialReturn.filter(
            tenant_id=tenant_id, borrow_id=borrow_id, deleted_at__isnull=True
        ).limit(10)
        for r in returns:
            downstream.append({
                "document_type": "material_return",
                "document_id": r.id,
                "document_code": r.return_code,
                "document_name": None,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })
        return downstream

    async def _get_delivery_notice_upstream(
        self,
        tenant_id: int,
        notice_id: int
    ) -> List[Dict[str, Any]]:
        """获取送货单的上游单据（销售出库单、销售订单）"""
        upstream = []
        notice = await DeliveryNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice:
            return upstream
        if notice.sales_delivery_id:
            delivery = await SalesDelivery.get_or_none(
                tenant_id=tenant_id, id=notice.sales_delivery_id
            )
            if delivery:
                upstream.append({
                    "document_type": "sales_delivery",
                    "document_id": delivery.id,
                    "document_code": delivery.delivery_code,
                    "document_name": None,
                    "status": delivery.status,
                    "created_at": delivery.created_at.isoformat() if delivery.created_at else None,
                })
        if notice.sales_order_id:
            order = await SalesOrder.get_or_none(
                tenant_id=tenant_id, id=notice.sales_order_id
            )
            if order:
                upstream.append({
                    "document_type": "sales_order",
                    "document_id": order.id,
                    "document_code": order.order_code,
                    "document_name": order.order_name,
                    "status": order.status,
                    "created_at": order.created_at.isoformat() if order.created_at else None,
                })
        return upstream

    async def _get_material_return_upstream(
        self,
        tenant_id: int,
        return_id: int
    ) -> List[Dict[str, Any]]:
        """获取还料单的上游单据（借料单）"""
        upstream = []
        return_obj = await MaterialReturn.get_or_none(
            tenant_id=tenant_id, id=return_id, deleted_at__isnull=True
        )
        if return_obj and return_obj.borrow_id:
            borrow = await MaterialBorrow.get_or_none(
                tenant_id=tenant_id, id=return_obj.borrow_id, deleted_at__isnull=True
            )
            if borrow:
                upstream.append({
                    "document_type": "material_borrow",
                    "document_id": borrow.id,
                    "document_code": borrow.borrow_code,
                    "document_name": None,
                    "status": borrow.status,
                    "created_at": borrow.created_at.isoformat() if borrow.created_at else None,
                })
        return upstream

    async def _get_demand_computation_downstream(
        self,
        tenant_id: int,
        computation_id: int
    ) -> List[Dict[str, Any]]:
        """获取需求计算的下游单据（工单、采购单）"""
        downstream = []

        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            return downstream

        # 通过 DocumentRelation 查找工单（demand_computation 下推时创建）
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        wo_relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
            target_type="work_order",
        ).limit(10)
        for rel in wo_relations:
            wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=rel.target_id, deleted_at__isnull=True)
            if wo:
                downstream.append({
                    "document_type": "work_order",
                    "document_id": wo.id,
                    "document_code": wo.code,
                    "document_name": wo.name,
                    "status": wo.status,
                    "created_at": wo.created_at.isoformat() if wo.created_at else None
                })

        # 通过 source_id 查找采购单（PurchaseOrder.source_id 为 DemandComputation.id）
        purchase_orders = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            source_id=computation_id,
        ).limit(10)
        for po in purchase_orders:
            downstream.append({
                "document_type": "purchase_order",
                "document_id": po.id,
                "document_code": po.order_code,
                "document_name": po.order_name if hasattr(po, 'order_name') else None,
                "status": po.status,
                "created_at": po.created_at.isoformat() if po.created_at else None
            })

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

        # 生产退料单
        production_returns = await ProductionReturn.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        ).limit(10)
        for ret in production_returns:
            downstream.append({
                "document_type": "production_return",
                "document_id": ret.id,
                "document_code": ret.return_code,
                "document_name": None,
                "status": ret.status,
                "created_at": ret.created_at.isoformat() if ret.created_at else None
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

        # 返工单（工单作为原工单）
        rework_orders = await ReworkOrder.filter(
            tenant_id=tenant_id,
            original_work_order_id=work_order_id,
            deleted_at__isnull=True
        ).limit(10)
        for ro in rework_orders:
            downstream.append({
                "document_type": "rework_order",
                "document_id": ro.id,
                "document_code": ro.code,
                "document_name": ro.product_name,
                "status": ro.status,
                "created_at": ro.created_at.isoformat() if ro.created_at else None
            })

        # 工序委外单
        outsource_orders = await OutsourceOrder.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True
        ).limit(10)
        for os_order in outsource_orders:
            downstream.append({
                "document_type": "outsource_order",
                "document_id": os_order.id,
                "document_code": os_order.code,
                "document_name": os_order.operation_name,
                "status": os_order.status,
                "created_at": os_order.created_at.isoformat() if os_order.created_at else None
            })

        # 过程检验单
        process_inspections = await ProcessInspection.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        ).limit(10)
        for pi in process_inspections:
            downstream.append({
                "document_type": "process_inspection",
                "document_id": pi.id,
                "document_code": pi.inspection_code,
                "document_name": None,
                "status": pi.status,
                "created_at": pi.created_at.isoformat() if pi.created_at else None
            })

        # 成品检验单
        finished_inspections = await FinishedGoodsInspection.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        ).limit(10)
        for fi in finished_inspections:
            downstream.append({
                "document_type": "finished_goods_inspection",
                "document_id": fi.id,
                "document_code": fi.inspection_code,
                "document_name": None,
                "status": fi.status,
                "created_at": fi.created_at.isoformat() if fi.created_at else None
            })

        # 拆分工单（通过 DocumentRelation 追溯）
        split_relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="work_order",
            source_id=work_order_id,
            target_type="work_order",
        ).limit(10)
        for rel in split_relations:
            split_wo = await WorkOrder.get_or_none(
                tenant_id=tenant_id,
                id=rel.target_id,
                deleted_at__isnull=True
            )
            if split_wo:
                downstream.append({
                    "document_type": "work_order",
                    "document_id": split_wo.id,
                    "document_code": split_wo.code,
                    "document_name": split_wo.name,
                    "status": split_wo.status,
                    "created_at": split_wo.created_at.isoformat() if split_wo.created_at else None
                })

        return downstream

    async def _get_production_picking_downstream(
        self,
        tenant_id: int,
        picking_id: int
    ) -> List[Dict[str, Any]]:
        """获取生产领料的下游单据（报工记录、生产退料）"""
        picking = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=picking_id)
        if not picking:
            return []

        downstream = []

        # 生产退料单
        production_returns = await ProductionReturn.filter(
            tenant_id=tenant_id,
            picking_id=picking_id
        ).limit(10)
        for ret in production_returns:
            downstream.append({
                "document_type": "production_return",
                "document_id": ret.id,
                "document_code": ret.return_code,
                "document_name": None,
                "status": ret.status,
                "created_at": ret.created_at.isoformat() if ret.created_at else None
            })

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

    async def _get_purchase_receipt_downstream(
        self,
        tenant_id: int,
        receipt_id: int
    ) -> List[Dict[str, Any]]:
        """获取采购入库单的下游单据（应付单）"""
        downstream = []

        # 通过source_type和source_id查找应付单
        payables = await Payable.filter(
            tenant_id=tenant_id,
            source_type="采购入库",
            source_id=receipt_id
        ).limit(10)
        for payable in payables:
            downstream.append({
                "document_type": "payable",
                "document_id": payable.id,
                "document_code": payable.payable_code,
                "document_name": None,
                "status": payable.status,
                "created_at": payable.created_at.isoformat() if payable.created_at else None
            })

        # 采购退货单
        purchase_returns = await PurchaseReturn.filter(
            tenant_id=tenant_id,
            purchase_receipt_id=receipt_id,
            deleted_at__isnull=True
        ).limit(10)
        for pr in purchase_returns:
            downstream.append({
                "document_type": "purchase_return",
                "document_id": pr.id,
                "document_code": pr.return_code,
                "document_name": None,
                "status": pr.status if hasattr(pr, 'status') else None,
                "created_at": pr.created_at.isoformat() if pr.created_at else None
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

