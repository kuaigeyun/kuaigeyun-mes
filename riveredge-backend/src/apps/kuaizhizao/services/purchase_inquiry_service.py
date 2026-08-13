"""
采购询价单服务

Author: RiverEdge Team
Date: 2026-05-28
"""

import asyncio
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence, Tuple

from tortoise.expressions import Q
from tortoise.functions import Count
from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, normalize_status, is_draft_status
from apps.kuaizhizao.constants.purchase_inquiry import (
    INQUIRY_ACTIVE_STATUSES,
    INQUIRY_STATUS_LABELS,
    PurchaseInquiryStatus,
    PurchaseInquiryVendorStatus,
    PurchaseSupplierQuoteChannel,
    PurchaseSupplierQuoteStatus,
)
from apps.kuaizhizao.models import (
    PurchaseInquiry,
    PurchaseInquiryItem,
    PurchaseInquiryVendor,
    PurchaseRequisition,
    PurchaseRequisitionItem,
    PurchaseSupplierQuote,
    PurchaseSupplierQuoteItem,
)
from apps.kuaizhizao.services.document_action_policy.purchase_requisition import (
    assert_purchase_requisition_capability,
)
from apps.kuaizhizao.schemas.purchase import PurchaseOrderCreate, PurchaseOrderItemCreate
from apps.kuaizhizao.schemas.purchase_inquiry import (
    AwardQuotesRequest,
    ComparisonCell,
    ComparisonMatrixResponse,
    ComparisonRow,
    ConvertInquiryToPORequest,
    CreateFromRequisitionRequest,
    PurchaseInquiryCreate,
    PurchaseInquiryItemResponse,
    PurchaseInquiryResponse,
    PurchaseInquiryUpdate,
    PurchaseInquiryVendorResponse,
    PurchaseSupplierQuoteItemResponse,
    PurchaseSupplierQuoteResponse,
    UpsertSupplierQuoteRequest,
)
from apps.kuaizhizao.services.purchase_service import PurchaseService
from apps.kuaizhizao.utils.material_source_helper import get_material_source_config
from apps.master_data.models import Supplier
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.services.business_config_service import BusinessConfigService
from loguru import logger
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_purchase_inquiry_capabilities_on_response,
    enrich_purchase_inquiry_list_capabilities,
)
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from apps.kuaizhizao.services.document_action_policy.purchase_inquiry import (
    assert_purchase_inquiry_capability,
)

PURCHASE_INQUIRY_SORTABLE_FIELDS = frozenset({
    "inquiry_code",
    "inquiry_name",
    "source_code",
    "inquiry_date",
    "quote_deadline",
    "status",
    "review_status",
    "buyer_name",
    "total_quantity",
    "created_at",
    "updated_at",
})

# 生命周期钉住 Tab → status 库值（与 get_purchase_inquiry_lifecycle 一致，避免全表加载）
_INQUIRY_LIFECYCLE_STATUS_VALUES: Dict[str, Tuple[str, ...]] = {
    "draft": ("DRAFT", "draft", "草稿", "CANCELLED", "cancelled", "已取消"),
    "草稿": ("DRAFT", "draft", "草稿", "CANCELLED", "cancelled", "已取消"),
    "quoting": ("QUOTING", "quoting", "询价中"),
    "询价中": ("QUOTING", "quoting", "询价中"),
    "pending_compare": ("PENDING_COMPARE", "pending_compare", "待比价"),
    "待比价": ("PENDING_COMPARE", "pending_compare", "待比价"),
    "awarded": ("AWARDED", "awarded", "已定标"),
    "已定标": ("AWARDED", "awarded", "已定标"),
    "converted": ("CONVERTED", "converted", "已转单"),
    "已转单": ("CONVERTED", "converted", "已转单"),
}


