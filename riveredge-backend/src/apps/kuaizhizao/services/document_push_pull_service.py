"""
单据下推和上拉服务模块

提供单据下推和上拉功能，支持从上游单据生成下游单据，或从下游单据关联上游单据。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.constants import DemandStatus, ReviewStatus
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.purchase_service import PurchaseService
from apps.kuaizhizao.schemas.demand_computation import DemandComputationCreate
from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
from apps.kuaizhizao.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class DocumentPushPullService:
    """单据下推和上拉服务"""
    
    def __init__(self):
        self.relation_service = DocumentRelationNewService()
        self.computation_service = DemandComputationService()
        self.work_order_service = WorkOrderService()
        self.purchase_service = PurchaseService()
    
    async def push_document(
        self,
        tenant_id: int,
        source_type: str,
        source_id: int,
        target_type: str,
        push_params: Optional[Dict[str, Any]] = None,
        created_by: int = None
    ) -> Dict[str, Any]:
        """
        单据下推功能
        
        从上游单据下推到下游单据，自动创建下游单据并建立关联关系。
        
        支持的下推场景：
        - demand -> demand_computation: 从需求下推到需求计算
        - demand_computation -> work_order: 从需求计算下推到工单
        - demand_computation -> purchase_order: 从需求计算下推到采购单
        
        Args:
            tenant_id: 租户ID
            source_type: 源单据类型（如：demand、demand_computation）
            source_id: 源单据ID
            target_type: 目标单据类型（如：demand_computation、work_order、purchase_order）
            push_params: 下推参数（可选，用于传递额外的创建参数）
            created_by: 创建人ID
            
        Returns:
            Dict: 包含创建的下游单据信息和关联关系信息
            
        Raises:
            NotFoundError: 源单据不存在
            BusinessLogicError: 下推操作不符合业务规则
        """
        async with in_transaction():
            # 获取源单据信息
            source_doc = await self._get_source_document(tenant_id, source_type, source_id)
            if not source_doc:
                raise NotFoundError(f"源单据不存在: {source_type}#{source_id}")
            
            # 验证源单据状态（必须是已审核通过）
            if not self._validate_source_status(source_doc, source_type):
                raise BusinessLogicError(f"源单据状态不符合下推要求: {source_type}#{source_id}")
            
            # 根据不同的下推场景执行下推操作
            if source_type == "demand" and target_type == "demand_computation":
                return await self._push_demand_to_computation(
                    tenant_id, source_id, push_params, created_by
                )
            elif source_type == "demand_computation" and target_type == "work_order":
                return await self._push_computation_to_work_order(
                    tenant_id, source_id, push_params, created_by
                )
            elif source_type == "demand_computation" and target_type == "purchase_order":
                return await self._push_computation_to_purchase_order(
                    tenant_id, source_id, push_params, created_by
                )
            else:
                raise BusinessLogicError(f"不支持的下推场景: {source_type} -> {target_type}")
    
    async def pull_document(
        self,
        tenant_id: int,
        target_type: str,
        target_id: int,
        source_type: str,
        source_id: int,
        created_by: int = None
    ) -> Dict[str, Any]:
        """
        单据上拉功能
        
        从下游单据上拉到上游单据，建立关联关系。
        
        支持的上拉场景：
        - work_order -> demand_computation: 从工单上拉到需求计算
        - purchase_order -> demand_computation: 从采购单上拉到需求计算
        
        Args:
            tenant_id: 租户ID
            target_type: 目标单据类型（下游单据，如：work_order、purchase_order）
            target_id: 目标单据ID
            source_type: 源单据类型（上游单据，如：demand_computation）
            source_id: 源单据ID
            created_by: 创建人ID
            
        Returns:
            Dict: 包含关联关系信息
            
        Raises:
            NotFoundError: 源单据或目标单据不存在
            BusinessLogicError: 上拉操作不符合业务规则
        """
        async with in_transaction():
            # 验证源单据和目标单据存在
            source_doc = await self._get_source_document(tenant_id, source_type, source_id)
            target_doc = await self._get_source_document(tenant_id, target_type, target_id)
            
            if not source_doc:
                raise NotFoundError(f"源单据不存在: {source_type}#{source_id}")
            if not target_doc:
                raise NotFoundError(f"目标单据不存在: {target_type}#{target_id}")
            
            # 建立关联关系
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            
            relation_data = DocumentRelationCreate(
                source_type=source_type,
                source_id=source_id,
                source_code=self._get_document_code(source_doc, source_type),
                source_name=self._get_document_name(source_doc, source_type),
                target_type=target_type,
                target_id=target_id,
                target_code=self._get_document_code(target_doc, target_type),
                target_name=self._get_document_name(target_doc, target_type),
                relation_type="source",
                relation_mode="pull",
                relation_desc=f"从{target_type}上拉到{source_type}",
                business_mode=getattr(source_doc, "business_mode", None),
                demand_id=self._get_demand_id(source_doc, source_type),
            )
            
            relation = await self.relation_service.create_relation(
                tenant_id=tenant_id,
                relation_data=relation_data,
                created_by=created_by
            )
            
            return {
                "success": True,
                "message": "上拉成功",
                "relation": relation.model_dump() if hasattr(relation, "model_dump") else relation,
            }
    
    async def _push_demand_to_computation(
        self,
        tenant_id: int,
        demand_id: int,
        push_params: Optional[Dict[str, Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """从需求下推到需求计算"""
        # 获取需求信息
        demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id)
        if not demand:
            raise NotFoundError(f"需求不存在: {demand_id}")
        
        # 验证需求状态
        if demand.status != DemandStatus.AUDITED or demand.review_status != ReviewStatus.APPROVED:
            raise BusinessLogicError("只能下推已审核通过的需求")
        
        # 检查是否已经下推过
        if demand.pushed_to_computation:
            raise BusinessLogicError("需求已经下推到需求计算，不能重复下推")
        
        # 确定计算类型（根据业务模式）
        computation_type = "MRP" if demand.business_mode == "MTS" else "LRP"
        
        # 构建计算参数
        computation_params = push_params.get("computation_params", {}) if push_params else {}
        computation_params.setdefault("planning_horizon", 3)
        computation_params.setdefault("consider_capacity", False)
        
        # 创建需求计算
        computation_data = DemandComputationCreate(
            demand_id=demand_id,
            computation_type=computation_type,
            computation_params=computation_params,
            notes=push_params.get("notes") if push_params else None,
        )
        
        computation = await self.computation_service.create_computation(
            tenant_id=tenant_id,
            computation_data=computation_data,
            created_by=created_by
        )
        
        # 更新需求的下推状态
        demand.pushed_to_computation = True
        demand.computation_id = computation.id
        demand.computation_code = computation.computation_code
        await demand.save()
        
        # 建立关联关系
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        
        relation_data = DocumentRelationCreate(
            source_type="demand",
            source_id=demand_id,
            source_code=demand.demand_code,
            source_name=demand.demand_name,
            target_type="demand_computation",
            target_id=computation.id,
            target_code=computation.computation_code,
            target_name=None,
            relation_type="source",
            relation_mode="push",
            relation_desc="从需求下推到需求计算",
            business_mode=demand.business_mode,
            demand_id=demand_id,
        )
        
        relation = await self.relation_service.create_relation(
            tenant_id=tenant_id,
            relation_data=relation_data,
            created_by=created_by
        )
        
        return {
            "success": True,
            "message": "下推成功",
            "target_document": {
                "type": "demand_computation",
                "id": computation.id,
                "code": computation.computation_code,
            },
            "relation": relation.model_dump() if hasattr(relation, "model_dump") else relation,
        }
    
    async def _push_computation_to_work_order(
        self,
        tenant_id: int,
        computation_id: int,
        push_params: Optional[Dict[str, Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """从需求计算下推到工单"""
        # 获取需求计算信息
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        
        # 验证计算状态（必须是已完成）
        if computation.computation_status != "已完成":
            raise BusinessLogicError("只能下推已完成的需求计算")
        
        # 获取计算明细
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
        computation_items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id
        ).all()
        
        if not computation_items:
            raise BusinessLogicError("需求计算没有明细，无法下推")
        
        # 创建工单列表
        work_orders = []
        relations = []
        
        for item in computation_items:
            # 只处理需要生产的物料（planned_production > 0）
            if (item.planned_production or 0) <= 0:
                continue
            
            # 创建工单
            work_order_data = WorkOrderCreate(
                code_rule="WORK_ORDER_CODE",  # 使用编码规则生成工单编码
                product_id=item.material_id,
                product_code=item.material_code,
                product_name=item.material_name,
                quantity=item.suggested_work_order_quantity or item.planned_production,
                production_mode=computation.business_mode,
                planned_start_date=item.production_start_date,
                planned_end_date=item.production_completion_date,
                status="draft",
                priority="normal",
                remarks=f"由需求计算{computation.computation_code}下推生成",
            )
            
            work_order = await self.work_order_service.create_work_order(
                tenant_id=tenant_id,
                work_order_data=work_order_data,
                created_by=created_by
            )
            
            work_orders.append(work_order)
            
            # 建立关联关系
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            
            # 从响应对象中获取id和code
            wo_id = work_order.id if hasattr(work_order, 'id') else work_order.model_dump().get('id')
            wo_code = work_order.code if hasattr(work_order, 'code') else work_order.model_dump().get('code')
            wo_name = work_order.name if hasattr(work_order, 'name') else work_order.model_dump().get('name')
            
            relation_data = DocumentRelationCreate(
                source_type="demand_computation",
                source_id=computation_id,
                source_code=computation.computation_code,
                source_name=None,
                target_type="work_order",
                target_id=wo_id,
                target_code=wo_code,
                target_name=wo_name,
                relation_type="source",
                relation_mode="push",
                relation_desc="从需求计算下推到工单",
                business_mode=computation.business_mode,
                demand_id=computation.demand_id,
            )
            
            relation = await self.relation_service.create_relation(
                tenant_id=tenant_id,
                relation_data=relation_data,
                created_by=created_by
            )
            
            relations.append(relation)
        
        if not work_orders:
            raise BusinessLogicError("没有需要生产的物料，无法生成工单")
        
        return {
            "success": True,
            "message": f"下推成功，共生成{len(work_orders)}个工单",
            "target_documents": [
                {
                    "type": "work_order",
                    "id": wo.id if hasattr(wo, 'id') else wo.model_dump().get('id'),
                    "code": wo.code if hasattr(wo, 'code') else wo.model_dump().get('code'),
                }
                for wo in work_orders
            ],
            "relations": [
                r.model_dump() if hasattr(r, "model_dump") else r
                for r in relations
            ],
        }
    
    async def _push_computation_to_purchase_order(
        self,
        tenant_id: int,
        computation_id: int,
        push_params: Optional[Dict[str, Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """从需求计算下推到采购单"""
        # 获取需求计算信息
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        
        # 验证计算状态（必须是已完成）
        if computation.computation_status != "已完成":
            raise BusinessLogicError("只能下推已完成的需求计算")
        
        # 获取计算明细
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
        computation_items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id
        ).all()
        
        if not computation_items:
            raise BusinessLogicError("需求计算没有明细，无法下推")
        
        # 创建采购单列表
        purchase_orders = []
        relations = []
        
        # 检查是否提供了供应商信息（采购单必须要有供应商）
        supplier_id = push_params.get("supplier_id") if push_params else None
        supplier_name = push_params.get("supplier_name") if push_params else None
        
        if not supplier_id:
            raise BusinessLogicError("下推采购单必须提供供应商ID")
        
        # 按物料分组创建采购单（每个物料一个采购单，或者可以合并为单个采购单）
        # 这里采用每个物料一个采购单的方式，便于后续管理
        for item in computation_items:
            # 只处理需要采购的物料（planned_procurement > 0）
            if (item.planned_procurement or 0) <= 0:
                continue
            
            # 创建采购单明细
            ordered_quantity = item.suggested_purchase_order_quantity or item.planned_procurement or 0
            unit_price = push_params.get("unit_price", 0) if push_params else 0
            total_price = ordered_quantity * unit_price
            
            purchase_item = PurchaseOrderItemCreate(
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                material_spec=item.material_spec,
                ordered_quantity=ordered_quantity,
                unit=item.material_unit or "件",
                unit_price=unit_price,
                total_price=total_price,
                required_date=item.procurement_completion_date or datetime.now().date(),
                source_type="demand_computation",
                source_id=computation_id,
                notes=f"由需求计算{computation.computation_code}下推生成",
            )
            
            # 创建采购单
            purchase_order_data = PurchaseOrderCreate(
                supplier_id=supplier_id,
                supplier_name=supplier_name or "",
                order_date=datetime.now().date(),
                delivery_date=item.procurement_completion_date or datetime.now().date(),
                status="草稿",
                remarks=f"由需求计算{computation.computation_code}下推生成",
                items=[purchase_item],
            )
            
            purchase_order = await self.purchase_service.create_purchase_order(
                tenant_id=tenant_id,
                purchase_order_data=purchase_order_data,
                created_by=created_by
            )
            
            purchase_orders.append(purchase_order)
            
            # 建立关联关系
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            
            # 从响应对象中获取id和code
            po_id = purchase_order.id if hasattr(purchase_order, 'id') else purchase_order.model_dump().get('id')
            po_code = purchase_order.order_code if hasattr(purchase_order, 'order_code') else purchase_order.model_dump().get('order_code')
            po_name = purchase_order.order_name if hasattr(purchase_order, 'order_name') else purchase_order.model_dump().get('order_name')
            
            relation_data = DocumentRelationCreate(
                source_type="demand_computation",
                source_id=computation_id,
                source_code=computation.computation_code,
                source_name=None,
                target_type="purchase_order",
                target_id=po_id,
                target_code=po_code,
                target_name=po_name,
                relation_type="source",
                relation_mode="push",
                relation_desc="从需求计算下推到采购单",
                business_mode=computation.business_mode,
                demand_id=computation.demand_id,
            )
            
            relation = await self.relation_service.create_relation(
                tenant_id=tenant_id,
                relation_data=relation_data,
                created_by=created_by
            )
            
            relations.append(relation)
        
        if not purchase_orders:
            raise BusinessLogicError("没有需要采购的物料，无法生成采购单")
        
        return {
            "success": True,
            "message": f"下推成功，共生成{len(purchase_orders)}个采购单",
            "target_documents": [
                {
                    "type": "purchase_order",
                    "id": po.id if hasattr(po, 'id') else po.model_dump().get('id'),
                    "code": po.order_code if hasattr(po, 'order_code') else po.model_dump().get('order_code'),
                }
                for po in purchase_orders
            ],
            "relations": [
                r.model_dump() if hasattr(r, "model_dump") else r
                for r in relations
            ],
        }
    
    async def _get_source_document(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int
    ) -> Any:
        """获取源单据"""
        if document_type == "demand":
            return await Demand.get_or_none(tenant_id=tenant_id, id=document_id)
        elif document_type == "demand_computation":
            return await DemandComputation.get_or_none(tenant_id=tenant_id, id=document_id)
        elif document_type == "work_order":
            return await WorkOrder.get_or_none(tenant_id=tenant_id, id=document_id)
        elif document_type == "purchase_order":
            return await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=document_id)
        else:
            return None
    
    def _validate_source_status(self, source_doc: Any, source_type: str) -> bool:
        """验证源单据状态"""
        if source_type == "demand":
            return source_doc.status == DemandStatus.AUDITED and source_doc.review_status == ReviewStatus.APPROVED
        elif source_type == "demand_computation":
            return source_doc.computation_status == "已完成"
        else:
            return True
    
    def _get_document_code(self, doc: Any, doc_type: str) -> Optional[str]:
        """获取单据编码"""
        if doc_type == "demand":
            return doc.demand_code
        elif doc_type == "demand_computation":
            return doc.computation_code
        elif doc_type == "work_order":
            return doc.code
        elif doc_type == "purchase_order":
            return doc.order_code
        else:
            return None
    
    def _get_document_name(self, doc: Any, doc_type: str) -> Optional[str]:
        """获取单据名称"""
        if doc_type == "demand":
            return doc.demand_name
        elif doc_type == "demand_computation":
            return None
        elif doc_type == "work_order":
            return doc.name
        elif doc_type == "purchase_order":
            return doc.order_name
        else:
            return None
    
    def _get_demand_id(self, doc: Any, doc_type: str) -> Optional[int]:
        """获取需求ID"""
        if doc_type == "demand":
            return doc.id
        elif doc_type == "demand_computation":
            return doc.demand_id
        else:
            return None
