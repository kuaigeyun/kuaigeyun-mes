"""
单据下推和加载服务模块

提供单据下推和加载功能，支持从上游单据生成下游单据，或从下游单据关联上游单据。

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
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.purchase_service import PurchaseService
from apps.kuaizhizao.schemas.demand_computation import DemandComputationCreate
from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
from apps.kuaizhizao.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate
from infra.services.business_config_service import BusinessConfigService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from core.utils.timezone_utils import resolve_business_datetime, to_site_date


class DocumentPushPullService:
    """单据下推和加载服务"""
    
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
        - purchase_receipt -> incoming_inspection: 从采购入库单下推来料检验
        
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
        # 获取源单据信息
        source_doc = await self._get_source_document(tenant_id, source_type, source_id)
        if not source_doc:
            raise NotFoundError(f"源单据不存在: {source_type}#{source_id}")

        # 验证源单据状态（必须是已审核通过）
        if not self._validate_source_status(source_doc, source_type):
            raise BusinessLogicError(f"源单据状态不符合下推要求: {source_type}#{source_id}")

        # 生产计划已下线，仅支持需求计算 -> 工单/采购
        if target_type == "production_plan":
            raise BusinessLogicError("生产计划已下线，请使用工单下推")

        # 采购申请/工单/采购单创建路径内部各自有事务；外层再套 in_transaction
        # 会与 create_* 内层事务 + 读回详情嵌套，易导致连接池等待（前端一直转圈）。
        if source_type == "demand_computation" and target_type == "purchase_requisition":
            return await self._push_computation_to_purchase_requisition(
                tenant_id, source_id, push_params, created_by
            )
        if source_type == "demand_computation" and target_type == "work_order":
            return await self._push_computation_to_work_order(
                tenant_id, source_id, push_params, created_by
            )
        if source_type == "demand_computation" and target_type == "purchase_order":
            return await self._push_computation_to_purchase_order(
                tenant_id, source_id, push_params, created_by
            )
        if source_type == "purchase_receipt" and target_type == "incoming_inspection":
            return await self._push_purchase_receipt_to_incoming_inspection(
                tenant_id, source_id, push_params, created_by
            )

        async with in_transaction():
            # 根据不同的下推场景执行下推操作
            if source_type == "demand" and target_type == "demand_computation":
                return await self._push_demand_to_computation(
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
        单据加载功能
        
        从下游单据加载到上游单据，建立关联关系。
        
        支持的加载场景：
        - work_order -> demand_computation: 从工单加载到需求计算
        - purchase_order -> demand_computation: 从采购单加载到需求计算
        
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
            BusinessLogicError: 加载操作不符合业务规则
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
                relation_desc=f"从{target_type}加载到{source_type}",
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
                "message": "加载成功",
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
        
        computation_type = "MRP"

        # 构建计算参数
        computation_params = push_params.get("computation_params", {}) if push_params else {}
        computation_params.setdefault("planning_horizon", 3)  # 天：仅纳入交期在此展望期内的需求行
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
        if computation.computation_status != "完成":
            raise BusinessLogicError("只能下推已完成的需求计算")
        
        # 获取已下推且仍存在的工单物料，避免重复下推
        exclusions = await self.computation_service._get_already_pushed_exclusions(tenant_id, computation_id)
        already_pushed_wo_material_ids = exclusions["wo_material_ids"]
        
        # 获取计算明细
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
        computation_items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id
        ).all()
        
        if not computation_items:
            raise BusinessLogicError("需求计算没有明细，无法下推")
        
        # 按物料聚合（同一物料多行合并，避免重复生成工单），排除已下推的物料
        prod_items = [
            i for i in computation_items
            if (i.planned_production or i.suggested_work_order_quantity or 0) > 0
            and i.material_id not in already_pushed_wo_material_ids
        ]
        agg_by_material: Dict[int, List] = {}
        for i in prod_items:
            mid = i.material_id
            if mid not in agg_by_material:
                agg_by_material[mid] = []
            agg_by_material[mid].append(i)
        
        work_orders = []
        relations = []
        
        # MTO 模式：从 Demand 追溯销售订单，写入工单以便列表可追溯到源订单
        push_mode = (push_params or {}).get("push_mode")
        resolved_push_mode = str(push_mode or "").strip().lower()
        if resolved_push_mode not in ("draft", "confirm"):
            resolved_push_mode = await BusinessConfigService().get_push_default_mode(tenant_id)
        push_as_confirm = resolved_push_mode == "confirm"

        sales_order_id: Optional[int] = None
        sales_order_code: Optional[str] = None
        sales_order_name: Optional[str] = None
        if computation.business_mode in ("MTO", "ATO"):
            demand_ids_to_check = [computation.demand_id] if computation.demand_id else (computation.demand_ids or [])
            for did in demand_ids_to_check:
                demand = await Demand.get_or_none(tenant_id=tenant_id, id=did)
                if demand and demand.source_type == "sales_order" and demand.source_id:
                    so = await SalesOrder.get_or_none(tenant_id=tenant_id, id=demand.source_id)
                    if so:
                        sales_order_id = so.id
                        sales_order_code = so.order_code
                        sales_order_name = getattr(so, "order_name", None) or so.order_code
                        break
        
        for material_id, group in agg_by_material.items():
            first = group[0]
            total_qty = sum(float(i.suggested_work_order_quantity or i.planned_production or 0) for i in group)
            start_dates = [i.production_start_date for i in group if i.production_start_date]
            end_dates = [i.production_completion_date for i in group if i.production_completion_date]
            
            # 创建工单（MTO 时写入销售订单信息，便于工单列表追溯到源订单）
            work_order_data = WorkOrderCreate(
                code_rule="WORK_ORDER_CODE",  # 使用编码规则生成工单编码
                product_id=first.material_id,
                product_code=first.material_code,
                product_name=first.material_name,
                quantity=total_qty,
                production_mode=computation.business_mode,
                sales_order_id=sales_order_id,
                sales_order_code=sales_order_code,
                sales_order_name=sales_order_name,
                planned_start_date=min(start_dates) if start_dates else None,
                planned_end_date=max(end_dates) if end_dates else None,
                status="draft",
                priority="normal",
                remarks=f"由需求计算{computation.computation_code}下推生成",
            )
            
            work_order = await self.work_order_service.create_work_order(
                tenant_id=tenant_id,
                work_order_data=work_order_data,
                created_by=created_by
            )
            if push_as_confirm and created_by is not None:
                work_order = await self.work_order_service.release_work_order(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    released_by=created_by,
                    check_shortage=False,
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
                {"type": "work_order", "id": wo.id if hasattr(wo, 'id') else wo.get('id'), "code": wo.code if hasattr(wo, 'code') else wo.get('code')}
                for wo in work_orders
            ],
            "relations": [r.model_dump() if hasattr(r, "model_dump") else r for r in relations],
        }

    async def _push_computation_to_purchase_requisition(
        self,
        tenant_id: int,
        computation_id: int,
        push_params: Optional[Dict[str, Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """从需求计算下推到采购申请（仅采购件）"""
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
        from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition, PurchaseRequisitionItem
        from apps.kuaizhizao.services.purchase_requisition_service import PurchaseRequisitionService
        from apps.kuaizhizao.schemas.purchase_requisition import PurchaseRequisitionCreate, PurchaseRequisitionItemCreate
        from apps.kuaizhizao.utils.material_source_helper import (
            SOURCE_TYPE_BUY,
            resolve_computation_item_source_config,
        )
        from decimal import Decimal
        from apps.master_data.models.material import Material

        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        if computation.computation_status != "完成":
            raise BusinessLogicError("只能下推已完成的需求计算")
        
        # 若已下推采购申请且仍存在，则不再重复下推
        exclusions = await self.computation_service._get_already_pushed_exclusions(tenant_id, computation_id)
        if exclusions["has_purchase_requisition"]:
            raise BusinessLogicError("该需求计算已下推采购申请且仍存在，请勿重复下推")

        items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id,
            material_source_type=SOURCE_TYPE_BUY,
        ).all()

        buy_items = [i for i in items if i.suggested_purchase_order_quantity and i.suggested_purchase_order_quantity > 0]
        if not buy_items:
            raise BusinessLogicError("需求计算中无采购件，无法下推采购申请")

        remaining_by_material = self.computation_service._get_purchase_remaining_qty_by_material(
            items, exclusions
        )
        if not any(qty > 0 for qty in remaining_by_material.values()):
            raise BusinessLogicError("需求计算中无剩余可下推采购件，无法下推采购申请")

        material_ids = sorted({int(i.material_id) for i in buy_items if i.material_id is not None})
        material_rows = (
            await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
            if material_ids
            else []
        )
        material_by_id = {m.id: m for m in material_rows}

        req_items = []
        seen_material_ids: set = set()
        for item in buy_items:
            if item.material_id is None or item.material_id in seen_material_ids:
                continue
            mid = int(item.material_id)
            remaining = remaining_by_material.get(mid, 0.0)
            if remaining <= 0:
                continue
            seen_material_ids.add(item.material_id)
            supplier_id = None
            if item.material_source_config:
                sc = resolve_computation_item_source_config(item.material_source_config)
                supplier_id = sc.get("default_supplier_id")

            material = material_by_id.get(mid)
            material_code = str(item.material_code or "").strip()
            material_name = str(item.material_name or "").strip()
            material_spec = str(item.material_spec or "").strip()
            material_unit = str(item.material_unit or "").strip()
            if material:
                if not material_code:
                    material_code = str(
                        getattr(material, "main_code", None)
                        or getattr(material, "code", None)
                        or ""
                    ).strip()
                if not material_name:
                    material_name = str(getattr(material, "name", "") or "").strip()
                if not material_spec:
                    material_spec = str(getattr(material, "specification", "") or "").strip()
                if not material_unit:
                    material_unit = str(getattr(material, "base_unit", "") or "").strip()

            req_items.append(PurchaseRequisitionItemCreate(
                material_id=item.material_id,
                material_code=material_code or f"M{item.material_id}",
                material_name=material_name or material_code or f"物料{item.material_id}",
                material_spec=material_spec or None,
                unit=material_unit or "件",
                quantity=Decimal(str(remaining)),
                suggested_unit_price=Decimal("0"),
                required_date=item.procurement_completion_date,
                demand_computation_item_id=item.id,
                supplier_id=supplier_id,
            ))

        if not req_items:
            raise BusinessLogicError("需求计算中无剩余可下推采购件，无法下推采购申请")

        dates = [i.procurement_completion_date for i in buy_items if i.procurement_completion_date]
        req_data = PurchaseRequisitionCreate(
            required_date=min(dates) if dates else None,
            source_type="DemandComputation",
            source_id=computation_id,
            source_code=computation.computation_code,
            items=req_items,
        )

        pr_service = PurchaseRequisitionService()
        req = await pr_service.create_requisition(
            tenant_id=tenant_id,
            data=req_data,
            created_by=created_by,
        )

        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        relation_data = DocumentRelationCreate(
            source_type="demand_computation",
            source_id=computation_id,
            source_code=computation.computation_code,
            source_name=None,
            target_type="purchase_requisition",
            target_id=req.id,
            target_code=req.requisition_code,
            target_name=req.requisition_name,
            relation_type="source",
            relation_mode="push",
            relation_desc="从需求计算下推到采购申请",
            business_mode=computation.business_mode,
            demand_id=computation.demand_id,
        )
        relation = await self.relation_service.create_relation(
            tenant_id=tenant_id,
            relation_data=relation_data,
            created_by=created_by
        )

        return {
            "success": True,
            "message": "下推成功，已生成采购申请",
            "target_document": {"type": "purchase_requisition", "id": req.id, "code": req.requisition_code},
            "relation": relation.model_dump() if hasattr(relation, "model_dump") else relation,
        }

    async def _push_purchase_receipt_to_incoming_inspection(
        self,
        tenant_id: int,
        purchase_receipt_id: int,
        push_params: Optional[Dict[str, Any]],
        created_by: int,
    ) -> Dict[str, Any]:
        """从采购入库单下推来料检验单"""
        from apps.kuaizhizao.services.quality_service import IncomingInspectionService

        inspections = await IncomingInspectionService().create_inspection_from_purchase_receipt(
            tenant_id=tenant_id,
            purchase_receipt_id=purchase_receipt_id,
            created_by=created_by,
        )
        if len(inspections) == 1:
            insp = inspections[0]
            return {
                "success": True,
                "message": "下推成功，已生成来料检验单",
                "target_document": {
                    "type": "incoming_inspection",
                    "id": insp.id,
                    "code": insp.inspection_code,
                },
            }
        return {
            "success": True,
            "message": f"下推成功，共生成 {len(inspections)} 张来料检验单",
            "target_documents": [
                {
                    "type": "incoming_inspection",
                    "id": insp.id,
                    "code": insp.inspection_code,
                }
                for insp in inspections
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
        if computation.computation_status != "完成":
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
        
        # 获取已下推且仍存在的采购单物料，避免重复下推
        exclusions = await self.computation_service._get_already_pushed_exclusions(tenant_id, computation_id)
        already_pushed_po_material_ids = exclusions["po_material_ids"]
        
        # 按物料分组创建采购单（每个物料一个采购单，或者可以合并为单个采购单）
        # 这里采用每个物料一个采购单的方式，便于后续管理
        for item in computation_items:
            # 只处理需要采购的物料（planned_procurement > 0），排除已下推的物料
            if (item.planned_procurement or 0) <= 0:
                continue
            if item.material_id in already_pushed_po_material_ids:
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
                required_date=item.procurement_completion_date or to_site_date(resolve_business_datetime()),
                source_type="demand_computation",
                source_id=computation_id,
                notes=f"由需求计算{computation.computation_code}下推生成",
            )
            
            # 创建采购单
            purchase_order_data = PurchaseOrderCreate(
                supplier_id=supplier_id,
                supplier_name=supplier_name or "",
                order_date=to_site_date(resolve_business_datetime()),
                delivery_date=item.procurement_completion_date or to_site_date(resolve_business_datetime()),
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
        elif document_type == "purchase_receipt":
            from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
            return await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=document_id)
        else:
            return None
    
    def _validate_source_status(self, source_doc: Any, source_type: str) -> bool:
        """验证源单据状态"""
        if source_type == "demand":
            return source_doc.status == DemandStatus.AUDITED and source_doc.review_status == ReviewStatus.APPROVED
        elif source_type == "demand_computation":
            return source_doc.computation_status == "完成"
        elif source_type == "purchase_receipt":
            return getattr(source_doc, "status", None) in ("待入库", "已入库")
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
        elif doc_type == "purchase_receipt":
            return getattr(doc, "receipt_code", None)
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
