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

        from apps.kuaizhizao.services.document_action_policy.demand import assert_demand_capability

        assert_demand_capability(demand, "merge_computation")

        if demand.pushed_to_computation:
            from apps.kuaizhizao.models.demand_computation import DemandComputation

            if await DemandComputation.filter(tenant_id=tenant_id, demand_id=demand_id).exists():
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
        """从需求计算下推到工单（委托 generate_work_orders_and_purchase_orders 统一口径）。"""
        push_mode = (push_params or {}).get("push_mode")
        resolved_push_mode = str(push_mode or "").strip().lower()
        if resolved_push_mode not in ("draft", "confirm"):
            resolved_push_mode = await BusinessConfigService().get_push_default_mode(tenant_id)

        r = await self.computation_service.generate_work_orders_and_purchase_orders(
            tenant_id=tenant_id,
            computation_id=computation_id,
            created_by=created_by,
            generate_mode="work_order_only",
            push_mode=resolved_push_mode,
            selected_item_ids=(push_params or {}).get("selected_item_ids"),
        )
        work_orders = r.get("work_orders") or []
        outsource_work_orders = r.get("outsource_work_orders") or []
        all_work_orders = work_orders + outsource_work_orders
        if not all_work_orders:
            raise BusinessLogicError("没有需要生产的物料，无法生成工单")

        return {
            "success": True,
            "message": f"下推成功，共生成{len(all_work_orders)}个工单",
            "target_documents": [
                {
                    "type": "work_order" if wo in work_orders else "outsource_work_order",
                    "id": wo.get("id") if isinstance(wo, dict) else wo.id,
                    "code": wo.get("code") if isinstance(wo, dict) else getattr(wo, "code", None),
                }
                for wo in all_work_orders
            ],
            "relations": [],
        }

    async def _push_computation_to_purchase_requisition(
        self,
        tenant_id: int,
        computation_id: int,
        push_params: Optional[Dict[str, Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """从一张需求计算下推到采购申请（仅采购件）。"""
        selected_ids = None
        if push_params and push_params.get("selected_item_ids") is not None:
            selected_ids = [
                int(v) for v in (push_params.get("selected_item_ids") or []) if v is not None
            ]
        return await self.create_purchase_requisition_from_computation_items(
            tenant_id=tenant_id,
            selected_item_ids=selected_ids,
            created_by=created_by,
            computation_id=computation_id,
        )

    async def create_purchase_requisition_from_computation_items(
        self,
        tenant_id: int,
        selected_item_ids: Optional[List[int]],
        created_by: int,
        computation_id: Optional[int] = None,
        item_required_dates: Optional[Dict[int, Any]] = None,
    ) -> Dict[str, Any]:
        """按计算明细 id 建一张采购申请，可跨多张已完成需求计算。"""
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
        from apps.kuaizhizao.services.purchase_requisition_service import PurchaseRequisitionService
        from apps.kuaizhizao.schemas.purchase_requisition import PurchaseRequisitionCreate, PurchaseRequisitionItemCreate
        from apps.kuaizhizao.utils.material_source_helper import (
            SOURCE_TYPE_BUY,
            resolve_computation_item_source_config,
        )
        from decimal import Decimal
        from apps.master_data.models.material import Material

        selected_ids: Optional[set] = None
        if selected_item_ids is not None:
            selected_ids = {int(v) for v in selected_item_ids if v is not None}
            if not selected_ids:
                raise BusinessLogicError("请至少选择一条可下推采购明细")

        date_override_by_item: Dict[int, Any] = {}
        if item_required_dates:
            for raw_id, raw_date in item_required_dates.items():
                if raw_id is None or raw_date is None:
                    continue
                date_override_by_item[int(raw_id)] = raw_date

        if computation_id is not None:
            computation_ids = [int(computation_id)]
        elif selected_ids:
            selected_rows = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                id__in=list(selected_ids),
            ).only("id", "computation_id")
            computation_ids = sorted({int(row.computation_id) for row in selected_rows})
        else:
            raise BusinessLogicError("请至少选择一条可下推采购明细")

        if not computation_ids:
            raise BusinessLogicError("所选明细均不可下推，请重新选择")

        computations = await DemandComputation.filter(
            tenant_id=tenant_id,
            id__in=computation_ids,
        ).all()
        computation_by_id = {int(c.id): c for c in computations}
        if len(computation_by_id) != len(computation_ids):
            raise NotFoundError("需求计算不存在")
        for computation in computations:
            if computation.computation_status != "完成":
                raise BusinessLogicError("只能下推已完成的需求计算")

        all_buy_items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id__in=computation_ids,
            material_source_type=SOURCE_TYPE_BUY,
        ).all()
        buy_items = [
            i
            for i in all_buy_items
            if i.suggested_purchase_order_quantity and i.suggested_purchase_order_quantity > 0
        ]
        if not buy_items:
            raise BusinessLogicError("需求计算中无采购件，无法下推采购申请")

        material_ids = sorted({int(i.material_id) for i in buy_items if i.material_id is not None})
        material_rows = (
            await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
            if material_ids
            else []
        )
        material_by_id = {m.id: m for m in material_rows}

        date_override_by_material: Dict[int, Any] = {}
        if selected_ids and date_override_by_item:
            for item in buy_items:
                if item.id not in selected_ids or item.material_id is None:
                    continue
                mid = int(item.material_id)
                override = date_override_by_item.get(int(item.id))
                if override is not None and mid not in date_override_by_material:
                    date_override_by_material[mid] = override

        req_items = []
        required_dates = []
        used_computation_ids: set = set()
        items_by_computation: Dict[int, List] = {}
        for item in buy_items:
            items_by_computation.setdefault(int(item.computation_id), []).append(item)

        for cid, comp_items in items_by_computation.items():
            exclusions = await self.computation_service._get_already_pushed_exclusions(tenant_id, cid)
            remaining_by_material = self.computation_service._get_purchase_remaining_qty_by_material(
                comp_items, exclusions
            )
            selected_material_ids: Optional[set] = None
            if selected_ids is not None:
                selected_material_ids = {
                    int(i.material_id)
                    for i in comp_items
                    if i.id in selected_ids and i.material_id is not None
                }
                if not selected_material_ids:
                    continue
                remaining_by_material = {
                    mid: qty
                    for mid, qty in remaining_by_material.items()
                    if mid in selected_material_ids and qty > 0
                }
            seen_material_ids: set = set()
            for item in comp_items:
                if item.material_id is None or item.material_id in seen_material_ids:
                    continue
                mid = int(item.material_id)
                if selected_material_ids is not None and mid not in selected_material_ids:
                    continue
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

                line_required_date = (
                    date_override_by_material.get(mid)
                    or date_override_by_item.get(int(item.id))
                    or item.procurement_completion_date
                )
                if line_required_date is None:
                    raise BusinessLogicError(
                        f"物料 {material_code or mid} 缺少要求到货日期，请确认后再创建"
                    )

                req_items.append(PurchaseRequisitionItemCreate(
                    material_id=item.material_id,
                    material_code=material_code or f"M{item.material_id}",
                    material_name=material_name or material_code or f"物料{item.material_id}",
                    material_spec=material_spec or None,
                    unit=material_unit or "件",
                    quantity=Decimal(str(remaining)),
                    suggested_unit_price=Decimal("0"),
                    required_date=line_required_date,
                    demand_computation_item_id=item.id,
                    supplier_id=supplier_id,
                ))
                required_dates.append(line_required_date)
                used_computation_ids.add(cid)

        if not req_items:
            raise BusinessLogicError("所选明细均不可下推，请重新选择")

        primary = computation_by_id[next(iter(used_computation_ids))]
        req_data = PurchaseRequisitionCreate(
            required_date=min(required_dates) if required_dates else None,
            source_type="DemandComputation",
            source_id=primary.id,
            source_code=primary.computation_code,
            items=req_items,
        )

        pr_service = PurchaseRequisitionService()
        req = await pr_service.create_requisition(
            tenant_id=tenant_id,
            data=req_data,
            created_by=created_by,
        )

        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
        last_relation = None
        for cid in sorted(used_computation_ids):
            computation = computation_by_id[cid]
            relation_data = DocumentRelationCreate(
                source_type="demand_computation",
                source_id=cid,
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
            last_relation = await self.relation_service.create_relation(
                tenant_id=tenant_id,
                relation_data=relation_data,
                created_by=created_by
            )

        return {
            "success": True,
            "message": "下推成功，已生成采购申请",
            "target_document": {"type": "purchase_requisition", "id": req.id, "code": req.requisition_code},
            "relation": last_relation.model_dump() if last_relation and hasattr(last_relation, "model_dump") else last_relation,
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
        """从需求计算下推到采购单（委托 generate_work_orders_and_purchase_orders 统一口径）。"""
        push_mode = (push_params or {}).get("push_mode") if push_params else None
        resolved_push_mode = str(push_mode or "").strip().lower()
        if resolved_push_mode not in ("draft", "confirm"):
            resolved_push_mode = await BusinessConfigService().get_push_default_mode(tenant_id)

        r = await self.computation_service.generate_work_orders_and_purchase_orders(
            tenant_id=tenant_id,
            computation_id=computation_id,
            created_by=created_by,
            generate_mode="purchase_only",
            push_mode=resolved_push_mode,
        )
        purchase_orders = r.get("purchase_orders") or []
        if not purchase_orders:
            raise BusinessLogicError("没有需要采购的物料，无法生成采购单")

        return {
            "success": True,
            "message": f"下推成功，共生成{len(purchase_orders)}个采购单",
            "target_documents": [
                {
                    "type": "purchase_order",
                    "id": po.get("id") if isinstance(po, dict) else po.id,
                    "code": po.get("order_code") if isinstance(po, dict) else getattr(po, "order_code", None),
                }
                for po in purchase_orders
            ],
            "relations": [],
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
            return getattr(doc, "order_code", None)
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
