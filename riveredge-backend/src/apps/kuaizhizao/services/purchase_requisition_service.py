"""
采购申请服务

提供采购申请相关的业务逻辑处理。

Author: RiverEdge Team
Date: 2025-02-01
"""

from datetime import datetime, date, time
from typing import List, Optional, Dict, Any, Tuple

from tortoise.expressions import Q
from decimal import Decimal
from tortoise.functions import Count

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
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_purchase_requisition_detail_capabilities,
    enrich_purchase_requisition_list_capabilities,
    purchase_requisition_has_linked_purchase_order,
)
from core.utils.timezone_utils import resolve_business_datetime, today_site_str, to_site_date
from apps.kuaizhizao.services.document_action_policy.purchase_requisition import (
    assert_purchase_requisition_capability,
    _can_push_downstream,
)

PURCHASE_REQUISITION_SORTABLE_FIELDS = frozenset({
    "requisition_code",
    "requisition_name",
    "source_type",
    "source_code",
    "requisition_date",
    "required_date",
    "status",
    "review_status",
    "applicant_name",
    "created_at",
    "updated_at",
})


class PurchaseRequisitionService(AppBaseService[PurchaseRequisition]):
    """采购申请服务"""

    def __init__(self):
        super().__init__(PurchaseRequisition)
        self.purchase_service = PurchaseService()
        self.business_config_service = BusinessConfigService()

    async def _generate_requisition_code(self, tenant_id: int) -> str:
        """生成采购申请编码"""
        return await self.generate_code(tenant_id, "PURCHASE_REQUISITION_CODE", prefix="CGSQ")

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

        # 写事务内只做插入；读回详情（含 enrich）放在提交后，避免嵌套事务/连接池等待
        async with in_transaction():
            if not data.requisition_code:
                data.requisition_code = await self._generate_requisition_code(tenant_id)

            req_date = data.requisition_date or date.today()
            user_info = await self.get_user_info(created_by)
            applicant_id = int(data.applicant_id) if data.applicant_id else created_by
            if data.applicant_name and str(data.applicant_name).strip():
                applicant_name = str(data.applicant_name).strip()
            elif applicant_id == created_by:
                applicant_name = user_info["name"]
            else:
                applicant_name = (await self.get_user_info(applicant_id))["name"]
            req = await PurchaseRequisition.create(
                tenant_id=tenant_id,
                requisition_code=data.requisition_code,
                requisition_name=data.requisition_name or f"采购申请-{data.requisition_code}",
                status="草稿",
                requisition_date=req_date,
                applicant_id=applicant_id,
                applicant_name=applicant_name,
                required_date=data.required_date,
                source_type=data.source_type,
                source_id=data.source_id,
                source_code=data.source_code,
                notes=data.notes,
                attachments=data.attachments,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
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
            req_id = req.id

        return await self.get_requisition_by_id(tenant_id, req_id)

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

        material_ids = sorted(
            {
                int(i.material_id)
                for i in items
                if getattr(i, "material_id", None) is not None
            }
        )
        material_rows = (
            await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
            if material_ids
            else []
        )
        material_by_id: Dict[int, Material] = {m.id: m for m in material_rows}



        async def _build_item_resps(items_list, clear_orphan: bool = False):
            resps = []
            cleared = False
            for i in items_list:
                d = {k: getattr(i, k) for k in i._meta.fields_map if hasattr(i, k)}
                material = material_by_id.get(int(i.material_id)) if getattr(i, "material_id", None) is not None else None
                repaired_fields: Dict[str, Any] = {}
                if material:
                    if not str(d.get("material_code") or "").strip():
                        candidate_code = (
                            getattr(material, "main_code", None)
                            or getattr(material, "code", None)
                            or ""
                        )
                        if candidate_code:
                            repaired_fields["material_code"] = str(candidate_code)
                    if not str(d.get("material_name") or "").strip() and getattr(material, "name", None):
                        repaired_fields["material_name"] = str(material.name)
                    if not str(d.get("material_spec") or "").strip() and getattr(material, "specification", None):
                        repaired_fields["material_spec"] = str(material.specification)
                    if not str(d.get("unit") or "").strip() and getattr(material, "base_unit", None):
                        repaired_fields["unit"] = str(material.base_unit)
                if repaired_fields:
                    d.update(repaired_fields)
                    await i.update_from_dict(repaired_fields).save()
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
        from core.services.approval.audit_record_enricher import enrich_record

        resp = await enrich_purchase_requisition_detail_capabilities(tenant_id, req, resp)
        return await enrich_record(tenant_id, "purchase_request", resp)

    async def _batch_requisition_items_count(
        self, tenant_id: int, requisition_ids: List[int]
    ) -> Dict[int, int]:
        """批量统计采购申请明细行数（列表用，避免 N+1 count）。"""
        if not requisition_ids:
            return {}
        rows = (
            await PurchaseRequisitionItem.filter(
                tenant_id=tenant_id,
                requisition_id__in=requisition_ids,
            )
            .group_by("requisition_id")
            .annotate(cnt=Count("id"))
            .values("requisition_id", "cnt")
        )
        return {int(row["requisition_id"]): int(row["cnt"]) for row in rows}

    async def _batch_requisition_item_totals(
        self, tenant_id: int, requisition_ids: List[int]
    ) -> Dict[int, Dict[str, Decimal]]:
        """批量统计采购申请总数量与总金额（列表用，避免逐单查询）。"""
        if not requisition_ids:
            return {}
        rows = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id,
            requisition_id__in=requisition_ids,
        ).values("requisition_id", "quantity", "suggested_unit_price")
        totals: Dict[int, Dict[str, Decimal]] = {}
        for row in rows:
            req_id = int(row["requisition_id"])
            quantity = Decimal(str(row.get("quantity") or 0))
            unit_price = Decimal(str(row.get("suggested_unit_price") or 0))
            bucket = totals.setdefault(
                req_id,
                {"total_quantity": Decimal("0"), "total_amount": Decimal("0")},
            )
            bucket["total_quantity"] += quantity
            bucket["total_amount"] += quantity * unit_price
        return totals

    async def _filter_requisitions_by_lifecycle_stage(
        self,
        tenant_id: int,
        reqs: List[PurchaseRequisition],
        lifecycle_stage: str,
        *,
        audit_required: bool,
    ) -> List[PurchaseRequisition]:
        """按后端 lifecycle 计算结果筛选（与列表展示阶段一致，避免 status 精确匹配漏单）。"""
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_purchase_requisition_lifecycle,
            normalize_purchase_requisition_lifecycle_filter,
        )

        if not reqs:
            return []

        target = normalize_purchase_requisition_lifecycle_filter(lifecycle_stage)
        matched: List[PurchaseRequisition] = []
        for req in reqs:
            lifecycle = get_purchase_requisition_lifecycle(
                req, milestones=None, audit_required=audit_required
            )
            stage_name = normalize_purchase_requisition_lifecycle_filter(
                lifecycle.get("current_stage_name"),
            )
            if stage_name == target:
                matched.append(req)
        return matched

    @staticmethod
    def _resolve_list_order_by(order_by: Optional[str]) -> tuple[str, str]:
        if order_by:
            field = order_by.lstrip("-")
            if field in PURCHASE_REQUISITION_SORTABLE_FIELDS:
                descending = order_by.startswith("-")
                primary = f"-{field}" if descending else field
                secondary = "-id" if descending else "id"
                return primary, secondary
        return "-created_at", "-id"

    @staticmethod
    def _sort_requisitions_in_memory(
        reqs: List[PurchaseRequisition],
        primary: str,
        secondary: str,
    ) -> List[PurchaseRequisition]:
        def field_key(field_name: str, req: PurchaseRequisition):
            val = getattr(req, field_name.lstrip("-"), None)
            if val is None:
                return (1, "")
            return (0, val)

        def sort_key(req: PurchaseRequisition):
            p_field = primary.lstrip("-")
            s_field = secondary.lstrip("-")
            return (field_key(p_field, req), field_key(s_field, req))

        reverse = primary.startswith("-")
        return sorted(reqs, key=sort_key, reverse=reverse)

    async def list_requisitions(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        lifecycle_stage: Optional[str] = None,
        source_type: Optional[str] = None,
        keyword: Optional[str] = None,
        requisition_code: Optional[str] = None,
        requisition_name: Optional[str] = None,
        required_date_from: Optional[date] = None,
        required_date_to: Optional[date] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        order_by: Optional[str] = None,
        include_items: bool = False,
    ) -> Dict[str, Any]:
        """列表查询，返回 { data, total, success }"""
        from apps.kuaizhizao.utils.list_item_material_keyword import (
            header_ids_matching_item_material,
        )

        query = PurchaseRequisition.filter(
            tenant_id=tenant_id, deleted_at__isnull=True
        )
        lifecycle_filter = (lifecycle_stage or "").strip()
        if status and not lifecycle_filter:
            query = query.filter(status=status)
        if source_type:
            query = query.filter(source_type=source_type)
        kw = (keyword or "").strip()
        if kw:
            material_req_ids = await header_ids_matching_item_material(
                tenant_id,
                PurchaseRequisitionItem,
                "requisition_id",
                kw,
            )
            query = query.filter(
                Q(requisition_code__icontains=kw)
                | Q(requisition_name__icontains=kw)
                | Q(source_code__icontains=kw)
                | Q(applicant_name__icontains=kw)
                | Q(id__in=material_req_ids)
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
        if created_start_date is not None:
            query = query.filter(
                created_at__gte=datetime.combine(created_start_date, time.min)
            )
        if created_end_date is not None:
            query = query.filter(
                created_at__lte=datetime.combine(created_end_date, time(23, 59, 59))
            )

        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "purchase_request"
        )

        primary_order, secondary_order = self._resolve_list_order_by(order_by)

        if lifecycle_filter:
            candidate_reqs = await query.order_by(primary_order, secondary_order).all()
            matched_reqs = await self._filter_requisitions_by_lifecycle_stage(
                tenant_id,
                candidate_reqs,
                lifecycle_filter,
                audit_required=audit_required,
            )
            sorted_reqs = self._sort_requisitions_in_memory(
                matched_reqs, primary_order, secondary_order
            )
            total = len(sorted_reqs)
            reqs = sorted_reqs[skip : skip + limit]
        else:
            total = await query.count()
            reqs = await query.offset(skip).limit(limit).order_by(primary_order, secondary_order)

        req_ids = [req.id for req in reqs if req.id is not None]

        items_by_req: Dict[int, List[PurchaseRequisitionItemResponse]] = {}
        if include_items and req_ids:
            all_items = (
                await PurchaseRequisitionItem.filter(
                    tenant_id=tenant_id, requisition_id__in=req_ids
                )
                .order_by("requisition_id", "id")
                .all()
            )
            for it in all_items:
                rid = int(it.requisition_id)
                items_by_req.setdefault(rid, []).append(
                    PurchaseRequisitionItemResponse.model_validate(it)
                )

        items_count_map = await self._batch_requisition_items_count(tenant_id, req_ids)
        item_totals_map = await self._batch_requisition_item_totals(tenant_id, req_ids)
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_purchase_requisition_lifecycle,
        )

        result = []
        for req in reqs:
            req_dict = {k: getattr(req, k) for k in req._meta.fields_map if hasattr(req, k)}
            req_dict.pop("items", None)
            resp = PurchaseRequisitionListResponse.model_construct(**req_dict)
            resp.items_count = items_count_map.get(req.id, 0)
            totals = item_totals_map.get(req.id, None)
            if totals:
                resp.total_quantity = totals["total_quantity"]
                resp.total_amount = totals["total_amount"]
            else:
                resp.total_quantity = Decimal("0")
                resp.total_amount = Decimal("0")
            # 列表仅按当前 status 计算生命周期；转单状态自愈在详情/转单/修正接口执行
            resp.lifecycle = get_purchase_requisition_lifecycle(
                req, milestones=None, audit_required=audit_required
            )
            if include_items:
                resp.items = items_by_req.get(int(req.id), [])
            result.append(resp)

        enriched = await enrich_purchase_requisition_list_capabilities(tenant_id, reqs, result)
        from core.services.approval.audit_record_enricher import enrich_data_payload

        return await enrich_data_payload(tenant_id, "purchase_request", {
            "data": [item.model_dump() for item in enriched], "total": total, "success": True
        })

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
        assert_purchase_requisition_capability(req, "delete")
        await PurchaseRequisition.filter(tenant_id=tenant_id, id=requisition_id).update(
            deleted_at=resolve_business_datetime()
        )
        return True

    async def update_requisition(
        self,
        tenant_id: int,
        requisition_id: int,
        data: PurchaseRequisitionUpdate,
        updated_by: int,
        approval_edit_context: Optional[Dict[str, Any]] = None,
        approval_edit_comment: Optional[str] = None,
    ) -> PurchaseRequisitionResponse:
        """更新采购申请（草稿可改；审核中须当前审批人且节点开启改单）"""
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")
        is_draft = is_draft_status(req.status)
        is_pending = is_pending_review_status(req.status)
        if not is_draft:
            if not (is_pending and approval_edit_context):
                if is_pending and not approval_edit_context:
                    from core.services.approval.approval_edit_guard import ApprovalEditGuard

                    edit_ctx = await ApprovalEditGuard.get_pending_edit_context(
                        tenant_id, "purchase_request", requisition_id, updated_by
                    )
                    if not edit_ctx:
                        raise BusinessLogicError("单据审核中，仅已开启改单权限的当前审批人可修改")
                    approval_edit_context = edit_ctx
                else:
                    assert_purchase_requisition_capability(req, "update")

        if approval_edit_context:
            from core.config.audit_editable_fields import is_field_editable

            node_editable = approval_edit_context.get("editable_fields")
            preview = data.model_dump(exclude_unset=True, exclude={"items"})
            for field in preview:
                if field in ("updated_by",):
                    continue
                if not is_field_editable("purchase_request", field, node_editable):
                    raise ValidationError(f"字段「{field}」不允许在审核中修改")
            if data.items is not None and not is_field_editable("purchase_request", "items", node_editable):
                raise ValidationError("字段「申请明细」不允许在审核中修改")

        update_data = data.model_dump(exclude_unset=True, exclude={"items"})
        if update_data:
            user_info = await self.get_user_info(updated_by)
            await req.update_from_dict({
                **update_data,
                "updated_by": updated_by,
                "updated_by_name": user_info["name"],
            }).save()

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


        assert_purchase_requisition_capability(req, "submit")

        # 检查是否需要审核
        audit_required = await self.business_config_service.check_audit_required(tenant_id, "purchase_request")
        
        if audit_required:
            req.status = DocumentStatus.PENDING_REVIEW.value
            req.review_status = ReviewStatus.PENDING.value
            # TODO: 接入真正的工作流引擎
        else:
            req.status = DocumentStatus.CONFIRMED.value
            req.review_status = ReviewStatus.APPROVED.value
            
        user_info = await self.get_user_info(submitted_by)
        req.updated_by = submitted_by
        req.updated_by_name = user_info["name"]
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

        assert_purchase_requisition_capability(req, "approve")

        user_info = await self.get_user_info(approved_by) if approved_by else None
        reviewer_name = user_info["name"] if user_info else None
        if approved:
            req.status = "已通过"  # 采购申请业务用语
            req.review_status = ReviewStatus.APPROVED.value
        else:
            req.status = "已驳回"
            req.review_status = ReviewStatus.REJECTED.value

        req.reviewer_id = approved_by
        req.reviewer_name = reviewer_name
        req.review_time = resolve_business_datetime()
        req.review_remarks = review_remarks
        if approved_by:
            req.updated_by = approved_by
            req.updated_by_name = user_info["name"]
        await req.save()

        return await self.get_requisition_by_id(tenant_id, requisition_id)

    async def withdraw_requisition(
        self,
        tenant_id: int,
        requisition_id: int,
        withdrawn_by: int,
    ) -> PurchaseRequisitionResponse:
        """撤回提交：待审核 → 草稿（提交人撤回，非反审核）"""
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")
        if not is_pending_review_status(req.status):
            raise BusinessLogicError("只有待审核状态的采购申请可撤回提交")

        try:
            from core.services.approval.approval_instance_service import ApprovalInstanceService

            await ApprovalInstanceService.cancel_approval(
                tenant_id=tenant_id,
                entity_type="purchase_request",
                entity_id=requisition_id,
                operator_id=withdrawn_by,
            )
        except Exception as e:
            logger.warning("取消采购申请审批流程失败或无需取消: {}", e)

        req.status = DocumentStatus.DRAFT.value
        req.review_status = ReviewStatus.PENDING.value
        req.reviewer_id = None
        req.reviewer_name = None
        req.review_time = None
        req.review_remarks = None
        user_info = await self.get_user_info(withdrawn_by)
        req.updated_by = withdrawn_by
        req.updated_by_name = user_info["name"]
        await req.save()

        return await self.get_requisition_by_id(tenant_id, requisition_id)

    async def withdraw_approval(
        self,
        tenant_id: int,
        requisition_id: int,
        operator_id: Optional[int] = None,
    ) -> PurchaseRequisitionResponse:
        """撤销审核：人工审→待审核，自动审→草稿。"""
        from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, normalize_status
        from core.services.approval.audit_transition import resolve_revoke_landing_phase

        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")

        has_linked_po = await purchase_requisition_has_linked_purchase_order(
            tenant_id, requisition_id
        )
        assert_purchase_requisition_capability(
            req,
            "revoke_approval",
            has_linked_purchase_order=has_linked_po,
        )

        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "purchase_request"
        )
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
        req.status = (
            DocumentStatus.PENDING_REVIEW.value
            if landing == "pending"
            else "草稿"
        )
        req.review_status = ReviewStatus.PENDING.value
        req.reviewer_id = None
        req.reviewer_name = None
        req.review_time = None
        req.review_remarks = None
        if operator_id:
            user_info = await self.get_user_info(operator_id)
            req.updated_by = operator_id
            req.updated_by_name = user_info["name"]
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

    async def preview_push_to_purchase_order(
        self,
        tenant_id: int,
        requisition_id: int,
    ) -> Dict[str, Any]:
        """下推采购订单预览：返回可转单明细及数量门禁，不实际创建。"""
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")
        assert_purchase_requisition_capability(req, "push_purchase_order")

        detail = await self.get_requisition_by_id(tenant_id, requisition_id)
        preview_items: List[Dict[str, Any]] = []
        for item in detail.items or []:
            if item.purchase_order_id:
                continue
            qty = float(item.quantity or 0)
            if qty <= 0:
                continue
            pushed = float(item.converted_quantity_draft or 0) + float(
                item.converted_quantity_confirmed or 0
            )
            max_push = max(0.0, qty - pushed)
            if max_push <= 0:
                continue
            preview_items.append(
                {
                    "item_id": int(item.id),
                    "material_id": item.material_id,
                    "material_code": item.material_code,
                    "material_name": item.material_name,
                    "material_spec": item.material_spec,
                    "unit": item.unit,
                    "quantity": qty,
                    "pushed_quantity": pushed,
                    "max_push_quantity": max_push,
                    "suggested_unit_price": float(item.suggested_unit_price or 0),
                    "supplier_id": item.supplier_id,
                    "required_date": str(item.required_date) if item.required_date else None,
                }
            )

        pushable_count = len(preview_items)
        has_blocking = pushable_count == 0
        blocking_reason = (
            "purchase_requisition.push_purchase_order.no_lines" if has_blocking else None
        )
        return {
            "target_type": "purchase_order",
            "requisition_id": requisition_id,
            "requisition_code": detail.requisition_code,
            "summary": (
                f"请选择本次要下推的采购申请明细（{pushable_count} 行可下推）"
                if not has_blocking
                else "当前采购申请无可下推明细"
            ),
            "items": preview_items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": blocking_reason,
            "tip": "系统将按所选明细与数量生成采购订单，可按供应商自动拆单。",
        }

    async def preview_push_to_inquiry(
        self,
        tenant_id: int,
        requisition_id: int,
    ) -> Dict[str, Any]:
        """下推询价单预览：返回可询价明细及数量门禁，不实际创建。"""
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")
        assert_purchase_requisition_capability(req, "push_inquiry")

        detail = await self.get_requisition_by_id(tenant_id, requisition_id)
        candidate_items = [
            i for i in (detail.items or []) if not i.purchase_order_id and float(i.quantity or 0) > 0
        ]
        candidate_ids = [int(i.id) for i in candidate_items if i.id is not None]
        blocked_ids: set[int] = set()
        if candidate_ids:
            from apps.kuaizhizao.models.purchase_inquiry import PurchaseInquiry, PurchaseInquiryItem
            from apps.kuaizhizao.constants.purchase_inquiry import INQUIRY_ACTIVE_STATUSES

            active_items = await PurchaseInquiryItem.filter(
                tenant_id=tenant_id,
                source_requisition_item_id__in=candidate_ids,
                purchase_order_id__isnull=True,
            ).all()
            inquiry_ids = {a.inquiry_id for a in active_items}
            active_inquiries = (
                await PurchaseInquiry.filter(
                    tenant_id=tenant_id,
                    id__in=list(inquiry_ids),
                    deleted_at__isnull=True,
                    status__in=list(INQUIRY_ACTIVE_STATUSES),
                ).all()
                if inquiry_ids
                else []
            )
            active_inquiry_ids = {a.id for a in active_inquiries}
            blocked_ids = {
                int(a.source_requisition_item_id)
                for a in active_items
                if a.inquiry_id in active_inquiry_ids and a.source_requisition_item_id
            }

        preview_items: List[Dict[str, Any]] = []
        for item in candidate_items:
            if item.id is None:
                continue
            qty = float(item.quantity or 0)
            in_active_inquiry = int(item.id) in blocked_ids
            max_push = 0.0 if in_active_inquiry else qty
            preview_items.append(
                {
                    "item_id": int(item.id),
                    "material_id": item.material_id,
                    "material_code": item.material_code,
                    "material_name": item.material_name,
                    "material_spec": item.material_spec,
                    "unit": item.unit,
                    "quantity": qty,
                    "pushed_quantity": qty if in_active_inquiry else 0.0,
                    "max_push_quantity": max_push,
                    "required_date": str(item.required_date) if item.required_date else None,
                    "in_active_inquiry": in_active_inquiry,
                }
            )

        pushable_count = sum(1 for row in preview_items if float(row["max_push_quantity"]) > 0)
        has_blocking = pushable_count == 0
        blocking_reason = (
            "purchase_requisition.push_inquiry.no_lines" if has_blocking else None
        )
        return {
            "target_type": "purchase_inquiry",
            "requisition_id": requisition_id,
            "requisition_code": detail.requisition_code,
            "summary": (
                f"请选择本次要询价的采购申请明细（{pushable_count}/{len(preview_items)} 行可询价）"
                if not has_blocking
                else "当前采购申请无可询价明细"
            ),
            "items": preview_items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": blocking_reason,
            "tip": "系统将按所选明细创建询价单，并推荐供应商参与报价。",
        }

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

        assert_purchase_requisition_capability(req, "push_purchase_order")

        items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id,
            requisition_id=requisition_id,
            id__in=data.item_ids,
            purchase_order_id__isnull=True,
        ).all()

        if not items:
            raise BusinessLogicError("没有可转单的申请行或所选行已转单")

        from apps.kuaizhizao.services.purchase_inquiry_service import PurchaseInquiryService
        await PurchaseInquiryService._assert_requisition_items_not_in_active_inquiry(
            tenant_id, [i.id for i in items]
        )

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
        push_mode = await BusinessConfigService().get_push_default_mode(tenant_id)
        push_as_confirm = push_mode == "confirm"

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
                if data.item_unit_prices:
                    price_override = data.item_unit_prices.get(item.id) or data.item_unit_prices.get(str(item.id))
                    if price_override is not None:
                        unit_price = Decimal(str(price_override))
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
                        source_type="purchase_requisition",
                        source_id=item.id,
                        demand_computation_item_id=item.demand_computation_item_id,
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
                source_type="purchase_requisition",
                source_id=requisition_id,
                notes=f"由采购申请{req.requisition_code}转单生成",
                items=po_items,
            )

            po = await self.purchase_service.create_purchase_order(
                tenant_id=tenant_id, order_data=po_data, created_by=created_by
            )
            # 与业务自动化「下推默认生成方式」一致：confirm 才自动提交，draft 保持草稿
            if push_as_confirm:
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

    async def list_purchase_order_pull_lines(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        requisition_id: Optional[int] = None,
        pullable_only: bool = True,
    ) -> Dict[str, Any]:
        """开口申请行：可转采购订单的剩余明细。"""
        return await self._list_requisition_open_lines(
            tenant_id,
            skip=skip,
            limit=limit,
            keyword=keyword,
            requisition_id=requisition_id,
            pullable_only=pullable_only,
            target="purchase_order",
        )

    async def list_purchase_inquiry_pull_lines(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        requisition_id: Optional[int] = None,
        pullable_only: bool = True,
    ) -> Dict[str, Any]:
        """开口申请行：可转询价的剩余明细。"""
        return await self._list_requisition_open_lines(
            tenant_id,
            skip=skip,
            limit=limit,
            keyword=keyword,
            requisition_id=requisition_id,
            pullable_only=pullable_only,
            target="inquiry",
        )

    async def _list_requisition_open_lines(
        self,
        tenant_id: int,
        *,
        skip: int,
        limit: int,
        keyword: Optional[str],
        requisition_id: Optional[int],
        pullable_only: bool,
        target: str,
    ) -> Dict[str, Any]:
        req_query = PurchaseRequisition.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if requisition_id is not None:
            req_query = req_query.filter(id=int(requisition_id))
        requisitions = await req_query.only(
            "id", "requisition_code", "status"
        )
        req_by_id = {int(r.id): r for r in requisitions}
        if not req_by_id:
            return {"data": [], "total": 0}

        items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id,
            requisition_id__in=list(req_by_id.keys()),
        ).all()

        blocked_ids: set = set()
        if target == "inquiry":
            from apps.kuaizhizao.models.purchase_inquiry import PurchaseInquiry, PurchaseInquiryItem
            from apps.kuaizhizao.constants.purchase_inquiry import INQUIRY_ACTIVE_STATUSES

            candidate_ids = [int(i.id) for i in items if i.id is not None and not i.purchase_order_id]
            if candidate_ids:
                active_items = await PurchaseInquiryItem.filter(
                    tenant_id=tenant_id,
                    source_requisition_item_id__in=candidate_ids,
                    purchase_order_id__isnull=True,
                ).all()
                inquiry_ids = {a.inquiry_id for a in active_items}
                active_inquiries = (
                    await PurchaseInquiry.filter(
                        tenant_id=tenant_id,
                        id__in=list(inquiry_ids),
                        deleted_at__isnull=True,
                        status__in=list(INQUIRY_ACTIVE_STATUSES),
                    ).all()
                    if inquiry_ids
                    else []
                )
                active_inquiry_ids = {a.id for a in active_inquiries}
                blocked_ids = {
                    int(a.source_requisition_item_id)
                    for a in active_items
                    if a.inquiry_id in active_inquiry_ids and a.source_requisition_item_id
                }

        kw = (keyword or "").strip().lower()
        lines: List[Dict[str, Any]] = []
        for item in items:
            req = req_by_id.get(int(item.requisition_id))
            if not req:
                continue
            can_push = _can_push_downstream(req.status)
            qty = float(item.quantity or 0)
            if qty <= 0:
                continue
            if target == "purchase_order":
                # 转单占用仅以 purchase_order_id 为准；converted_quantity_* 是详情 Schema 派生字段，非 ORM 列
                if item.purchase_order_id:
                    remaining = 0.0
                    pushed = qty
                else:
                    pushed = 0.0
                    remaining = qty
            else:
                in_active = int(item.id) in blocked_ids if item.id is not None else False
                if item.purchase_order_id or in_active:
                    remaining = 0.0
                    pushed = qty
                else:
                    remaining = qty
                    pushed = 0.0
            selectable = can_push and remaining > 0
            if pullable_only and not selectable:
                continue
            material_code = str(item.material_code or "").strip()
            material_name = str(item.material_name or "").strip()
            material_spec = str(item.material_spec or "").strip()
            if kw:
                haystack = " ".join([material_code, material_name, material_spec]).lower()
                if kw not in haystack:
                    continue
            lines.append(
                {
                    "id": int(item.id),
                    "requisition_id": int(item.requisition_id),
                    "requisition_code": req.requisition_code,
                    "material_id": item.material_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "material_spec": material_spec or None,
                    "unit": item.unit or "件",
                    "suggested_quantity": qty,
                    "pushed_quantity": pushed,
                    "remaining_quantity": remaining,
                    "required_date": str(item.required_date) if item.required_date else None,
                    "supplier_id": item.supplier_id,
                }
            )

        lines.sort(
            key=lambda r: (
                str(r.get("requisition_code") or ""),
                str(r.get("material_code") or ""),
                int(r.get("id") or 0),
            )
        )
        total = len(lines)
        return {"data": lines[skip : skip + limit], "total": total}

    async def convert_selected_items_to_purchase_orders(
        self,
        tenant_id: int,
        item_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        """按申请行 id 转采购订单，可跨多张申请；同供应商合并一张订单。"""
        selected_ids = [int(v) for v in item_ids if v is not None]
        if not selected_ids:
            raise BusinessLogicError("请至少选择一条可下推采购申请明细")

        items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id,
            id__in=selected_ids,
            purchase_order_id__isnull=True,
        ).all()
        if not items:
            raise BusinessLogicError("没有可转单的申请行或所选行已转单")

        requisition_ids = sorted({int(i.requisition_id) for i in items})
        requisitions = await PurchaseRequisition.filter(
            tenant_id=tenant_id,
            id__in=requisition_ids,
            deleted_at__isnull=True,
        ).all()
        req_by_id = {int(r.id): r for r in requisitions}
        if len(req_by_id) != len(requisition_ids):
            raise NotFoundError("采购申请不存在")
        for req in requisitions:
            assert_purchase_requisition_capability(req, "push_purchase_order")

        from apps.kuaizhizao.services.purchase_inquiry_service import PurchaseInquiryService
        await PurchaseInquiryService._assert_requisition_items_not_in_active_inquiry(
            tenant_id, [i.id for i in items]
        )

        data = ConvertToPurchaseOrderRequest(item_ids=selected_ids)
        line_suppliers: List[Tuple[PurchaseRequisitionItem, int]] = []
        for item in items:
            sid = self._resolve_line_supplier_id(item, data)
            line_suppliers.append((item, int(sid) if sid else 0))

        unique_ids = {sid for _, sid in line_suppliers}
        supplier_rows = await Supplier.filter(
            tenant_id=tenant_id, id__in=[sid for sid in unique_ids if sid > 0]
        ).all()
        supplier_by_id = {s.id: s for s in supplier_rows}
        for sid in unique_ids:
            if sid > 0 and sid not in supplier_by_id:
                raise NotFoundError(f"供应商不存在: {sid}")

        groups: Dict[int, List[PurchaseRequisitionItem]] = {}
        for item, sid in line_suppliers:
            groups.setdefault(sid, []).append(item)

        today = to_site_date(resolve_business_datetime())
        purchase_orders_out: List[Dict[str, Any]] = []
        push_mode = await BusinessConfigService().get_push_default_mode(tenant_id)
        push_as_confirm = push_mode == "confirm"

        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

        rel_svc = DocumentRelationNewService()

        for supplier_id, group_items in groups.items():
            sup = supplier_by_id.get(supplier_id) if supplier_id > 0 else None
            supplier_name = (sup.name if sup else None) or "待定供应商"
            max_required = max((i.required_date or today for i in group_items), default=today)
            source_req_ids = sorted({int(i.requisition_id) for i in group_items})
            primary = req_by_id[source_req_ids[0]]
            source_codes = " ".join(req_by_id[rid].requisition_code for rid in source_req_ids)
            po_items = []
            items_converted: List[tuple] = []
            for item in group_items:
                qty = item.quantity
                if qty <= 0:
                    continue
                unit_price = item.suggested_unit_price or Decimal(0)
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
                        total_price=qty * unit_price,
                        received_quantity=Decimal(0),
                        outstanding_quantity=qty,
                        required_date=item.required_date or max_required,
                        source_type="purchase_requisition",
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
                source_type="purchase_requisition",
                source_id=primary.id,
                notes=f"由采购申请{source_codes}转单生成",
                items=po_items,
            )
            po = await self.purchase_service.create_purchase_order(
                tenant_id=tenant_id, order_data=po_data, created_by=created_by
            )
            if push_as_confirm:
                try:
                    po = await self.purchase_service.submit_purchase_order(
                        tenant_id=tenant_id,
                        order_id=po.id,
                        submitted_by=created_by,
                    )
                except Exception as e:
                    logger.warning(
                        "采购申请转单后自动提交采购订单失败: po_id={} err={}",
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
            po_code = getattr(po, "order_code", str(po.id))
            purchase_orders_out.append({
                "purchase_order_id": po.id,
                "purchase_order_code": po_code,
                "supplier_id": supplier_id,
            })
            for rid in source_req_ids:
                req = req_by_id[rid]
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="purchase_requisition",
                        source_id=rid,
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

        if not purchase_orders_out:
            raise BusinessLogicError("所选明细的本次下推数量均为 0，无法生成采购订单")

        for rid in requisition_ids:
            all_items = await PurchaseRequisitionItem.filter(
                tenant_id=tenant_id, requisition_id=rid
            ).all()
            all_converted = len(all_items) > 0 and all(i.purchase_order_id for i in all_items)
            req = req_by_id[rid]
            req.status = (
                DocumentStatus.FULL_CONVERTED.value
                if all_converted
                else DocumentStatus.PARTIAL_CONVERTED.value
            )
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
        }

