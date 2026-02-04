"""
采购申请服务

提供采购申请相关的业务逻辑处理。

Author: RiverEdge Team
Date: 2025-02-01
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.transactions import in_transaction

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService
from loguru import logger

from apps.kuaizhizao.models import PurchaseRequisition, PurchaseRequisitionItem, PurchaseOrder, PurchaseOrderItem
from apps.master_data.models import Supplier
from apps.master_data.models.material import Material
from apps.kuaizhizao.schemas.purchase_requisition import (
    PurchaseRequisitionCreate, PurchaseRequisitionUpdate, PurchaseRequisitionResponse,
    PurchaseRequisitionListResponse, PurchaseRequisitionItemResponse,
    ConvertToPurchaseOrderRequest, UrgentPurchaseRequest,
)
from apps.kuaizhizao.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate
from apps.kuaizhizao.services.purchase_service import PurchaseService


class PurchaseRequisitionService(AppBaseService[PurchaseRequisition]):
    """采购申请服务"""

    def __init__(self):
        super().__init__(PurchaseRequisition)
        self.purchase_service = PurchaseService()
        self.business_config_service = BusinessConfigService()

    async def _generate_requisition_code(self, tenant_id: int) -> str:
        """生成采购申请编码"""
        try:
            return await self.generate_code(tenant_id, "PURCHASE_ORDER_CODE", prefix="PR")
        except Exception:
            import uuid
            return f"PR{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:6].upper()}"

    async def create_requisition(
        self,
        tenant_id: int,
        data: PurchaseRequisitionCreate,
        created_by: int,
    ) -> PurchaseRequisitionResponse:
        """创建采购申请"""
        # 0. 检查模块是否启用
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "purchase_request")
        if not is_enabled:
            raise BusinessLogicError("采购申请模块未启用，无法创建")

        async with in_transaction():
            if not data.requisition_code:
                data.requisition_code = await self._generate_requisition_code(tenant_id)

            req = await PurchaseRequisition.create(
                tenant_id=tenant_id,
                requisition_code=data.requisition_code,
                requisition_name=data.requisition_name or f"采购申请-{data.requisition_code}",
                status="草稿",
                requisition_date=date.today(),
                required_date=data.required_date,
                source_type=data.source_type,
                source_id=data.source_id,
                source_code=data.source_code,
                notes=data.notes,
                created_by=created_by,
                updated_by=created_by,
            )

            for item_data in data.items:
                await PurchaseRequisitionItem.create(
                    tenant_id=tenant_id,
                    requisition_id=req.id,
                    material_id=item_data.material_id,
                    material_code=item_data.material_code,
                    material_name=item_data.material_name,
                    material_spec=item_data.material_spec,
                    unit=item_data.unit or "件",
                    quantity=item_data.quantity,
                    suggested_unit_price=item_data.suggested_unit_price or Decimal(0),
                    required_date=item_data.required_date or data.required_date,
                    demand_computation_item_id=item_data.demand_computation_item_id,
                    supplier_id=item_data.supplier_id,
                    notes=item_data.notes,
                )

            return await self.get_requisition_by_id(tenant_id, req.id)

    async def get_requisition_by_id(
        self, tenant_id: int, requisition_id: int
    ) -> PurchaseRequisitionResponse:
        """获取采购申请详情"""
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")

        items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id, requisition_id=requisition_id
        ).all()

        req_dict = {k: getattr(req, k) for k in req._meta.fields_map if hasattr(req, k)}
        req_dict.pop("items", None)
        resp = PurchaseRequisitionResponse.model_construct(**req_dict)
        resp.items = [PurchaseRequisitionItemResponse.model_validate(i) for i in items]
        return resp

    async def list_requisitions(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        source_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """列表查询，返回 { data, total, success }"""
        query = PurchaseRequisition.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        )
        if status:
            query = query.filter(status=status)
        if source_type:
            query = query.filter(source_type=source_type)

        total = await query.count()
        reqs = await query.offset(skip).limit(limit).order_by("-created_at")

        result = []
        for req in reqs:
            items_count = await PurchaseRequisitionItem.filter(
                tenant_id=tenant_id, requisition_id=req.id
            ).count()
            req_dict = {k: getattr(req, k) for k in req._meta.fields_map if hasattr(req, k)}
            req_dict.pop("items", None)
            resp = PurchaseRequisitionListResponse.model_construct(**req_dict)
            resp.items_count = items_count
            result.append(resp.model_dump())
        return {"data": result, "total": total, "success": True}

    async def update_requisition(
        self,
        tenant_id: int,
        requisition_id: int,
        data: PurchaseRequisitionUpdate,
        updated_by: int,
    ) -> PurchaseRequisitionResponse:
        """更新采购申请（仅草稿可改）"""
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")
        if req.status != "草稿":
            raise BusinessLogicError("只有草稿状态的采购申请可修改")

        update_data = data.model_dump(exclude_unset=True, exclude={"items"})
        if update_data:
            await req.update_from_dict({**update_data, "updated_by": updated_by}).save()

        if data.items is not None:
            await PurchaseRequisitionItem.filter(
                tenant_id=tenant_id, requisition_id=requisition_id
            ).delete()
            for item_data in data.items:
                await PurchaseRequisitionItem.create(
                    tenant_id=tenant_id,
                    requisition_id=requisition_id,
                    material_id=item_data.material_id,
                    material_code=item_data.material_code,
                    material_name=item_data.material_name,
                    material_spec=item_data.material_spec,
                    unit=item_data.unit or "件",
                    quantity=item_data.quantity,
                    suggested_unit_price=item_data.suggested_unit_price or Decimal(0),
                    required_date=item_data.required_date,
                    demand_computation_item_id=item_data.demand_computation_item_id,
                    supplier_id=item_data.supplier_id,
                    notes=item_data.notes,
                )

        return await self.get_requisition_by_id(tenant_id, requisition_id)

    async def submit_requisition(
        self, tenant_id: int, requisition_id: int, submitted_by: int
    ) -> PurchaseRequisitionResponse:
        """提交采购申请（启动审批或直接通过）"""
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")
        if req.status != "草稿":
            raise BusinessLogicError("只有草稿状态可提交")

        # 检查是否需要审核
        audit_required = await self.business_config_service.check_audit_required(tenant_id, "purchase_request")
        
        if audit_required:
            req.status = "待审核"
            req.review_status = "待审核"
            # TODO: 接入真正的工作流引擎
        else:
            req.status = "已通过"
            req.review_status = "已通过"
            
        req.updated_by = submitted_by
        await req.save()

        return await self.get_requisition_by_id(tenant_id, requisition_id)

    async def convert_to_purchase_order(
        self,
        tenant_id: int,
        requisition_id: int,
        data: ConvertToPurchaseOrderRequest,
        created_by: int,
    ) -> Dict[str, Any]:
        """将采购申请行转为采购订单（按供应商分组）"""
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")
        if req.status not in ("已通过", "部分转单"):
            raise BusinessLogicError("只有已通过或部分转单状态的采购申请可转单")

        supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=data.supplier_id)
        if not supplier:
            raise NotFoundError(f"供应商不存在: {data.supplier_id}")

        items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id,
            requisition_id=requisition_id,
            id__in=data.item_ids,
            purchase_order_id__isnull=True,
        ).all()

        if not items:
            raise BusinessLogicError("没有可转单的申请行或所选行已转单")

        today = date.today()
        max_required = max((i.required_date or today for i in items), default=today)

        po_items = []
        for item in items:
            unit_price = item.suggested_unit_price or Decimal(0)
            qty = item.quantity
            total_price = qty * unit_price
            po_items.append(
                PurchaseOrderItemCreate(
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    ordered_quantity=qty,
                    unit=item.unit or "件",
                    unit_price=unit_price,
                    total_price=total_price,
                    received_quantity=Decimal(0),
                    outstanding_quantity=qty,
                    required_date=item.required_date or max_required,
                    source_type="PurchaseRequisition",
                    source_id=item.id,
                    notes=item.notes,
                )
            )

        po_data = PurchaseOrderCreate(
            supplier_id=data.supplier_id,
            supplier_name=data.supplier_name,
            order_date=today,
            delivery_date=max_required,
            order_type="标准采购",
            status="草稿",
            source_type="PurchaseRequisition",
            source_id=requisition_id,
            notes=f"由采购申请{req.requisition_code}转单生成",
            items=po_items,
        )

        po = await self.purchase_service.create_purchase_order(
            tenant_id=tenant_id, order_data=po_data, created_by=created_by
        )

        for i, item in enumerate(items):
            po_item = po.items[i] if i < len(po.items) else None
            po_item_id = getattr(po_item, "id", None) if po_item else None
            await item.update_from_dict(
                purchase_order_id=po.id,
                purchase_order_item_id=po_item_id,
                supplier_id=data.supplier_id,
            ).save()

        all_items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id, requisition_id=requisition_id
        ).all()
        all_converted = all(i.purchase_order_id for i in all_items)
        req.status = "全部转单" if all_converted else "部分转单"
        await req.save()

        return {
            "success": True,
            "message": "转单成功",
            "purchase_order_id": po.id,
            "purchase_order_code": po.order_code,
        }

    async def urgent_purchase(
        self,
        tenant_id: int,
        requisition_id: int,
        data: UrgentPurchaseRequest,
        operator_id: int,
    ) -> Dict[str, Any]:
        """紧急采购：跳过审批，直接生成采购单"""
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")
        if req.status not in ("草稿", "待审核"):
            raise BusinessLogicError("只有草稿或待审核状态可执行紧急采购")

        items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id, requisition_id=requisition_id
        ).all()

        if not items:
            raise BusinessLogicError("采购申请无明细")

        # 按 supplier_id 分组（无 supplier 的用默认 1）
        by_supplier: Dict[int, List] = {}
        for item in items:
            sid = item.supplier_id or 1
            if sid not in by_supplier:
                by_supplier[sid] = []
            by_supplier[sid].append(item)

        supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=1)
        supplier_name = supplier.name if supplier else "默认供应商"

        req.is_urgent = True
        req.urgent_reason = data.urgent_reason
        req.urgent_operator_id = operator_id
        req.urgent_operated_at = datetime.now()
        req.status = "已通过"
        await req.save()

        generated = []
        for sid, grp in by_supplier.items():
            sup = await Supplier.get_or_none(tenant_id=tenant_id, id=sid)
            sname = sup.name if sup else f"供应商{sid}"
            today = date.today()
            max_required = max((i.required_date or today for i in grp), default=today)

            po_items = []
            for item in grp:
                up = item.suggested_unit_price or Decimal(0)
                qty = item.quantity
                po_items.append(
                    PurchaseOrderItemCreate(
                        material_id=item.material_id,
                        material_code=item.material_code,
                        material_name=item.material_name,
                        material_spec=item.material_spec,
                        ordered_quantity=qty,
                        unit=item.unit or "件",
                        unit_price=up,
                        total_price=qty * up,
                        received_quantity=Decimal(0),
                        outstanding_quantity=qty,
                        required_date=item.required_date or max_required,
                        source_type="PurchaseRequisition",
                        source_id=item.id,
                        notes=item.notes,
                    )
                )

            po_data = PurchaseOrderCreate(
                supplier_id=sid,
                supplier_name=sname,
                order_date=today,
                delivery_date=max_required,
                order_type="标准采购",
                status="草稿",
                source_type="PurchaseRequisition",
                source_id=requisition_id,
                notes=f"紧急采购-{data.urgent_reason}",
                items=po_items,
            )

            po = await self.purchase_service.create_purchase_order(
                tenant_id=tenant_id, order_data=po_data, created_by=operator_id
            )

            for i, item in enumerate(grp):
                po_item = po.items[i] if i < len(po.items) else None
                po_item_id = getattr(po_item, "id", None) if po_item else None
                await item.update_from_dict(
                    purchase_order_id=po.id,
                    purchase_order_item_id=po_item_id,
                    supplier_id=sid,
                ).save()

            generated.append({"id": po.id, "code": po.order_code})

        req.status = "全部转单"
        await req.save()

        logger.info(
            f"紧急采购: requisition_id={requisition_id}, reason={data.urgent_reason}, operator={operator_id}"
        )

        return {
            "success": True,
            "message": "紧急采购完成，已生成采购订单",
            "purchase_orders": generated,
        }