class PurchaseInquiryService(AppBaseService[PurchaseInquiry]):
    def __init__(self):
        super().__init__(PurchaseInquiry)
        self.purchase_service = PurchaseService()
        self.business_config_service = BusinessConfigService()

    async def _ensure_module_enabled(self, tenant_id: int) -> None:
        if not await self.business_config_service.check_node_enabled(tenant_id, "purchase_inquiry"):
            raise BusinessLogicError("采购询价模块未启用")

    async def _generate_inquiry_code(self, tenant_id: int) -> str:
        try:
            return await self.generate_code(tenant_id, "PURCHASE_INQUIRY_CODE", prefix="CGXJ")
        except Exception:
            import uuid
            return f"CGXJ{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

    def _status_label(self, status: str) -> str:
        return INQUIRY_STATUS_LABELS.get(status, status)

    @staticmethod
    def _statuses_for_lifecycle_stage(lifecycle_stage: str) -> Optional[Tuple[str, ...]]:
        from apps.kuaizhizao.services.document_lifecycle_service import (
            normalize_purchase_inquiry_lifecycle_stage,
        )

        raw = (lifecycle_stage or "").strip()
        if not raw:
            return None
        norm = normalize_purchase_inquiry_lifecycle_stage(raw)
        return _INQUIRY_LIFECYCLE_STATUS_VALUES.get(norm) or _INQUIRY_LIFECYCLE_STATUS_VALUES.get(raw)

    async def _batch_inquiry_items_count(
        self, tenant_id: int, inquiry_ids: Sequence[int]
    ) -> Dict[int, int]:
        if not inquiry_ids:
            return {}
        rows = (
            await PurchaseInquiryItem.filter(
                tenant_id=tenant_id,
                inquiry_id__in=list(inquiry_ids),
            )
            .group_by("inquiry_id")
            .annotate(cnt=Count("id"))
            .values("inquiry_id", "cnt")
        )
        return {int(row["inquiry_id"]): int(row["cnt"]) for row in rows}

    async def _batch_awarded_amounts(
        self, tenant_id: int, inquiry_ids: Sequence[int]
    ) -> Dict[int, Decimal]:
        """批量汇总已定标金额（quote_item.is_awarded），避免列表逐单查报价行。"""
        result = {int(i): Decimal("0.00") for i in inquiry_ids}
        if not inquiry_ids:
            return result
        quotes = await PurchaseSupplierQuote.filter(
            tenant_id=tenant_id,
            inquiry_id__in=list(inquiry_ids),
            deleted_at__isnull=True,
        ).values("id", "inquiry_id")
        if not quotes:
            return result
        quote_to_inquiry = {int(q["id"]): int(q["inquiry_id"]) for q in quotes}
        q_items = await PurchaseSupplierQuoteItem.filter(
            tenant_id=tenant_id,
            quote_id__in=list(quote_to_inquiry.keys()),
            is_awarded=True,
        ).values("quote_id", "quoted_quantity", "unit_price")
        for row in q_items:
            iid = quote_to_inquiry.get(int(row["quote_id"]))
            if iid is None:
                continue
            result[iid] += Decimal(str(row.get("quoted_quantity") or 0)) * Decimal(
                str(row.get("unit_price") or 0)
            )
        return {k: v.quantize(Decimal("0.01")) for k, v in result.items()}

    async def _build_response(
        self,
        tenant_id: int,
        inquiry: PurchaseInquiry,
        *,
        audit_required: Optional[bool] = None,
    ) -> PurchaseInquiryResponse:
        items, vendors, quotes = await asyncio.gather(
            PurchaseInquiryItem.filter(tenant_id=tenant_id, inquiry_id=inquiry.id).all(),
            PurchaseInquiryVendor.filter(tenant_id=tenant_id, inquiry_id=inquiry.id).all(),
            PurchaseSupplierQuote.filter(
                tenant_id=tenant_id, inquiry_id=inquiry.id, deleted_at__isnull=True
            ).all(),
        )
        quote_ids = [int(q.id) for q in quotes]
        quote_items_by_quote: Dict[int, List[Any]] = {qid: [] for qid in quote_ids}
        if quote_ids:
            all_quote_items = await PurchaseSupplierQuoteItem.filter(
                tenant_id=tenant_id, quote_id__in=quote_ids
            ).all()
            for qi in all_quote_items:
                quote_items_by_quote.setdefault(int(qi.quote_id), []).append(qi)

        quote_resps: List[PurchaseSupplierQuoteResponse] = []
        awarded_total_amount = Decimal(0)
        for q in quotes:
            q_items = quote_items_by_quote.get(int(q.id), [])
            for qi in q_items:
                if qi.is_awarded:
                    awarded_total_amount += Decimal(str(qi.quoted_quantity or 0)) * Decimal(
                        str(qi.unit_price or 0)
                    )
            quote_resps.append(
                PurchaseSupplierQuoteResponse.model_validate({
                    **{k: getattr(q, k) for k in q._meta.fields_map if hasattr(q, k)},
                    "items": [PurchaseSupplierQuoteItemResponse.model_validate(i) for i in q_items],
                })
            )
        from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_inquiry_lifecycle

        if audit_required is None:
            audit_required = await self.business_config_service.check_audit_required(
                tenant_id, "purchase_inquiry"
            )
        lifecycle = get_purchase_inquiry_lifecycle(inquiry, audit_required=audit_required)
        resp = PurchaseInquiryResponse.model_validate({
            **{k: getattr(inquiry, k) for k in inquiry._meta.fields_map if hasattr(inquiry, k)},
            "items_count": len(items),
            "total_amount": awarded_total_amount.quantize(Decimal("0.01")),
            "items": [PurchaseInquiryItemResponse.model_validate(i) for i in items],
            "vendors": [PurchaseInquiryVendorResponse.model_validate(v) for v in vendors],
            "quotes": quote_resps,
            "lifecycle": lifecycle,
        })
        return enrich_purchase_inquiry_capabilities_on_response(inquiry, resp)

    async def _build_list_responses(
        self,
        tenant_id: int,
        inquiries: List[PurchaseInquiry],
        *,
        audit_required: bool,
        include_items: bool,
    ) -> List[PurchaseInquiryResponse]:
        """列表专用：批量预取，不附带 vendors/quotes（详情接口走 _build_response）。"""
        from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_inquiry_lifecycle

        if not inquiries:
            return []

        inquiry_ids = [int(i.id) for i in inquiries]
        items_count_map, awarded_map = await asyncio.gather(
            self._batch_inquiry_items_count(tenant_id, inquiry_ids),
            self._batch_awarded_amounts(tenant_id, inquiry_ids),
        )

        items_by_inquiry: Dict[int, List[PurchaseInquiryItemResponse]] = {}
        if include_items:
            all_items = (
                await PurchaseInquiryItem.filter(
                    tenant_id=tenant_id, inquiry_id__in=inquiry_ids
                )
                .order_by("inquiry_id", "id")
                .all()
            )
            for it in all_items:
                items_by_inquiry.setdefault(int(it.inquiry_id), []).append(
                    PurchaseInquiryItemResponse.model_validate(it)
                )

        out: List[PurchaseInquiryResponse] = []
        for inquiry in inquiries:
            iid = int(inquiry.id)
            payload = {
                k: getattr(inquiry, k)
                for k in inquiry._meta.fields_map
                if hasattr(inquiry, k)
            }
            payload["items_count"] = items_count_map.get(iid, 0)
            payload["total_amount"] = awarded_map.get(iid, Decimal("0.00"))
            payload["items"] = items_by_inquiry.get(iid, []) if include_items else []
            payload["vendors"] = []
            payload["quotes"] = []
            payload["lifecycle"] = get_purchase_inquiry_lifecycle(
                inquiry, audit_required=audit_required
            )
            out.append(PurchaseInquiryResponse.model_validate(payload))
        return out

    async def get_inquiry_by_id(self, tenant_id: int, inquiry_id: int) -> PurchaseInquiryResponse:
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        resp = await self._build_response(tenant_id, inquiry)
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "purchase_inquiry", resp)

    @staticmethod
    def _resolve_list_order_by(order_by: Optional[str]) -> tuple[str, str]:
        if order_by:
            field = order_by.lstrip("-")
            if field in PURCHASE_INQUIRY_SORTABLE_FIELDS:
                descending = order_by.startswith("-")
                primary = f"-{field}" if descending else field
                secondary = "-id" if descending else "id"
                return primary, secondary
        return "-created_at", "-id"

    @staticmethod
    def _sort_inquiries_in_memory(
        rows: List[PurchaseInquiry],
        primary: str,
        secondary: str,
    ) -> List[PurchaseInquiry]:
        def field_key(field_name: str, row: PurchaseInquiry):
            val = getattr(row, field_name.lstrip("-"), None)
            if val is None:
                return (1, "")
            return (0, val)

        def sort_key(row: PurchaseInquiry):
            p_field = primary.lstrip("-")
            s_field = secondary.lstrip("-")
            return (field_key(p_field, row), field_key(s_field, row))

        reverse = primary.startswith("-")
        return sorted(rows, key=sort_key, reverse=reverse)

    async def list_inquiries(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        lifecycle_stage: Optional[str] = None,
        keyword: Optional[str] = None,
        inquiry_code: Optional[str] = None,
        inquiry_name: Optional[str] = None,
        source_code: Optional[str] = None,
        quote_deadline_from: Optional[date] = None,
        quote_deadline_to: Optional[date] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        source_id: Optional[int] = None,
        order_by: Optional[str] = None,
        include_items: bool = False,
    ) -> Dict[str, Any]:
        qs = PurchaseInquiry.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if source_id:
            qs = qs.filter(source_id=source_id, source_type="PurchaseRequisition")
        kw = (keyword or "").strip()
        if kw:
            from apps.kuaizhizao.utils.list_item_material_keyword import (
                header_ids_matching_item_material,
            )

            material_inquiry_ids = await header_ids_matching_item_material(
                tenant_id,
                PurchaseInquiryItem,
                "inquiry_id",
                kw,
            )
            qs = qs.filter(
                Q(inquiry_code__icontains=kw)
                | Q(inquiry_name__icontains=kw)
                | Q(source_code__icontains=kw)
                | Q(buyer_name__icontains=kw)
                | Q(id__in=material_inquiry_ids)
            )
        code = (inquiry_code or "").strip()
        if code:
            qs = qs.filter(inquiry_code__icontains=code)
        name = (inquiry_name or "").strip()
        if name:
            qs = qs.filter(inquiry_name__icontains=name)
        src = (source_code or "").strip()
        if src:
            qs = qs.filter(source_code__icontains=src)
        if quote_deadline_from is not None:
            qs = qs.filter(
                quote_deadline__isnull=False, quote_deadline__gte=quote_deadline_from
            )
        if quote_deadline_to is not None:
            qs = qs.filter(
                quote_deadline__isnull=False, quote_deadline__lte=quote_deadline_to
            )
        if created_start_date is not None:
            qs = qs.filter(
                created_at__gte=datetime.combine(created_start_date, time.min)
            )
        if created_end_date is not None:
            qs = qs.filter(
                created_at__lte=datetime.combine(created_end_date, time(23, 59, 59))
            )

        lifecycle_filter = (lifecycle_stage or "").strip()
        status_values = self._statuses_for_lifecycle_stage(lifecycle_filter)
        if status_values:
            qs = qs.filter(status__in=list(status_values))

        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "purchase_inquiry"
        )
        primary_order, secondary_order = self._resolve_list_order_by(order_by)

        if lifecycle_filter and not status_values:
            # 未知阶段名：回退内存筛选（不应成为常态路径）
            from apps.kuaizhizao.services.document_lifecycle_service import (
                get_purchase_inquiry_lifecycle,
                normalize_purchase_inquiry_lifecycle_stage,
            )

            candidate_rows = await qs.order_by(primary_order, secondary_order).all()
            norm_target = normalize_purchase_inquiry_lifecycle_stage(lifecycle_filter)
            matched_rows: List[PurchaseInquiry] = []
            for inquiry in candidate_rows:
                lc = get_purchase_inquiry_lifecycle(inquiry, audit_required=audit_required)
                stage_name = lc.get("current_stage_name")
                stage_key = lc.get("current_stage_key")
                if stage_name == norm_target or stage_key == lifecycle_filter:
                    matched_rows.append(inquiry)
            sorted_rows = self._sort_inquiries_in_memory(
                matched_rows, primary_order, secondary_order
            )
            total = len(sorted_rows)
            page_rows = sorted_rows[skip : skip + limit]
        else:
            total = await qs.count()
            page_rows = await qs.offset(skip).limit(limit).order_by(
                primary_order, secondary_order
            )

        out = await self._build_list_responses(
            tenant_id,
            page_rows,
            audit_required=audit_required,
            include_items=include_items,
        )
        enriched = enrich_purchase_inquiry_list_capabilities(page_rows, out)
        from core.services.approval.audit_record_enricher import enrich_items

        enriched_items = await enrich_items(tenant_id, "purchase_inquiry", enriched)
        return {
            "data": [item.model_dump() for item in enriched_items],
            "total": total,
            "success": True,
        }

    async def create_inquiry(
        self, tenant_id: int, data: PurchaseInquiryCreate, created_by: int
    ) -> PurchaseInquiryResponse:
        await self._ensure_module_enabled(tenant_id)
        async with in_transaction():
            code = data.inquiry_code
            if not code:
                code = await self._generate_inquiry_code(tenant_id)
            buyer_name_info = await self.get_user_info(created_by)
            buyer_name = buyer_name_info["name"]
            total_qty = sum((i.quantity for i in data.items), Decimal(0))
            inquiry = await PurchaseInquiry.create(
                tenant_id=tenant_id,
                inquiry_code=code,
                inquiry_name=data.inquiry_name or f"采购询价-{code}",
                inquiry_date=data.inquiry_date or date.today(),
                quote_deadline=data.quote_deadline,
                status=PurchaseInquiryStatus.DRAFT.value,
                buyer_id=created_by,
                buyer_name=buyer_name,
                source_type=data.source_type,
                source_id=data.source_id,
                source_code=data.source_code,
                total_quantity=total_qty,
                notes=data.notes,
                created_by=created_by,
                created_by_name=buyer_name_info["name"],
                updated_by=created_by,
                updated_by_name=buyer_name_info["name"],
            )
            for item in data.items:
                await PurchaseInquiryItem.create(
                    tenant_id=tenant_id,
                    inquiry_id=inquiry.id,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    unit=item.unit or "件",
                    quantity=item.quantity,
                    required_date=item.required_date,
                    source_requisition_item_id=item.source_requisition_item_id,
                    notes=item.notes,
                )
            for vendor in data.vendors:
                await PurchaseInquiryVendor.create(
                    tenant_id=tenant_id,
                    inquiry_id=inquiry.id,
                    supplier_id=vendor.supplier_id,
                    supplier_name=vendor.supplier_name,
                    status=PurchaseInquiryVendorStatus.INVITED.value,
                    notes=vendor.notes,
                )
            return await self.get_inquiry_by_id(tenant_id, inquiry.id)

    async def update_inquiry(
        self,
        tenant_id: int,
        inquiry_id: int,
        data: PurchaseInquiryUpdate,
        updated_by: int,
        approval_edit_context: Optional[Dict[str, Any]] = None,
        approval_edit_comment: Optional[str] = None,
    ) -> PurchaseInquiryResponse:
        await self._ensure_module_enabled(tenant_id)
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        is_draft = inquiry.status == PurchaseInquiryStatus.DRAFT.value
        if not is_draft:
            raise BusinessLogicError("只有草稿状态的询价单可编辑")

        from core.services.approval.approval_instance_service import ApprovalInstanceService

        pending_instance = await ApprovalInstanceService.get_instance_by_entity(
            tenant_id=tenant_id,
            entity_type="purchase_inquiry",
            entity_id=inquiry_id,
        )
        in_approval = bool(pending_instance and pending_instance.status == "pending")
        if in_approval and not approval_edit_context:
            from core.services.approval.approval_edit_guard import ApprovalEditGuard

            edit_ctx = await ApprovalEditGuard.get_pending_edit_context(
                tenant_id, "purchase_inquiry", inquiry_id, updated_by
            )
            if not edit_ctx:
                raise BusinessLogicError("单据审核中，仅已开启改单权限的当前审批人可修改")
            approval_edit_context = edit_ctx

        if approval_edit_context:
            from core.config.audit_editable_fields import is_field_editable

            node_editable = approval_edit_context.get("editable_fields")
            for field in ("inquiry_name", "inquiry_date", "quote_deadline", "notes"):
                val = getattr(data, field, None)
                if val is None:
                    continue
                if not is_field_editable("purchase_inquiry", field, node_editable):
                    raise ValidationError(f"字段「{field}」不允许在审核中修改")
            if data.items is not None and not is_field_editable("purchase_inquiry", "items", node_editable):
                raise ValidationError("字段「询价明细」不允许在审核中修改")
            if data.vendors is not None and not is_field_editable("purchase_inquiry", "vendors", node_editable):
                raise ValidationError("字段「供应商」不允许在审核中修改")

        async with in_transaction():
            user_info = await self.get_user_info(updated_by)
            update_fields = {
                "updated_by": updated_by,
                "updated_by_name": user_info["name"],
            }
            for field in ("inquiry_name", "inquiry_date", "quote_deadline", "notes"):
                val = getattr(data, field, None)
                if val is not None:
                    update_fields[field] = val
            if data.items is not None:
                await PurchaseInquiryItem.filter(tenant_id=tenant_id, inquiry_id=inquiry_id).delete()
                total_qty = Decimal(0)
                for item in data.items:
                    total_qty += item.quantity
                    await PurchaseInquiryItem.create(
                        tenant_id=tenant_id,
                        inquiry_id=inquiry_id,
                        material_id=item.material_id,
                        material_code=item.material_code,
                        material_name=item.material_name,
                        material_spec=item.material_spec,
                        unit=item.unit or "件",
                        quantity=item.quantity,
                        required_date=item.required_date,
                        source_requisition_item_id=item.source_requisition_item_id,
                        notes=item.notes,
                    )
                update_fields["total_quantity"] = total_qty
            if data.vendors is not None:
                await PurchaseInquiryVendor.filter(tenant_id=tenant_id, inquiry_id=inquiry_id).delete()
                for vendor in data.vendors:
                    await PurchaseInquiryVendor.create(
                        tenant_id=tenant_id,
                        inquiry_id=inquiry_id,
                        supplier_id=vendor.supplier_id,
                        supplier_name=vendor.supplier_name,
                        status=PurchaseInquiryVendorStatus.INVITED.value,
                        notes=vendor.notes,
                    )
            await inquiry.update_from_dict(update_fields).save()
            return await self.get_inquiry_by_id(tenant_id, inquiry_id)

    async def delete_inquiry(self, tenant_id: int, inquiry_id: int, deleted_by: int) -> None:
        await self._ensure_module_enabled(tenant_id)
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        if inquiry.status != PurchaseInquiryStatus.DRAFT.value:
            raise BusinessLogicError("只有草稿状态的询价单可删除")
        await inquiry.update_from_dict({"deleted_at": resolve_business_datetime(), "updated_by": deleted_by}).save()

    async def _recommend_supplier_ids(self, tenant_id: int, material_ids: List[int]) -> List[int]:
        ids: List[int] = []
        for mid in material_ids:
            cfg = await get_material_source_config(tenant_id, mid)
            inner = (cfg or {}).get("source_config") or {}
            sid = inner.get("default_supplier_id")
            if sid and sid not in ids:
                ids.append(int(sid))
        if not ids and material_ids:
            try:
                cmp_resp = await self.purchase_service.get_price_comparison(tenant_id, material_ids[:5])
                for row in cmp_resp.results or []:
                    for c in row.comparison or []:
                        if c.supplier_id and c.supplier_id not in ids:
                            ids.append(c.supplier_id)
            except Exception as e:
                logger.debug("询价推荐供应商失败: %s", e)
        return ids[:5]

    async def create_from_requisition(
        self,
        tenant_id: int,
        requisition_id: int,
        data: CreateFromRequisitionRequest,
        created_by: int,
    ) -> PurchaseInquiryResponse:
        await self._ensure_module_enabled(tenant_id)
        req = await PurchaseRequisition.get_or_none(
            tenant_id=tenant_id, id=requisition_id, deleted_at__isnull=True
        )
        if not req:
            raise NotFoundError(f"采购申请不存在: {requisition_id}")
        assert_purchase_requisition_capability(req, "push_inquiry")

        pr_items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id,
            requisition_id=requisition_id,
            id__in=data.item_ids,
            purchase_order_id__isnull=True,
        ).all()
        if not pr_items:
            raise BusinessLogicError("没有可询价的申请行")

        await self._assert_requisition_items_not_in_active_inquiry(tenant_id, [i.id for i in pr_items])

        supplier_ids = data.supplier_ids or []
        if not supplier_ids:
            supplier_ids = await self._recommend_supplier_ids(
                tenant_id, [i.material_id for i in pr_items]
            )
        suppliers = await Supplier.filter(tenant_id=tenant_id, id__in=supplier_ids).all() if supplier_ids else []
        vendor_payload = [{"supplier_id": s.id, "supplier_name": s.name} for s in suppliers]

        from apps.kuaizhizao.schemas.purchase_inquiry import PurchaseInquiryItemCreate, PurchaseInquiryVendorCreate

        create_data = PurchaseInquiryCreate(
            inquiry_name=data.inquiry_name or f"询价-{req.requisition_code}",
            quote_deadline=data.quote_deadline,
            source_type="PurchaseRequisition",
            source_id=requisition_id,
            source_code=req.requisition_code,
            notes=data.notes,
            items=[
                PurchaseInquiryItemCreate(
                    material_id=i.material_id,
                    material_code=i.material_code,
                    material_name=i.material_name,
                    material_spec=i.material_spec,
                    unit=i.unit or "件",
                    quantity=i.quantity,
                    required_date=i.required_date,
                    source_requisition_item_id=i.id,
                    notes=i.notes,
                )
                for i in pr_items
            ],
            vendors=[PurchaseInquiryVendorCreate(**v) for v in vendor_payload],
        )
        inquiry = await self.create_inquiry(tenant_id, create_data, created_by)
        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            await DocumentRelationNewService().create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="purchase_requisition",
                    source_id=requisition_id,
                    source_code=req.requisition_code,
                    source_name=req.requisition_name or req.requisition_code,
                    target_type="purchase_inquiry",
                    target_id=inquiry.id,
                    target_code=inquiry.inquiry_code,
                    target_name=inquiry.inquiry_name or inquiry.inquiry_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="采购申请下推询价单",
                ),
                created_by=created_by,
            )
        except Exception as e:
            logger.warning("创建采购申请→询价单 单据关联失败: %s", e)
        return inquiry

    @staticmethod
    async def _assert_requisition_items_not_in_active_inquiry(
        tenant_id: int, requisition_item_ids: List[int]
    ) -> None:
        if not requisition_item_ids:
            return
        active_items = await PurchaseInquiryItem.filter(
            tenant_id=tenant_id,
            source_requisition_item_id__in=requisition_item_ids,
            purchase_order_id__isnull=True,
        ).all()
        if not active_items:
            return
        inquiry_ids = {i.inquiry_id for i in active_items}
        active_inquiries = await PurchaseInquiry.filter(
            tenant_id=tenant_id,
            id__in=list(inquiry_ids),
            deleted_at__isnull=True,
            status__in=list(INQUIRY_ACTIVE_STATUSES),
        ).all()
        if active_inquiries:
            codes = ", ".join(i.inquiry_code for i in active_inquiries)
            raise BusinessLogicError(f"所选采购申请行已在进行中的询价单（{codes}），不可重复下推或直转采购订单")

    async def publish_inquiry(self, tenant_id: int, inquiry_id: int, user_id: int) -> PurchaseInquiryResponse:
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        if inquiry.status != PurchaseInquiryStatus.DRAFT.value:
            raise BusinessLogicError("只有草稿状态的询价单可发布")
        items = await PurchaseInquiryItem.filter(tenant_id=tenant_id, inquiry_id=inquiry_id).count()
        vendors = await PurchaseInquiryVendor.filter(tenant_id=tenant_id, inquiry_id=inquiry_id).count()
        if items == 0:
            raise BusinessLogicError("询价单无明细，无法发布")
        if vendors == 0:
            raise BusinessLogicError("请至少邀请一家供应商")
        audit_required = await self.business_config_service.check_audit_required(tenant_id, "purchase_inquiry")
        if audit_required and inquiry.review_status != ReviewStatus.APPROVED.value:
            raise BusinessLogicError("询价单需审核通过后方可发布")
        await inquiry.update_from_dict({
            "status": PurchaseInquiryStatus.QUOTING.value,
            "updated_by": user_id,
            "updated_by_name": (await self.get_user_info(user_id))["name"],
        }).save()
        return await self.get_inquiry_by_id(tenant_id, inquiry_id)

    async def close_quoting(self, tenant_id: int, inquiry_id: int, user_id: int) -> PurchaseInquiryResponse:
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        if inquiry.status != PurchaseInquiryStatus.QUOTING.value:
            raise BusinessLogicError("只有询价中状态的询价单可截止")
        await inquiry.update_from_dict({
            "status": PurchaseInquiryStatus.PENDING_COMPARE.value,
            "updated_by": user_id,
            "updated_by_name": (await self.get_user_info(user_id))["name"],
        }).save()
        return await self.get_inquiry_by_id(tenant_id, inquiry_id)

    async def upsert_supplier_quote(
        self,
        tenant_id: int,
        inquiry_id: int,
        data: UpsertSupplierQuoteRequest,
        user_id: int,
    ) -> PurchaseSupplierQuoteResponse:
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        if inquiry.status not in (
            PurchaseInquiryStatus.QUOTING.value,
            PurchaseInquiryStatus.PENDING_COMPARE.value,
        ):
            raise BusinessLogicError("当前状态不可录入报价")
        vendor = await PurchaseInquiryVendor.get_or_none(
            tenant_id=tenant_id, inquiry_id=inquiry_id, supplier_id=data.supplier_id
        )
        if not vendor:
            raise BusinessLogicError("该供应商不在受邀列表中")
        supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=data.supplier_id)
        supplier_name = data.supplier_name or (supplier.name if supplier else vendor.supplier_name)

        async with in_transaction():
            quote = await PurchaseSupplierQuote.get_or_none(
                tenant_id=tenant_id,
                inquiry_id=inquiry_id,
                supplier_id=data.supplier_id,
                deleted_at__isnull=True,
            )
            if not quote:
                quote = await PurchaseSupplierQuote.create(
                    tenant_id=tenant_id,
                    inquiry_id=inquiry_id,
                    supplier_id=data.supplier_id,
                    supplier_name=supplier_name,
                    quote_date=data.quote_date or date.today(),
                    valid_until=data.valid_until,
                    status=PurchaseSupplierQuoteStatus.SUBMITTED.value,
                    submission_channel=PurchaseSupplierQuoteChannel.INTERNAL.value,
                    entered_by=user_id,
                    notes=data.notes,
                    created_by=user_id,
                    updated_by=user_id,
                )
            else:
                await quote.update_from_dict({
                    "supplier_name": supplier_name,
                    "quote_date": data.quote_date or quote.quote_date or date.today(),
                    "valid_until": data.valid_until,
                    "status": PurchaseSupplierQuoteStatus.SUBMITTED.value,
                    "notes": data.notes,
                    "updated_by": user_id,
                }).save()

            await PurchaseSupplierQuoteItem.filter(tenant_id=tenant_id, quote_id=quote.id).delete()
            total_amount = Decimal(0)
            inquiry_item_ids = {i.id for i in await PurchaseInquiryItem.filter(tenant_id=tenant_id, inquiry_id=inquiry_id).all()}
            for row in data.items:
                if row.inquiry_item_id not in inquiry_item_ids:
                    raise BusinessLogicError(f"询价明细不存在: {row.inquiry_item_id}")
                line_amount = (row.quoted_quantity or Decimal(0)) * (row.unit_price or Decimal(0))
                total_amount += line_amount
                await PurchaseSupplierQuoteItem.create(
                    tenant_id=tenant_id,
                    quote_id=quote.id,
                    inquiry_item_id=row.inquiry_item_id,
                    quoted_quantity=row.quoted_quantity or Decimal(0),
                    unit_price=row.unit_price or Decimal(0),
                    delivery_date=row.delivery_date,
                    lead_time_days=row.lead_time_days,
                    notes=row.notes,
                )
            await quote.update_from_dict({"total_amount": total_amount.quantize(Decimal("0.01"))}).save()
            await vendor.update_from_dict({
                "status": PurchaseInquiryVendorStatus.QUOTED.value,
                "quoted_at": resolve_business_datetime(),
            }).save()

        q_items = await PurchaseSupplierQuoteItem.filter(tenant_id=tenant_id, quote_id=quote.id).all()
        return PurchaseSupplierQuoteResponse.model_validate({
            **{k: getattr(quote, k) for k in quote._meta.fields_map if hasattr(quote, k)},
            "items": [PurchaseSupplierQuoteItemResponse.model_validate(i) for i in q_items],
        })

    async def get_comparison_matrix(self, tenant_id: int, inquiry_id: int) -> ComparisonMatrixResponse:
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        items, vendors, quotes = await asyncio.gather(
            PurchaseInquiryItem.filter(tenant_id=tenant_id, inquiry_id=inquiry_id).all(),
            PurchaseInquiryVendor.filter(tenant_id=tenant_id, inquiry_id=inquiry_id).all(),
            PurchaseSupplierQuote.filter(
                tenant_id=tenant_id, inquiry_id=inquiry_id, deleted_at__isnull=True
            ).all(),
        )
        quote_by_supplier = {q.supplier_id: q for q in quotes}
        quote_ids = [int(q.id) for q in quotes]
        quote_item_map: Dict[Tuple[int, int], Any] = {}
        if quote_ids:
            all_quote_items = await PurchaseSupplierQuoteItem.filter(
                tenant_id=tenant_id, quote_id__in=quote_ids
            ).all()
            for qi in all_quote_items:
                quote_item_map[(int(qi.quote_id), int(qi.inquiry_item_id))] = qi
        rows: List[ComparisonRow] = []
        for item in items:
            cells: List[ComparisonCell] = []
            prices: List[Decimal] = []
            for vendor in vendors:
                quote = quote_by_supplier.get(vendor.supplier_id)
                qi = (
                    quote_item_map.get((int(quote.id), int(item.id)))
                    if quote
                    else None
                )
                price = qi.unit_price if qi else None
                if price is not None and price > 0:
                    prices.append(price)
                cells.append(ComparisonCell(
                    quote_item_id=qi.id if qi else None,
                    quote_id=quote.id if quote else None,
                    supplier_id=vendor.supplier_id,
                    supplier_name=vendor.supplier_name,
                    unit_price=price,
                    quoted_quantity=qi.quoted_quantity if qi else None,
                    delivery_date=qi.delivery_date if qi else None,
                    lead_time_days=qi.lead_time_days if qi else None,
                    is_awarded=bool(qi and qi.is_awarded),
                ))
            min_price = min(prices) if prices else None
            for cell in cells:
                if min_price is not None and cell.unit_price == min_price:
                    cell.is_lowest_price = True
            rows.append(ComparisonRow(
                inquiry_item_id=item.id,
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                quantity=item.quantity,
                required_date=item.required_date,
                cells=cells,
            ))
        return ComparisonMatrixResponse(
            inquiry_id=inquiry_id,
            suppliers=[PurchaseInquiryVendorResponse.model_validate(v) for v in vendors],
            rows=rows,
        )

    async def award_quotes(
        self, tenant_id: int, inquiry_id: int, data: AwardQuotesRequest, user_id: int
    ) -> PurchaseInquiryResponse:
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        if inquiry.status not in (
            PurchaseInquiryStatus.PENDING_COMPARE.value,
            PurchaseInquiryStatus.QUOTING.value,
        ):
            raise BusinessLogicError("当前状态不可定标")
        async with in_transaction():
            quote_ids = await PurchaseSupplierQuote.filter(
                tenant_id=tenant_id, inquiry_id=inquiry_id, deleted_at__isnull=True
            ).values_list("id", flat=True)
            if quote_ids:
                await PurchaseSupplierQuoteItem.filter(
                    tenant_id=tenant_id, quote_id__in=quote_ids
                ).update(is_awarded=False)
            for award in data.awards:
                qi = await PurchaseSupplierQuoteItem.get_or_none(
                    tenant_id=tenant_id, id=award["quote_item_id"]
                )
                if not qi:
                    raise NotFoundError(f"报价行不存在: {award['quote_item_id']}")
                quote = await PurchaseSupplierQuote.get_or_none(tenant_id=tenant_id, id=qi.quote_id)
                if not quote or quote.inquiry_id != inquiry_id:
                    raise BusinessLogicError("报价行不属于当前询价单")
                inq_item = await PurchaseInquiryItem.get_or_none(
                    tenant_id=tenant_id, id=award["inquiry_item_id"], inquiry_id=inquiry_id
                )
                if not inq_item:
                    raise NotFoundError(f"询价明细不存在: {award['inquiry_item_id']}")
                if qi.inquiry_item_id != inq_item.id:
                    raise BusinessLogicError("报价行与询价明细不匹配")
                await qi.update_from_dict({"is_awarded": True}).save()
                await inq_item.update_from_dict({
                    "awarded_supplier_id": quote.supplier_id,
                    "awarded_quote_item_id": qi.id,
                }).save()
            await inquiry.update_from_dict({
                "status": PurchaseInquiryStatus.AWARDED.value,
                "updated_by": user_id,
                "updated_by_name": (await self.get_user_info(user_id))["name"],
            }).save()
        return await self.get_inquiry_by_id(tenant_id, inquiry_id)

    async def preview_push_to_purchase_order(
        self,
        tenant_id: int,
        inquiry_id: int,
    ) -> Dict[str, Any]:
        """下推采购订单预览：返回已定标且可转单的询价明细及数量门禁，不实际创建。"""
        from apps.kuaizhizao.models import PurchaseOrder, PurchaseOrderItem

        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        assert_purchase_inquiry_capability(inquiry, "push_purchase_order")

        items = await PurchaseInquiryItem.filter(
            tenant_id=tenant_id, inquiry_id=inquiry_id
        ).all()
        item_ids = [int(i.id) for i in items if i.id is not None]

        po_items_back = (
            await PurchaseOrderItem.filter(
                tenant_id=tenant_id,
                source_type="PurchaseInquiry",
                source_id__in=item_ids,
            ).all()
            if item_ids
            else []
        )
        po_item_by_source: Dict[int, PurchaseOrderItem] = {
            int(p.source_id): p for p in po_items_back if p.source_id is not None
        }

        preview_items: List[Dict[str, Any]] = []
        for item in items:
            if not item.awarded_supplier_id or not item.awarded_quote_item_id:
                continue

            linked_po_id = item.purchase_order_id
            linked_po_item_id = item.purchase_order_item_id
            po = (
                await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=linked_po_id)
                if linked_po_id
                else None
            )
            po_item = (
                await PurchaseOrderItem.get_or_none(
                    tenant_id=tenant_id, id=linked_po_item_id
                )
                if linked_po_item_id and po
                else None
            )
            back_po_item = po_item_by_source.get(int(item.id)) if item.id is not None else None
            if not po_item and back_po_item:
                po_item = back_po_item
                po = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=back_po_item.order_id)
                await item.update_from_dict({
                    "purchase_order_id": po.id if po else None,
                    "purchase_order_item_id": back_po_item.id,
                }).save()
                linked_po_id = po.id if po else None
            elif linked_po_id and (not po or not po_item):
                await item.update_from_dict({
                    "purchase_order_id": None,
                    "purchase_order_item_id": None,
                }).save()
                linked_po_id = None
                po_item = None

            quote_item = await PurchaseSupplierQuoteItem.get_or_none(
                tenant_id=tenant_id, id=item.awarded_quote_item_id
            )
            qty = float(
                quote_item.quoted_quantity
                if quote_item and quote_item.quoted_quantity
                else (item.quantity or 0)
            )
            if qty <= 0:
                continue

            pushed = 0.0
            if linked_po_id and po_item:
                pushed = float(po_item.ordered_quantity or qty)

            max_push = 0.0 if (linked_po_id and po_item) else qty
            if max_push <= 0 and pushed <= 0:
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
                    "awarded_supplier_id": item.awarded_supplier_id,
                    "required_date": str(item.required_date) if item.required_date else None,
                }
            )

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        has_blocking = pushable_count == 0
        return {
            "target_type": "purchase_order",
            "inquiry_id": inquiry_id,
            "inquiry_code": inquiry.inquiry_code,
            "summary": (
                f"请选择本次要下推的已定标询价明细（{pushable_count}/{len(preview_items)} 行可下推）"
                if not has_blocking
                else "当前询价单无可下推明细"
            ),
            "items": preview_items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": (
                "purchase_inquiry.push_purchase_order.no_lines" if has_blocking else None
            ),
            "tip": "系统将按定标供应商与报价数量自动生成采购订单，并按供应商拆单。",
        }

    async def convert_to_purchase_order(
        self,
        tenant_id: int,
        inquiry_id: int,
        data: ConvertInquiryToPORequest,
        created_by: int,
    ) -> Dict[str, Any]:
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        assert_purchase_inquiry_capability(inquiry, "push_purchase_order")

        qs = PurchaseInquiryItem.filter(
            tenant_id=tenant_id,
            inquiry_id=inquiry_id,
            purchase_order_id__isnull=True,
            awarded_supplier_id__not_isnull=True,
        )
        if data.item_ids:
            qs = qs.filter(id__in=data.item_ids)
        items = await qs.all()
        if not items:
            raise BusinessLogicError("没有可转单的已定标询价行")

        groups: Dict[int, List[PurchaseInquiryItem]] = {}
        for item in items:
            groups.setdefault(item.awarded_supplier_id, []).append(item)

        supplier_rows = await Supplier.filter(
            tenant_id=tenant_id, id__in=list(groups.keys())
        ).all()
        supplier_by_id = {s.id: s for s in supplier_rows}
        today = date.today()
        purchase_orders_out: List[Dict[str, Any]] = []
        push_mode = await BusinessConfigService().get_push_default_mode(tenant_id)
        push_as_confirm = push_mode == "confirm"

        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            rel_svc = DocumentRelationNewService()
        except Exception:
            rel_svc = None

        for supplier_id, group_items in groups.items():
            sup = supplier_by_id.get(supplier_id)
            if not sup:
                raise NotFoundError(f"供应商不存在: {supplier_id}")
            max_required = max((i.required_date or today for i in group_items), default=today)
            po_items: List[PurchaseOrderItemCreate] = []
            items_converted: List[Tuple[PurchaseInquiryItem, PurchaseSupplierQuoteItem]] = []

            for item in group_items:
                quote_item = await PurchaseSupplierQuoteItem.get_or_none(
                    tenant_id=tenant_id, id=item.awarded_quote_item_id
                )
                unit_price = quote_item.unit_price if quote_item else Decimal(0)
                qty = quote_item.quoted_quantity if quote_item and quote_item.quoted_quantity else item.quantity
                delivery = quote_item.delivery_date if quote_item else item.required_date
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
                        required_date=delivery or max_required,
                        source_type="PurchaseInquiry",
                        source_id=item.id,
                        notes=item.notes,
                    )
                )
                items_converted.append((item, quote_item))

            po_data = PurchaseOrderCreate(
                supplier_id=supplier_id,
                supplier_name=sup.name,
                order_date=today,
                delivery_date=max_required,
                order_type="标准采购",
                status=DocumentStatus.DRAFT.value,
                source_type="PurchaseInquiry",
                source_id=inquiry_id,
                notes=f"由询价单{inquiry.inquiry_code}转单生成",
                items=po_items,
            )
            po = await self.purchase_service.create_purchase_order(
                tenant_id=tenant_id, order_data=po_data, created_by=created_by
            )
            # 与业务自动化「下推默认生成方式」一致：confirm 才自动提交，draft 保持草稿
            if push_as_confirm:
                try:
                    po = await self.purchase_service.submit_purchase_order(
                        tenant_id=tenant_id, order_id=po.id, submitted_by=created_by
                    )
                except Exception as e:
                    logger.warning(
                        "询价转单后自动提交采购订单失败: inquiry_id={} po_id={} err={}",
                        inquiry_id,
                        po.id,
                        e,
                    )

            for i, (item, _) in enumerate(items_converted):
                po_item = po.items[i] if i < len(po.items) else None
                po_item_id = getattr(po_item, "id", None) if po_item else None
                await item.update_from_dict({
                    "purchase_order_id": po.id,
                    "purchase_order_item_id": po_item_id,
                }).save()
                if item.source_requisition_item_id:
                    pr_item = await PurchaseRequisitionItem.get_or_none(
                        tenant_id=tenant_id, id=item.source_requisition_item_id
                    )
                    if pr_item and not pr_item.purchase_order_id:
                        await pr_item.update_from_dict({
                            "purchase_order_id": po.id,
                            "purchase_order_item_id": po_item_id,
                            "supplier_id": supplier_id,
                        }).save()

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
                            source_type="purchase_inquiry",
                            source_id=inquiry_id,
                            source_code=inquiry.inquiry_code,
                            source_name=inquiry.inquiry_name or inquiry.inquiry_code,
                            target_type="purchase_order",
                            target_id=po.id,
                            target_code=po_code,
                            target_name=po_code,
                            relation_type="source",
                            relation_mode="push",
                            relation_desc="询价单转采购订单",
                        ),
                        created_by=created_by,
                    )
                except Exception as e:
                    logger.warning("创建询价单→采购订单 单据关联失败: %s", e)

        remaining = await PurchaseInquiryItem.filter(
            tenant_id=tenant_id, inquiry_id=inquiry_id, purchase_order_id__isnull=True
        ).count()
        new_status = PurchaseInquiryStatus.CONVERTED.value if remaining == 0 else PurchaseInquiryStatus.AWARDED.value
        user_info = await self.get_user_info(created_by)
        await inquiry.update_from_dict({
            "status": new_status,
            "updated_by": created_by,
            "updated_by_name": user_info["name"],
        }).save()

        return {"purchase_orders": purchase_orders_out, "inquiry_id": inquiry_id}

    async def submit_inquiry(self, tenant_id: int, inquiry_id: int, user_id: int) -> PurchaseInquiryResponse:
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        assert_purchase_inquiry_capability(inquiry, "submit")
        audit_required = await self.business_config_service.check_audit_required(tenant_id, "purchase_inquiry")
        user_info = await self.get_user_info(user_id)
        if not audit_required:
            await inquiry.update_from_dict({
                "review_status": ReviewStatus.APPROVED.value,
                "updated_by": user_id,
                "updated_by_name": user_info["name"],
            }).save()
        else:
            await inquiry.update_from_dict({
                "review_status": DocumentStatus.PENDING_REVIEW.value,
                "updated_by": user_id,
                "updated_by_name": user_info["name"],
            }).save()
        return await self.get_inquiry_by_id(tenant_id, inquiry_id)

    async def withdraw_inquiry(
        self, tenant_id: int, inquiry_id: int, user_id: int
    ) -> PurchaseInquiryResponse:
        """撤回提交：草稿 + 待审核 → 草稿（重置审核状态，非反审核）"""
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        assert_purchase_inquiry_capability(inquiry, "withdraw_submit")

        try:
            from core.services.approval.approval_instance_service import ApprovalInstanceService

            await ApprovalInstanceService.cancel_approval(
                tenant_id=tenant_id,
                entity_type="purchase_inquiry",
                entity_id=inquiry_id,
                operator_id=user_id,
            )
        except Exception as e:
            logger.warning("取消询价单审批流程失败或无需取消: {}", e)

        await inquiry.update_from_dict({
            "review_status": ReviewStatus.PENDING.value,
            "reviewer_id": None,
            "reviewer_name": None,
            "review_time": None,
            "review_remarks": None,
            "updated_by": user_id,
            "updated_by_name": (await self.get_user_info(user_id))["name"],
        }).save()
        return await self.get_inquiry_by_id(tenant_id, inquiry_id)

    async def approve_inquiry(
        self, tenant_id: int, inquiry_id: int, approved: bool, user_id: int, remarks: Optional[str] = None
    ) -> PurchaseInquiryResponse:
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        assert_purchase_inquiry_capability(inquiry, "approve")
        user_info = await self.get_user_info(user_id)
        reviewer_name = user_info["name"]
        await inquiry.update_from_dict({
            "review_status": ReviewStatus.APPROVED.value if approved else ReviewStatus.REJECTED.value,
            "reviewer_id": user_id,
            "reviewer_name": reviewer_name,
            "review_time": resolve_business_datetime(),
            "review_remarks": remarks,
            "updated_by": user_id,
            "updated_by_name": user_info["name"],
        }).save()
        return await self.get_inquiry_by_id(tenant_id, inquiry_id)

    async def withdraw_approval(self, tenant_id: int, inquiry_id: int, user_id: int) -> PurchaseInquiryResponse:
        from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
        from core.services.approval.audit_transition import resolve_revoke_landing_phase

        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")
        assert_purchase_inquiry_capability(inquiry, "revoke_approval")
        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "purchase_inquiry"
        )
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
        review_status = (
            DocumentStatus.PENDING_REVIEW.value
            if landing == "pending"
            else ""
        )
        await inquiry.update_from_dict({
            "review_status": review_status,
            "reviewer_id": None,
            "reviewer_name": None,
            "review_time": None,
            "review_remarks": None,
            "updated_by": user_id,
            "updated_by_name": (await self.get_user_info(user_id))["name"],
        }).save()
        return await self.get_inquiry_by_id(tenant_id, inquiry_id)

    async def cancel_inquiry(
        self,
        tenant_id: int,
        inquiry_id: int,
        user_id: int,
        reason: Optional[str] = None,
    ) -> PurchaseInquiryResponse:
        """取消询价：未转采购订单的进行中询价可终止。"""
        await self._ensure_module_enabled(tenant_id)
        inquiry = await PurchaseInquiry.get_or_none(
            tenant_id=tenant_id, id=inquiry_id, deleted_at__isnull=True
        )
        if not inquiry:
            raise NotFoundError(f"询价单不存在: {inquiry_id}")

        st = str(inquiry.status or "").strip()
        if st in (
            PurchaseInquiryStatus.CANCELLED.value,
            "已取消",
            "cancelled",
        ):
            raise BusinessLogicError("询价单已取消")
        if st in (
            PurchaseInquiryStatus.CONVERTED.value,
            "已转单",
        ):
            raise BusinessLogicError("已转采购订单的询价单不可取消")

        linked = await PurchaseInquiryItem.filter(
            tenant_id=tenant_id,
            inquiry_id=inquiry_id,
            purchase_order_id__isnull=False,
        ).exists()
        if linked:
            raise BusinessLogicError("已关联采购订单的询价单不可取消")

        user_info = await self.get_user_info(user_id)
        notes = (inquiry.notes or "").strip()
        cancel_reason = (reason or "取消询价，不再转单").strip()
        prefix = f"[取消] {cancel_reason}"
        await inquiry.update_from_dict(
            {
                "status": PurchaseInquiryStatus.CANCELLED.value,
                "notes": f"{prefix}\n{notes}".strip() if notes else prefix,
                "updated_by": user_id,
                "updated_by_name": user_info["name"],
            }
        ).save()
        return await self.get_inquiry_by_id(tenant_id, inquiry_id)
