"""
需求来源追溯服务

提供工单、采购单、采购申请的需求来源链路追溯功能。

设计文档：多需求合并与追溯设计.md

Author: RiverEdge Team
Date: 2025-02-02
"""

from typing import List, Dict, Any, Optional
from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition, PurchaseRequisitionItem
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_item import DemandItem
from apps.master_data.models.sales_order import SalesOrder
from apps.master_data.models.sales_forecast import SalesForecast
from infra.exceptions.exceptions import NotFoundError


class DemandSourceChainService:
    """需求来源追溯服务"""

    async def get_work_order_demand_chain(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> Dict[str, Any]:
        """
        获取工单的需求来源链路
        
        追溯路径：WorkOrder → DemandComputationItem → DemandItem → Demand → SalesOrder/SalesForecast
        
        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID
            
        Returns:
            Dict: 需求来源链路
        """
        work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")
        
        chain = []
        
        # 1. 工单本身
        chain.append({
            "type": "WorkOrder",
            "id": work_order.id,
            "code": work_order.code,
            "name": work_order.name,
        })
        
        # 2. 查找关联的需求计算（通过 document_relation）
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        
        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            target_type="work_order",
            target_id=work_order_id,
            source_type="demand_computation"
        ).all()
        
        if relations:
            relation = relations[0]
            computation_id = relation.source_id
            
            # 获取需求计算
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if computation:
                chain.append({
                    "type": "DemandComputation",
                    "id": computation.id,
                    "code": computation.computation_code,
                })
                
                # 3. 获取需求（支持多需求）
                demand_ids = computation.demand_ids if computation.demand_ids else [computation.demand_id]
                
                for demand_id in demand_ids:
                    demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
                    if demand:
                        chain.append({
                            "type": "Demand",
                            "id": demand.id,
                            "code": demand.demand_code,
                            "name": demand.demand_name,
                            "source_type": demand.source_type,
                            "source_id": demand.source_id,
                        })
                        
                        # 4. 获取源单据（销售订单或销售预测）
                        if demand.source_type == "sales_order" and demand.source_id:
                            sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                            if sales_order:
                                chain.append({
                                    "type": "SalesOrder",
                                    "id": sales_order.id,
                                    "code": sales_order.order_code,
                                    "name": sales_order.order_name,
                                })
                        elif demand.source_type == "sales_forecast" and demand.source_id:
                            forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                            if forecast:
                                chain.append({
                                    "type": "SalesForecast",
                                    "id": forecast.id,
                                    "code": forecast.forecast_code,
                                    "name": forecast.forecast_name,
                                })
        
        return {"chain": chain}

    async def get_purchase_order_demand_chain(
        self,
        tenant_id: int,
        purchase_order_id: int
    ) -> Dict[str, Any]:
        """
        获取采购单的需求来源链路
        
        追溯路径：PurchaseOrder → DemandComputationItem → DemandItem → Demand → SalesOrder/SalesForecast
        
        Args:
            tenant_id: 租户ID
            purchase_order_id: 采购单ID
            
        Returns:
            Dict: 需求来源链路
        """
        purchase_order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=purchase_order_id)
        if not purchase_order:
            raise NotFoundError(f"采购单不存在: {purchase_order_id}")
        
        chain = []
        
        # 1. 采购单本身
        chain.append({
            "type": "PurchaseOrder",
            "id": purchase_order.id,
            "code": purchase_order.order_code,
            "name": purchase_order.order_name,
        })
        
        # 2. 查找关联的需求计算
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        
        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            target_type="purchase_order",
            target_id=purchase_order_id,
            source_type="demand_computation"
        ).all()
        
        if relations:
            relation = relations[0]
            computation_id = relation.source_id
            
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if computation:
                chain.append({
                    "type": "DemandComputation",
                    "id": computation.id,
                    "code": computation.computation_code,
                })
                
                # 3. 获取需求（支持多需求）
                demand_ids = computation.demand_ids if computation.demand_ids else [computation.demand_id]
                
                for demand_id in demand_ids:
                    demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
                    if demand:
                        chain.append({
                            "type": "Demand",
                            "id": demand.id,
                            "code": demand.demand_code,
                            "name": demand.demand_name,
                            "source_type": demand.source_type,
                            "source_id": demand.source_id,
                        })
                        
                        # 4. 获取源单据
                        if demand.source_type == "sales_order" and demand.source_id:
                            sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                            if sales_order:
                                chain.append({
                                    "type": "SalesOrder",
                                    "id": sales_order.id,
                                    "code": sales_order.order_code,
                                    "name": sales_order.order_name,
                                })
                        elif demand.source_type == "sales_forecast" and demand.source_id:
                            forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                            if forecast:
                                chain.append({
                                    "type": "SalesForecast",
                                    "id": forecast.id,
                                    "code": forecast.forecast_code,
                                    "name": forecast.forecast_name,
                                })
        
        return {"chain": chain}

    async def get_purchase_requisition_demand_chain(
        self,
        tenant_id: int,
        requisition_id: int
    ) -> Dict[str, Any]:
        """
        获取采购申请的需求来源链路
        
        追溯路径：PurchaseRequisition → DemandComputationItem → DemandItem → Demand → SalesOrder/SalesForecast
        
        Args:
            tenant_id: 租户ID
            requisition_id: 采购申请ID
            
        Returns:
            Dict: 需求来源链路
        """
        requisition = await PurchaseRequisition.get_or_none(tenant_id=tenant_id, id=requisition_id)
        if not requisition:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")
        
        chain = []
        
        # 1. 采购申请本身
        chain.append({
            "type": "PurchaseRequisition",
            "id": requisition.id,
            "code": requisition.requisition_code,
            "name": requisition.requisition_name,
        })
        
        # 2. 查找关联的需求计算
        from apps.kuaizhizao.models.document_relation import DocumentRelation
        
        relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            target_type="purchase_requisition",
            target_id=requisition_id,
            source_type="demand_computation"
        ).all()
        
        if relations:
            relation = relations[0]
            computation_id = relation.source_id
            
            computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
            if computation:
                chain.append({
                    "type": "DemandComputation",
                    "id": computation.id,
                    "code": computation.computation_code,
                })
                
                # 3. 获取需求（支持多需求）
                demand_ids = computation.demand_ids if computation.demand_ids else [computation.demand_id]
                
                for demand_id in demand_ids:
                    demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
                    if demand:
                        chain.append({
                            "type": "Demand",
                            "id": demand.id,
                            "code": demand.demand_code,
                            "name": demand.demand_name,
                            "source_type": demand.source_type,
                            "source_id": demand.source_id,
                        })
                        
                        # 4. 获取源单据
                        if demand.source_type == "sales_order" and demand.source_id:
                            sales_order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                            if sales_order:
                                chain.append({
                                    "type": "SalesOrder",
                                    "id": sales_order.id,
                                    "code": sales_order.order_code,
                                    "name": sales_order.order_name,
                                })
                        elif demand.source_type == "sales_forecast" and demand.source_id:
                            forecast = await SalesForecast.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                            if forecast:
                                chain.append({
                                    "type": "SalesForecast",
                                    "id": forecast.id,
                                    "code": forecast.forecast_code,
                                    "name": forecast.forecast_name,
                                })
        
        return {"chain": chain}
