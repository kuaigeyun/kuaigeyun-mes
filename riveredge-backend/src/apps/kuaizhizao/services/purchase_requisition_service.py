"""
采购申请服务

提供采购申请相关的业务逻辑处理。

Author: RiverEdge Team
Date: 2025-02-01
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any, Tuple

from tortoise.expressions import Q
from decimal import Decimal

from tortoise.transactions import in_transaction
from apps.kuaizhizao.constants import (
    DocumentStatus, ReviewStatus, normalize_status, 
    is_draft_status, is_pending_review_status, LEGACY_AUDITED_VALUES
)

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService
from loguru import logger

from apps.kuaizhizao.models import PurchaseRequisition, PurchaseRequisitionItem, PurchaseOrder, PurchaseOrderItem
from apps.master_data.models import Supplier
from apps.master_data.models.material import Material
from apps.kuaizhizao.schemas.purchase_requisition import (
    PurchaseRequisitionCreate, PurchaseRequisitionUpdate, PurchaseRequisitionResponse,
    PurchaseRequisitionListResponse, PurchaseRequisitionItemResponse,
    ConvertToPurchaseOrderRequest,
)
from apps.kuaizhizao.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate
from apps.kuaizhizao.services.purchase_service import PurchaseService
from apps.kuaizhizao.utils.material_source_helper import SOURCE_TYPE_BUY


class PurchaseRequisitionService(AppBaseService[PurchaseRequisition]):
    """采购申请服务"""

    def __init__(self):
        super().__init__(PurchaseRequisition)
        self.purchase_service = PurchaseService()
        self.business_config_service = BusinessConfigService()

    async def _generate_requisition_code(self, tenant_id: int) -> str:
        """生成采购申请编码"""
        try:
            return await self.generate_code(tenant_id, "PURCHASE_REQUISITION_CODE", prefix="CGSQ")
        except Exception:
            import uuid
            return f"CGSQ{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:6].upper()}"

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
                try:
                    data.requisition_code = await self._generate_requisition_code(tenant_id)
                except Exception as e:
                    from infra.exceptions.exceptions import ValidationError
                    if isinstance(e, ValidationError) and ("不存在" in str(e) or "未启用" in str(e)):
                        from core.services.default.default_values_service import DefaultValuesService
                        created = await DefaultValuesService.ensure_code_rule_for_page(
                            tenant_id, "kuaizhizao-purchase-requisition"
                        )
                        if created:
                            try:
                                data.requisition_code = await self._generate_requisition_code(tenant_id)
                            except Exception as e2:
                                logger.warning("采购申请编码规则补建后生成仍失败: %s", e2)
                        else:
                            logger.warning("采购申请编码规则生成失败: %s", e)
                    else:
                        logger.warning("采购申请编码规则生成失败: %s", e)
                if not data.requisition_code:
                    import uuid
                    data.requisition_code = f"CGSQ{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:6].upper()}"

            req_date = data.requisition_date or date.today()
            applicant_name = await self.get_user_name(created_by)
            req = await PurchaseRequisition.create(
                tenant_id=tenant_id,
                requisition_code=data.requisition_code,
                requisition_name=data.requisition_name or f"采购申请-{data.requisition_code}",
                status="草稿",
                requisition_date=req_date,
                applicant_id=created_by,
                applicant_name=applicant_name,
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



        async def _build_item_resps(items_list, clear_orphan: bool = False):
            resps = []
            cleared = False
            for i in items_list:
                d = {k: getattr(i, k) for k in i._meta.fields_map if hasattr(i, k)}
                d["converted_quantity_draft"] = Decimal(0)
                d["converted_quantity_confirmed"] = Decimal(0)
                if i.purchase_order_id and i.purchase_order_item_id:
                    po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=i.purchase_order_id)
                    po_item = (
                        await PurchaseOrderItem.get_or_none(
                            tenant_id=tenant_id, id=i.purchase_order_item_id
                        )
                        if po
                        else None
                    )
                    if po and po_item:
                        qty = po_item.ordered_quantity or Decimal(0)
                        if is_draft_status(po.status):
                            d["converted_quantity_draft"] = qty
                        elif po.status in LEGACY_AUDITED_VALUES:
                            d["converted_quantity_confirmed"] = qty
                    elif clear_orphan:
                        await i.update_from_dict({
                            "purchase_order_id": None,
                            "purchase_order_item_id": None,
                            "supplier_id": None,
                        }).save()
                        d["purchase_order_id"] = None
                        d["purchase_order_item_id"] = None
                        d["supplier_id"] = None
                        cleared = True
                resps.append(PurchaseRequisitionItemResponse.model_validate(d))
            return resps, cleared

        # 第一遍：用现有 purchase_order_id 链接做正常计算 + 清理孤儿
        item_resps, cleared_orphan = await _build_item_resps(items, clear_orphan=True)
        if cleared_orphan:
            await self.merge_split_requisition_items(tenant_id, requisition_id)
            items = await PurchaseRequisitionItem.filter(
                tenant_id=tenant_id, requisition_id=requisition_id
            ).all()

        # 重新加载明细（可能因清孤儿/合并已变化）
        all_items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id, requisition_id=requisition_id
        ).all()
        req_item_ids = [i.id for i in all_items]

        # 自愈链接：以 PurchaseOrderItem.source_type/source_id 作为权威来源反查
        # 避免历史数据/异常路径导致 requisition_item.purchase_order_id 被清空但下游 PO 仍存在
        po_items_back = (
            await PurchaseOrderItem.filter(
                tenant_id=tenant_id,
                source_type="PurchaseRequisition",
                source_id__in=req_item_ids,
            ).all()
            if req_item_ids
            else []
        )
        po_item_by_source: Dict[int, PurchaseOrderItem] = {}
        for pi in po_items_back:
            existing = po_item_by_source.get(pi.source_id)
            # 多次转单时取最新一条（id 最大）
            if existing is None or pi.id > existing.id:
                po_item_by_source[pi.source_id] = pi

        healed = False
        for it in all_items:
            target = po_item_by_source.get(it.id)
            if target and not it.purchase_order_id:
                await it.update_from_dict({
                    "purchase_order_id": target.order_id,
                    "purchase_order_item_id": target.id,
                }).save()
                it.purchase_order_id = target.order_id
                it.purchase_order_item_id = target.id
                healed = True

        # 若有自愈，重建明细响应
        if healed:
            items = await PurchaseRequisitionItem.filter(
                tenant_id=tenant_id, requisition_id=requisition_id
            ).all()
            item_resps, _ = await _build_item_resps(items, clear_orphan=False)
            all_items = items
        elif cleared_orphan:
            item_resps, _ = await _build_item_resps(all_items, clear_orphan=False)

        # 转单状态判定：以 items.purchase_order_id 与下游 PO 反查的并集为准
        converted_req_item_ids = {it.id for it in all_items if it.purchase_order_id} | set(po_item_by_source.keys())
        has_any = len(converted_req_item_ids) > 0
        all_converted = len(all_items) > 0 and len(converted_req_item_ids) >= len(all_items)

        current_norm = normalize_status(req.status)
        new_status = req.status
        if all_converted:
            new_status = DocumentStatus.FULL_CONVERTED.value
        elif has_any:
            new_status = DocumentStatus.PARTIAL_CONVERTED.value
        elif current_norm in (
            DocumentStatus.AUDITED.value,
            DocumentStatus.APPROVED.value,
            DocumentStatus.CONFIRMED.value,
            DocumentStatus.PARTIAL_CONVERTED.value,
            DocumentStatus.FULL_CONVERTED.value,
        ):
            # 仅在已通过/转单语义区间回落为已通过，避免覆盖草稿/待审核/驳回
            new_status = "已通过"

        if req.status != new_status:
            req.status = new_status
            await req.save()

        req_dict = {k: getattr(req, k) for k in req._meta.fields_map if hasattr(req, k)}
        req_dict.pop("items", None)
        resp = PurchaseRequisitionResponse.model_construct(**req_dict)
        resp.items = item_resps
        from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_requisition_lifecycle
        audit_required = await self.business_config_service.check_audit_required(tenant_id, "purchase_request")
        resp.lifecycle = get_purchase_requisition_lifecycle(req, audit_required=audit_required)
        return resp

    async def list_requisitions(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        source_type: Optional[str] = None,
        keyword: Optional[str] = None,
        requisition_code: Optional[str] = None,
        requisition_name: Optional[str] = None,
        required_date_from: Optional[date] = None,
        required_date_to: Optional[date] = None,
    ) -> Dict[str, Any]:
        """列表查询，返回 { data, total, success }"""
        query = PurchaseRequisition.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        )
        if status:
            query = query.filter(status=status)
        if source_type:
            query = query.filter(source_type=source_type)
        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(requisition_code__icontains=kw)
                | Q(requisition_name__icontains=kw)
                | Q(source_code__icontains=kw)
            )
        rc = (requisition_code or "").strip()
        if rc:
            query = query.filter(requisition_code__icontains=rc)
        rn = (requisition_name or "").strip()
        if rn:
            query = query.filter(requisition_name__icontains=rn)
        if required_date_from is not None:
            query = query.filter(
                required_date__isnull=False, required_date__gte=required_date_from
            )
        if required_date_to is not None:
            query = query.filter(
                required_date__isnull=False, required_date__lte=required_date_to
            )

        total = await query.count()
        reqs = await query.offset(skip).limit(limit).order_by("-updated_at", "-id")

        audit_required = await self.business_config_service.check_audit_required(tenant_id, "purchase_request")
        result = []
        for req in reqs:
            # 列表入口同样自愈转单状态，避免详情未打开前列表显示陈旧状态
            await self._recalc_conversion_status(tenant_id, req)
            items_count = await PurchaseRequisitionItem.filter(
                tenant_id=tenant_id, requisition_id=req.id
            ).count()
            req_dict = {k: getattr(req, k) for k in req._meta.fields_map if hasattr(req, k)}
            req_dict.pop("items", None)
            resp = PurchaseRequisitionListResponse.model_construct(**req_dict)
            resp.items_count = items_count
            from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_requisition_lifecycle, get_document_milestones
            milestones = await get_document_milestones(req.tenant_id, "purchase_requisition", req.id)
            resp.lifecycle = get_purchase_requisition_lifecycle(req, milestones=milestones, audit_required=audit_required)
            result.append(resp.model_dump())
        return {"data": result, "total": total, "success": True}

    async def _recalc_conversion_status(
        self, tenant_id: int, req: PurchaseRequisition
    ) -> None:
        """重新计算并保存采购申请的转单状态：
        - 自愈断开的链接（PurchaseOrderItem.source_id 反查）
        - 在「已通过/已确认/已审核/转单」语义区间内回写 PARTIAL_CONVERTED/FULL_CONVERTED
        草稿/待审核/驳回 等状态保持不变。
        """
        all_items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id, requisition_id=req.id
        ).all()
        req_item_ids = [i.id for i in all_items]
        po_items_back = (
            await PurchaseOrderItem.filter(
                tenant_id=tenant_id,
                source_type="PurchaseRequisition",
                source_id__in=req_item_ids,
            ).all()
            if req_item_ids
            else []
        )
        po_item_by_source: Dict[int, PurchaseOrderItem] = {}
        for pi in po_items_back:
            existing = po_item_by_source.get(pi.source_id)
            if existing is None or pi.id > existing.id:
                po_item_by_source[pi.source_id] = pi

        for it in all_items:
            target = po_item_by_source.get(it.id)
            if target and not it.purchase_order_id:
                await it.update_from_dict({
                    "purchase_order_id": target.order_id,
                    "purchase_order_item_id": target.id,
                }).save()
                it.purchase_order_id = target.order_id
                it.purchase_order_item_id = target.id

        converted_ids = {it.id for it in all_items if it.purchase_order_id} | set(po_item_by_source.keys())
        has_any = len(converted_ids) > 0
        all_converted = len(all_items) > 0 and len(converted_ids) >= len(all_items)

        current_norm = normalize_status(req.status)
        new_status = req.status
        if all_converted:
            new_status = DocumentStatus.FULL_CONVERTED.value
        elif has_any:
            new_status = DocumentStatus.PARTIAL_CONVERTED.value
        elif current_norm in (
            DocumentStatus.AUDITED.value,
            DocumentStatus.APPROVED.value,
            DocumentStatus.CONFIRMED.value,
            DocumentStatus.PARTIAL_CONVERTED.value,
            DocumentStatus.FULL_CONVERTED.value,
        ):
            new_status = "已通过"
        if req.status != new_status:
            req.status = new_status
            await req.save()

    async def merge_split_requisition_items(
        self, tenant_id: int, requisition_id: int
    ) -> None:
        """
        合并因部分下推而拆分的申请明细行。
        当同一物料存在多行且均未转单时，合并为一行（数量相加）。
        """
        items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id,
            requisition_id=requisition_id,
            purchase_order_id__isnull=True,
        ).all()
        if len(items) < 2:
            return

        by_material: Dict[int, List] = {}
        for i in items:
            mid = i.material_id
            if mid not in by_material:
                by_material[mid] = []
            by_material[mid].append(i)

        for mid, group in by_material.items():
            if len(group) < 2:
                continue
            total_qty = sum(Decimal(str(x.quantity or 0)) for x in group)
            keeper = group[0]
            to_delete = group[1:]
            await keeper.update_from_dict({"quantity": total_qty}).save()
            for d in to_delete:
                await d.delete()

    async def fix_requisition_status(
        self, tenant_id: int, requisition_id: int
    ) -> PurchaseRequisitionResponse:
        """
        修正采购申请状态：若状态为「全部转单」但存在未转单明细，则改为「部分转单」。
        同时清除指向已删除采购单的引用（purchase_order_id 指向不存在的 PO 时清空）。
        """
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")


        all_items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id, requisition_id=requisition_id
        ).all()

        # 清除指向已删除采购单的引用
        cleared_any = False
        for i in all_items:
            if i.purchase_order_id:
                po = await PurchaseOrder.get_or_none(
                    tenant_id=tenant_id, id=i.purchase_order_id
                )
                if not po:
                    await i.update_from_dict({
                        "purchase_order_id": None,
                        "purchase_order_item_id": None,
                        "supplier_id": None,
                    }).save()
                    cleared_any = True

        if cleared_any:
            await self.merge_split_requisition_items(tenant_id, requisition_id)

        # 复用统一的状态自愈逻辑（含 PurchaseOrderItem.source_id 反查）
        await self._recalc_conversion_status(tenant_id, req)
        return await self.get_requisition_by_id(tenant_id, requisition_id)

    async def delete_requisition(self, tenant_id: int, requisition_id: int) -> bool:
        """删除采购申请（软删除，仅草稿可删）"""
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")
        logger.info("kuaizhizao_purchase_requisition_delete attempt: tenant_id={} req_id={} status={}", tenant_id, requisition_id, req.status)
        if not is_draft_status(req.status) and not is_pending_review_status(req.status):
            raise BusinessLogicError("只有草稿状态或待审核的采购申请可删除")
        await PurchaseRequisition.filter(tenant_id=tenant_id, id=requisition_id).update(
            deleted_at=datetime.now()
        )
        return True

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
        if not is_draft_status(req.status):
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


        if not is_draft_status(req.status):
            raise BusinessLogicError("只有草稿状态可提交")

        # 检查是否需要审核
        audit_required = await self.business_config_service.check_audit_required(tenant_id, "purchase_request")
        
        if audit_required:
            req.status = DocumentStatus.PENDING_REVIEW.value
            req.review_status = ReviewStatus.PENDING.value
            # TODO: 接入真正的工作流引擎
        else:
            req.status = DocumentStatus.CONFIRMED.value
            req.review_status = ReviewStatus.APPROVED.value
            
        req.updated_by = submitted_by
        await req.save()

        return await self.get_requisition_by_id(tenant_id, requisition_id)

    async def approve_requisition(
        self,
        tenant_id: int,
        requisition_id: int,
        approved: bool,
        review_remarks: Optional[str] = None,
        approved_by: int = None,
    ) -> PurchaseRequisitionResponse:
        """审核采购申请（通过或驳回）"""
        from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, normalize_status

        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")

        normalized = normalize_status(req.status)
        if normalized != DocumentStatus.PENDING_REVIEW.value:
            raise BusinessLogicError("只有待审核状态的采购申请可审核")

        reviewer_name = await self.get_user_name(approved_by) if approved_by else None
        if approved:
            req.status = "已通过"  # 采购申请业务用语
            req.review_status = ReviewStatus.APPROVED.value
        else:
            req.status = "已驳回"
            req.review_status = ReviewStatus.REJECTED.value

        req.reviewer_id = approved_by
        req.reviewer_name = reviewer_name
        req.review_time = datetime.now()
        req.review_remarks = review_remarks
        req.updated_by = approved_by
        await req.save()

        return await self.get_requisition_by_id(tenant_id, requisition_id)

    async def withdraw_approval(
        self,
        tenant_id: int,
        requisition_id: int,
        operator_id: Optional[int] = None,
    ) -> PurchaseRequisitionResponse:
        """撤回审核：将已通过/部分转单/全部转单的采购申请撤回为待审核，可重新审核"""
        from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, normalize_status

        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")

        normalized = normalize_status(req.status)
        if normalized not in (
            DocumentStatus.AUDITED.value,
            DocumentStatus.CONFIRMED.value,
            DocumentStatus.PARTIAL_CONVERTED.value,
            DocumentStatus.FULL_CONVERTED.value,
        ):
            raise BusinessLogicError("只有已通过、部分转单或全部转单状态的采购申请可撤回审核")

        req.status = "草稿"  # 撤回后回到草稿状态，允许修改或删除
        req.review_status = ReviewStatus.PENDING.value
        req.reviewer_id = None
        req.reviewer_name = None
        req.review_time = None
        req.review_remarks = None
        req.updated_by = operator_id
        await req.save()

        return await self.get_requisition_by_id(tenant_id, requisition_id)

    @staticmethod
    def _resolve_line_supplier_id(item: PurchaseRequisitionItem, data: ConvertToPurchaseOrderRequest) -> Optional[int]:
        """申请行实际使用的供应商：item_suppliers 映射 > 行上 supplier_id > 请求头 supplier_id"""
        if data.item_suppliers and item.id is not None:
            iid = int(item.id)
            for k, v in data.item_suppliers.items():
                if int(k) == iid:
                    return int(v)
        if item.supplier_id:
            return int(item.supplier_id)
        if data.supplier_id:
            return int(data.supplier_id)
        return None

    async def _persist_buy_default_supplier(
        self,
        tenant_id: int,
        material_id: int,
        supplier_id: int,
        supplier_name: str,
    ) -> bool:
        """将默认供应商写回采购件物料的 source_config（仅 Buy）"""
        m = await Material.get_or_none(tenant_id=tenant_id, id=material_id, deleted_at__isnull=True)
        if not m or (m.source_type or "") != SOURCE_TYPE_BUY:
            return False
        cfg = dict(m.source_config or {})
        inner = dict(cfg.get("source_config") or {})
        inner["default_supplier_id"] = supplier_id
        inner["default_supplier_name"] = supplier_name or inner.get("default_supplier_name") or ""
        cfg["source_config"] = inner
        m.source_config = cfg
        await m.save()
        return True

    async def convert_to_purchase_order(
        self,
        tenant_id: int,
        requisition_id: int,
        data: ConvertToPurchaseOrderRequest,
        created_by: int,
    ) -> Dict[str, Any]:
        """将采购申请行转为采购订单；按供应商自动拆成多张采购单，可选回写物料默认供应商"""
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")


        normalized = normalize_status(req.status)
        if normalized not in (DocumentStatus.AUDITED.value, DocumentStatus.CONFIRMED.value, DocumentStatus.PARTIAL_CONVERTED.value):
            raise BusinessLogicError("只有已通过或部分转单状态的采购申请可转单")

        items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id,
            requisition_id=requisition_id,
            id__in=data.item_ids,
            purchase_order_id__isnull=True,
        ).all()

        if not items:
            raise BusinessLogicError("没有可转单的申请行或所选行已转单")

        # 行 -> 供应商
        line_suppliers: List[Tuple[PurchaseRequisitionItem, int]] = []
        for item in items:
            sid = self._resolve_line_supplier_id(item, data)
            # 未维护供应商时，允许先创建草稿采购单，后续在草稿中选择供应商
            line_suppliers.append((item, int(sid) if sid else 0))

        unique_ids = {sid for _, sid in line_suppliers}
        supplier_rows = await Supplier.filter(tenant_id=tenant_id, id__in=[sid for sid in unique_ids if sid > 0]).all()
        supplier_by_id = {s.id: s for s in supplier_rows}
        for sid in unique_ids:
            if sid <= 0:
                continue
            if sid not in supplier_by_id:
                raise NotFoundError(f"供应商不存在: {sid}")

        # 按供应商分组
        groups: Dict[int, List[PurchaseRequisitionItem]] = {}
        for item, sid in line_suppliers:
            groups.setdefault(sid, []).append(item)

        today = date.today()
        purchase_orders_out: List[Dict[str, Any]] = []
        persisted_material_ids: List[int] = []

        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            rel_svc = DocumentRelationNewService()
        except Exception:
            rel_svc = None

        for supplier_id, group_items in groups.items():
            sup = supplier_by_id.get(supplier_id) if supplier_id > 0 else None
            supplier_name = (sup.name if sup else None) or data.supplier_name or "待定供应商"

            max_required = max((i.required_date or today for i in group_items), default=today)
            po_items = []
            items_converted: List[tuple] = []

            for item in group_items:
                unit_price = item.suggested_unit_price or Decimal(0)
                full_qty = item.quantity
                qty = full_qty
                if data.item_quantities:
                    override = data.item_quantities.get(item.id) or data.item_quantities.get(str(item.id))
                    if override is not None:
                        qty = Decimal(str(override))
                if qty <= 0:
                    continue
                if qty < full_qty:
                    remaining = full_qty - qty
                    await PurchaseRequisitionItem.create(
                        tenant_id=tenant_id,
                        requisition_id=requisition_id,
                        material_id=item.material_id,
                        material_code=item.material_code,
                        material_name=item.material_name,
                        material_spec=item.material_spec,
                        unit=item.unit or "件",
                        quantity=remaining,
                        suggested_unit_price=item.suggested_unit_price,
                        required_date=item.required_date,
                        demand_computation_item_id=item.demand_computation_item_id,
                        supplier_id=item.supplier_id,
                        notes=item.notes,
                    )
                    await item.update_from_dict({"quantity": qty}).save()
                total_price = qty * unit_price
                items_converted.append((item, qty))
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

            if not po_items:
                continue

            po_data = PurchaseOrderCreate(
                supplier_id=supplier_id,
                supplier_name=supplier_name,
                order_date=today,
                delivery_date=max_required,
                order_type="标准采购",
                status=DocumentStatus.DRAFT.value,
                source_type="PurchaseRequisition",
                source_id=requisition_id,
                notes=f"由采购申请{req.requisition_code}转单生成",
                items=po_items,
            )

            po = await self.purchase_service.create_purchase_order(
                tenant_id=tenant_id, order_data=po_data, created_by=created_by
            )
            try:
                po = await self.purchase_service.submit_purchase_order(
                    tenant_id=tenant_id,
                    order_id=po.id,
                    submitted_by=created_by,
                )
            except Exception as e:
                logger.warning(
                    "采购申请转单后自动提交采购订单失败: requisition_id={} po_id={} err={}",
                    requisition_id,
                    po.id,
                    e,
                )

            for i, (item, _) in enumerate(items_converted):
                po_item = po.items[i] if i < len(po.items) else None
                po_item_id = getattr(po_item, "id", None) if po_item else None
                await item.update_from_dict({
                    "purchase_order_id": po.id,
                    "purchase_order_item_id": po_item_id,
                    "supplier_id": supplier_id if supplier_id > 0 else None,
                }).save()

                if data.persist_default_supplier_to_material and supplier_id > 0:
                    ok = await self._persist_buy_default_supplier(
                        tenant_id, item.material_id, supplier_id, supplier_name
                    )
                    if ok and item.material_id not in persisted_material_ids:
                        persisted_material_ids.append(item.material_id)

            po_code = getattr(po, "order_code", str(po.id))
            purchase_orders_out.append({
                "purchase_order_id": po.id,
                "purchase_order_code": po_code,
                "supplier_id": supplier_id,
            })

            if rel_svc:
                try:
                    await rel_svc.create_relation(
                        tenant_id=tenant_id,
                        relation_data=DocumentRelationCreate(
                            source_type="purchase_requisition",
                            source_id=requisition_id,
                            source_code=req.requisition_code,
                            source_name=req.requisition_name or req.requisition_code,
                            target_type="purchase_order",
                            target_id=po.id,
                            target_code=po_code,
                            target_name=getattr(po, "order_name", None) or po_code,
                            relation_type="source",
                            relation_mode="push",
                            relation_desc="采购申请转采购订单",
                        ),
                        created_by=created_by,
                    )
                except Exception as e:
                    logger.warning("创建采购申请→采购订单 单据关联失败: %s", e)

        if not purchase_orders_out:
            raise BusinessLogicError("所选明细的本次下推数量均为 0，无法生成采购订单")

        all_items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id, requisition_id=requisition_id
        ).all()
        all_converted = len(all_items) > 0 and all(i.purchase_order_id for i in all_items)
        req.status = DocumentStatus.FULL_CONVERTED.value if all_converted else DocumentStatus.PARTIAL_CONVERTED.value
        await req.save()

        first = purchase_orders_out[0]
        msg = (
            f"转单成功，共生成 {len(purchase_orders_out)} 张采购订单"
            if len(purchase_orders_out) > 1
            else "转单成功"
        )
        return {
            "success": True,
            "message": msg,
            "purchase_order_id": first["purchase_order_id"],
            "purchase_order_code": first["purchase_order_code"],
            "purchase_orders": purchase_orders_out,
            "persisted_material_ids": persisted_material_ids if data.persist_default_supplier_to_material else [],
        }

