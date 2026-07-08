"""采购变更单服务"""

from datetime import datetime, date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, is_draft_status, normalize_status
from apps.kuaizhizao.constants.order_change import OrderChangeApplyStatus, OrderChangeLineType
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderChange
from apps.kuaizhizao.models.purchase_order_change_order import PurchaseOrderChangeOrder, PurchaseOrderChangeItem
from apps.kuaizhizao.schemas.order_change import (
    ApproveChangeRequest,
    ChangeImpactPreviewResponse,
    OrderChangeItemCreate,
    OrderChangeItemResponse,
    PurchaseOrderChangeCreate,
    PurchaseOrderChangeListResponse,
    PurchaseOrderChangeUpdate,
    PurchaseOrderChangeWithItemsResponse,
)
from apps.kuaizhizao.services.document_lifecycle_service import get_purchase_order_change_lifecycle
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_purchase_order_change_capabilities_on_response,
)
from apps.kuaizhizao.services.document_action_policy.purchase_order_change import (
    assert_purchase_order_change_capability,
)
from apps.kuaizhizao.services.document_action_policy.purchase_order import (
    assert_purchase_order_capability,
    derive_purchase_order_capabilities,
)
from apps.kuaizhizao.services.order_change.helpers import (
    infer_change_category,
    is_source_order_locked_for_direct_edit,
    line_amount,
    resolve_purchase_line_change,
)
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.services.business_config_service import BusinessConfigService

PURCHASE_ORDER_CHANGE_SORTABLE_FIELDS = frozenset({
    "change_code",
    "source_order_code",
    "change_version",
    "change_category",
    "supplier_name",
    "delta_amount",
    "status",
    "review_status",
    "applied_at",
    "created_at",
    "updated_at",
})


class PurchaseOrderChangeService(AppBaseService[PurchaseOrderChangeOrder]):
    def __init__(self):
        super().__init__(PurchaseOrderChangeOrder)
        self.business_config_service = BusinessConfigService()

    async def _generate_code(self, tenant_id: int) -> str:
        return await self.generate_code(tenant_id, "PURCHASE_ORDER_CHANGE_CODE", prefix="POC")

    async def _has_change_content(self, tenant_id: int, doc: PurchaseOrderChangeOrder) -> bool:
        items = await PurchaseOrderChangeItem.filter(tenant_id=tenant_id, change_order_id=doc.id).all()
        if Decimal(str(doc.delta_amount or 0)) != 0:
            return True
        if doc.header_changes:
            return True
        for i in items:
            if i.change_type in (OrderChangeLineType.LINE_ADD.value, OrderChangeLineType.LINE_CANCEL.value):
                return True
            if Decimal(str(i.delta_amount or 0)) != 0:
                return True
        return False

    async def _next_version(self, tenant_id: int, source_order_id: int) -> int:
        count = await PurchaseOrderChangeOrder.filter(
            tenant_id=tenant_id,
            source_order_id=source_order_id,
            deleted_at__isnull=True,
            status=OrderChangeApplyStatus.APPLIED.value,
        ).count()
        pending = await PurchaseOrderChangeOrder.filter(
            tenant_id=tenant_id,
            source_order_id=source_order_id,
            deleted_at__isnull=True,
            status__in=[DocumentStatus.DRAFT.value, DocumentStatus.PENDING_REVIEW.value, DocumentStatus.AUDITED.value],
        ).count()
        if pending:
            raise BusinessLogicError("该采购订单存在未完成的变更单，请先处理后再创建")
        return count + 1

    def _item_to_response(self, item: PurchaseOrderChangeItem) -> OrderChangeItemResponse:
        return OrderChangeItemResponse(
            id=item.id,
            change_order_id=item.change_order_id,
            line_no=item.line_no,
            source_item_id=item.source_item_id,
            change_type=item.change_type,
            material_id=item.material_id,
            material_code=item.material_code,
            material_name=item.material_name,
            material_spec=item.material_spec,
            material_unit=item.material_unit,
            before_quantity=item.before_quantity,
            after_quantity=item.after_quantity,
            before_unit_price=item.before_unit_price,
            after_unit_price=item.after_unit_price,
            before_delivery_date=item.before_delivery_date,
            after_delivery_date=item.after_delivery_date,
            before_amount=item.before_amount,
            after_amount=item.after_amount,
            delta_amount=item.delta_amount,
            notes=item.notes,
        )

    async def _to_detail(self, doc: PurchaseOrderChangeOrder) -> PurchaseOrderChangeWithItemsResponse:
        items = await PurchaseOrderChangeItem.filter(tenant_id=doc.tenant_id, change_order_id=doc.id).order_by("line_no")
        lifecycle = get_purchase_order_change_lifecycle(doc.status, doc.review_status, doc.applied_at)
        has_content = await self._has_change_content(doc.tenant_id, doc)
        resp = PurchaseOrderChangeWithItemsResponse(
            id=doc.id,
            change_code=doc.change_code,
            source_order_id=doc.source_order_id,
            source_order_code=doc.source_order_code,
            change_version=doc.change_version,
            supplier_id=doc.supplier_id,
            supplier_name=doc.supplier_name,
            change_category=doc.change_category,
            change_reason=doc.change_reason,
            status=doc.status,
            review_status=doc.review_status,
            before_total_quantity=doc.before_total_quantity,
            after_total_quantity=doc.after_total_quantity,
            before_total_amount=doc.before_total_amount,
            after_total_amount=doc.after_total_amount,
            delta_amount=doc.delta_amount,
            applied_at=doc.applied_at,
            created_at=doc.created_at,
            header_changes=doc.header_changes,
            attachments=doc.attachments,
            notes=doc.notes,
            reviewer_name=doc.reviewer_name,
            review_time=doc.review_time,
            review_remarks=doc.review_remarks,
            lifecycle=lifecycle,
            items=[self._item_to_response(i) for i in items],
        )
        return enrich_purchase_order_change_capabilities_on_response(
            doc, resp, has_change_content=has_content
        )

    async def _validate_source_order(self, tenant_id: int, order_id: int) -> PurchaseOrder:
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")
        if not is_source_order_locked_for_direct_edit(order.status, order.review_status):
            raise BusinessLogicError("仅已确认或执行中的采购订单可创建变更单")
        return order

    async def _has_pending_change(self, tenant_id: int, order_id: int) -> bool:
        pending = await PurchaseOrderChangeOrder.filter(
            tenant_id=tenant_id,
            source_order_id=order_id,
            deleted_at__isnull=True,
            status__in=[
                DocumentStatus.DRAFT.value,
                DocumentStatus.PENDING_REVIEW.value,
                DocumentStatus.AUDITED.value,
            ],
        ).count()
        return pending > 0

    async def preview_from_order(self, tenant_id: int, order_id: int) -> Dict[str, Any]:
        """从采购订单拉取创建变更单预览（不实际创建）。"""
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        source_items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order.id).order_by("id").all()
        has_items = len(source_items) > 0
        has_pending_change = await self._has_pending_change(tenant_id, order_id)
        caps = derive_purchase_order_capabilities(
            order,
            has_items=has_items,
            has_pending_change=has_pending_change,
        )
        create_cap = caps.create_change_order

        preview_items: List[Dict[str, Any]] = []
        for item in source_items:
            if item.id is None:
                continue
            qty = float(item.ordered_quantity or 0)
            received = float(item.received_quantity or 0)
            preview_items.append(
                {
                    "item_id": int(item.id),
                    "material_id": item.material_id,
                    "material_code": item.material_code,
                    "material_name": item.material_name,
                    "material_spec": item.material_spec,
                    "unit": item.unit,
                    "quantity": qty,
                    "pushed_quantity": received,
                    "max_push_quantity": qty,
                    "required_date": str(item.required_date) if item.required_date else None,
                }
            )

        has_blocking = not create_cap.allowed or not preview_items
        blocking_reason = create_cap.reason if not create_cap.allowed else (
            "purchase_order.create_change.no_items" if not preview_items else None
        )
        return {
            "target_type": "purchase_order_change",
            "order_id": order.id,
            "order_code": order.order_code,
            "summary": (
                f"将从采购单 {order.order_code} 生成变更单草稿，共 {len(preview_items)} 条明细"
                if preview_items
                else f"采购单 {order.order_code} 无可创建变更单的明细"
            ),
            "items": preview_items,
            "has_blocking_issues": has_blocking,
            "blocking_reason": blocking_reason,
            "tip": "确认后将创建草稿变更单，可在编辑页修改变更内容后提交。",
        }

    async def _build_items_from_payload(
        self,
        tenant_id: int,
        order: PurchaseOrder,
        items: List[OrderChangeItemCreate],
    ):
        source_items = {
            int(i.id): i
            for i in await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order.id).all()
        }
        before_qty = Decimal("0")
        before_amt = Decimal("0")
        after_qty = Decimal("0")
        after_amt = Decimal("0")
        line_types: list[str] = []
        rows: list[dict] = []

        for idx, payload in enumerate(items, start=1):
            if payload.change_type == OrderChangeLineType.LINE_ADD.value:
                if not payload.material_id:
                    raise BusinessLogicError("新增行必须选择物料")
                change_type, diff = resolve_purchase_line_change(None, payload)
                b_amt = Decimal("0")
                a_amt = line_amount(diff["after_quantity"], diff["after_unit_price"])
                after_qty += diff["after_quantity"]
                after_amt += a_amt
                line_types.append(change_type)
                rows.append({
                    "line_no": payload.line_no or idx,
                    "source_item_id": None,
                    "change_type": change_type,
                    "material_id": payload.material_id,
                    "material_code": payload.material_code,
                    "material_name": payload.material_name,
                    "material_spec": payload.material_spec,
                    "material_unit": payload.material_unit,
                    "before_quantity": diff["before_quantity"],
                    "after_quantity": diff["after_quantity"],
                    "before_unit_price": diff["before_unit_price"],
                    "after_unit_price": diff["after_unit_price"],
                    "before_delivery_date": diff["before_delivery_date"],
                    "after_delivery_date": diff["after_delivery_date"],
                    "before_amount": b_amt,
                    "after_amount": a_amt,
                    "delta_amount": a_amt - b_amt,
                    "notes": payload.notes,
                })
                continue

            src = source_items.get(int(payload.source_item_id)) if payload.source_item_id else None
            if not src:
                raise BusinessLogicError(f"变更行缺少有效原订单行: {payload.source_item_id}")

            change_type, diff = resolve_purchase_line_change(src, payload)
            line_types.append(change_type)
            b_amt = line_amount(diff["before_quantity"], diff["before_unit_price"])
            a_amt = line_amount(diff["after_quantity"], diff["after_unit_price"])
            before_qty += diff["before_quantity"]
            after_qty += diff["after_quantity"]
            before_amt += b_amt
            after_amt += a_amt
            rows.append({
                "line_no": payload.line_no or idx,
                "source_item_id": src.id,
                "change_type": change_type,
                "material_id": src.material_id,
                "material_code": src.material_code,
                "material_name": src.material_name,
                "material_spec": src.material_spec,
                "material_unit": src.unit,
                "before_quantity": diff["before_quantity"],
                "after_quantity": diff["after_quantity"],
                "before_unit_price": diff["before_unit_price"],
                "after_unit_price": diff["after_unit_price"],
                "before_delivery_date": diff["before_delivery_date"],
                "after_delivery_date": diff["after_delivery_date"],
                "before_amount": b_amt,
                "after_amount": a_amt,
                "delta_amount": a_amt - b_amt,
                "notes": payload.notes,
            })
        if not rows:
            raise BusinessLogicError("变更单至少包含一条有效变更行")
        return rows, before_qty, after_qty, before_amt, after_amt, line_types

    async def create_from_order(
        self, tenant_id: int, order_id: int, created_by: int, change_reason: str = "订单变更"
    ) -> PurchaseOrderChangeWithItemsResponse:
        order = await self._validate_source_order(tenant_id, order_id)
        source_items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order.id).all()
        has_pending_change = await self._has_pending_change(tenant_id, order_id)
        assert_purchase_order_capability(
            order,
            "create_change_order",
            has_items=len(source_items) > 0,
            has_pending_change=has_pending_change,
        )
        version = await self._next_version(tenant_id, order_id)
        code = await self._generate_code(tenant_id)
        before_qty = Decimal("0")
        before_amt = Decimal("0")
        rows: list[dict] = []
        for idx, src in enumerate(source_items, start=1):
            b_amt = line_amount(src.ordered_quantity, src.unit_price)
            before_qty += Decimal(str(src.ordered_quantity or 0))
            before_amt += b_amt
            rows.append({
                "line_no": idx,
                "source_item_id": src.id,
                "change_type": OrderChangeLineType.QUANTITY.value,
                "material_id": src.material_id,
                "material_code": src.material_code,
                "material_name": src.material_name,
                "material_spec": src.material_spec,
                "material_unit": src.unit,
                "before_quantity": src.ordered_quantity,
                "after_quantity": src.ordered_quantity,
                "before_unit_price": src.unit_price,
                "after_unit_price": src.unit_price,
                "before_delivery_date": src.required_date,
                "after_delivery_date": src.required_date,
                "before_amount": b_amt,
                "after_amount": b_amt,
                "delta_amount": Decimal("0"),
                "notes": None,
            })
        async with in_transaction():
            doc = await PurchaseOrderChangeOrder.create(
                tenant_id=tenant_id,
                change_code=code,
                source_order_id=order.id,
                source_order_code=order.order_code,
                change_version=version,
                supplier_id=order.supplier_id,
                supplier_name=order.supplier_name,
                change_reason=change_reason,
                change_category="MIXED",
                status=DocumentStatus.DRAFT.value,
                review_status=ReviewStatus.PENDING.value,
                before_total_quantity=before_qty,
                after_total_quantity=before_qty,
                before_total_amount=before_amt,
                after_total_amount=before_amt,
                delta_amount=Decimal("0"),
                created_by=created_by,
                updated_by=created_by,
            )
            for row in rows:
                await PurchaseOrderChangeItem.create(tenant_id=tenant_id, change_order_id=doc.id, **row)
        return await self._to_detail(doc)

    async def create_change_order(
        self, tenant_id: int, data: PurchaseOrderChangeCreate, created_by: int
    ) -> PurchaseOrderChangeWithItemsResponse:
        order = await self._validate_source_order(tenant_id, data.source_order_id)
        rows, b_qty, a_qty, b_amt, a_amt, line_types = await self._build_items_from_payload(tenant_id, order, data.items)
        async with in_transaction():
            doc = await PurchaseOrderChangeOrder.create(
                tenant_id=tenant_id,
                change_code=await self._generate_code(tenant_id),
                source_order_id=order.id,
                source_order_code=order.order_code,
                change_version=await self._next_version(tenant_id, order.id),
                supplier_id=order.supplier_id,
                supplier_name=order.supplier_name,
                change_reason=data.change_reason,
                change_category=data.change_category or infer_change_category(line_types),
                effective_date=data.effective_date,
                status=DocumentStatus.DRAFT.value,
                review_status=ReviewStatus.PENDING.value,
                before_total_quantity=b_qty,
                after_total_quantity=a_qty,
                before_total_amount=b_amt,
                after_total_amount=a_amt,
                delta_amount=a_amt - b_amt,
                header_changes=data.header_changes,
                attachments=data.attachments,
                notes=data.notes,
                created_by=created_by,
                updated_by=created_by,
            )
            for row in rows:
                await PurchaseOrderChangeItem.create(tenant_id=tenant_id, change_order_id=doc.id, **row)
        return await self._to_detail(doc)

    async def update_change_order(
        self,
        tenant_id: int,
        change_id: int,
        data: PurchaseOrderChangeUpdate,
        updated_by: int,
        approval_edit_context: Optional[Dict[str, Any]] = None,
        approval_edit_comment: Optional[str] = None,
    ) -> PurchaseOrderChangeWithItemsResponse:
        doc = await PurchaseOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"采购变更单不存在: {change_id}")
        is_draft = is_draft_status(doc.status)
        is_pending = normalize_status(doc.status) == DocumentStatus.PENDING_REVIEW.value
        if not is_draft:
            if not (is_pending and approval_edit_context):
                if is_pending and not approval_edit_context:
                    from core.services.approval.approval_edit_guard import ApprovalEditGuard

                    edit_ctx = await ApprovalEditGuard.get_pending_edit_context(
                        tenant_id, "purchase_order_change", change_id, updated_by
                    )
                    if not edit_ctx:
                        raise BusinessLogicError("单据审核中，仅已开启改单权限的当前审批人可修改")
                    approval_edit_context = edit_ctx
                else:
                    raise BusinessLogicError("仅草稿状态可编辑变更单")

        if approval_edit_context:
            from core.config.audit_editable_fields import is_field_editable

            node_editable = approval_edit_context.get("editable_fields")
            preview = data.model_dump(exclude_unset=True, exclude={"items"})
            for field in preview:
                if not is_field_editable("purchase_order_change", field, node_editable):
                    raise ValidationError(f"字段「{field}」不允许在审核中修改")
            if data.items is not None and not is_field_editable("purchase_order_change", "items", node_editable):
                raise ValidationError("字段「变更明细」不允许在审核中修改")

        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=doc.source_order_id)
        if not order:
            raise NotFoundError("原采购订单不存在")
        async with in_transaction():
            if data.items is not None:
                rows, b_qty, a_qty, b_amt, a_amt, line_types = await self._build_items_from_payload(
                    tenant_id, order, data.items
                )
                await PurchaseOrderChangeItem.filter(tenant_id=tenant_id, change_order_id=doc.id).delete()
                for row in rows:
                    await PurchaseOrderChangeItem.create(tenant_id=tenant_id, change_order_id=doc.id, **row)
                doc.before_total_quantity = b_qty
                doc.after_total_quantity = a_qty
                doc.before_total_amount = b_amt
                doc.after_total_amount = a_amt
                doc.delta_amount = a_amt - b_amt
                doc.change_category = data.change_category or infer_change_category(line_types)
            doc.change_reason = data.change_reason
            doc.effective_date = data.effective_date
            doc.header_changes = data.header_changes
            doc.attachments = data.attachments
            doc.notes = data.notes
            doc.updated_by = updated_by
            await doc.save()
        return await self._to_detail(doc)

    async def _build_change_list_rows(
        self,
        tenant_id: int,
        docs: List[PurchaseOrderChangeOrder],
        lifecycle_stage: Optional[str] = None,
    ) -> List[PurchaseOrderChangeListResponse]:
        change_ids = [d.id for d in docs]
        all_items = await PurchaseOrderChangeItem.filter(
            tenant_id=tenant_id, change_order_id__in=change_ids
        ).all() if change_ids else []
        items_by_change: Dict[int, List[PurchaseOrderChangeItem]] = {}
        for it in all_items:
            items_by_change.setdefault(it.change_order_id, []).append(it)

        result: List[PurchaseOrderChangeListResponse] = []
        for doc in docs:
            lifecycle = get_purchase_order_change_lifecycle(doc.status, doc.review_status, doc.applied_at)
            if lifecycle_stage and lifecycle.get("current_stage_key") != lifecycle_stage:
                continue
            doc_items = items_by_change.get(doc.id, [])
            has_content = False
            if Decimal(str(doc.delta_amount or 0)) != 0:
                has_content = True
            elif doc.header_changes:
                has_content = True
            else:
                for i in doc_items:
                    if i.change_type in (OrderChangeLineType.LINE_ADD.value, OrderChangeLineType.LINE_CANCEL.value):
                        has_content = True
                        break
                    if Decimal(str(i.delta_amount or 0)) != 0:
                        has_content = True
                        break
            row = PurchaseOrderChangeListResponse(
                id=doc.id,
                change_code=doc.change_code,
                source_order_id=doc.source_order_id,
                source_order_code=doc.source_order_code,
                change_version=doc.change_version,
                change_category=doc.change_category,
                change_reason=doc.change_reason,
                status=doc.status,
                review_status=doc.review_status,
                before_total_amount=doc.before_total_amount,
                after_total_amount=doc.after_total_amount,
                delta_amount=doc.delta_amount,
                applied_at=doc.applied_at,
                created_at=doc.created_at,
                lifecycle=lifecycle,
                supplier_id=doc.supplier_id,
                supplier_name=doc.supplier_name,
                partner_name=doc.supplier_name,
            )
            result.append(
                enrich_purchase_order_change_capabilities_on_response(
                    doc, row, has_change_content=has_content
                )
            )
        from core.services.approval.audit_record_enricher import enrich_items

        return await enrich_items(tenant_id, "purchase_order_change", result)

    async def list_change_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        source_order_id: Optional[int] = None,
        status: Optional[str] = None,
        lifecycle_stage: Optional[str] = None,
        supplier_id: Optional[int] = None,
        change_category: Optional[str] = None,
        keyword: Optional[str] = None,
        change_code: Optional[str] = None,
        source_order_code: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        order_by: Optional[str] = None,
    ) -> Tuple[List[PurchaseOrderChangeListResponse], int]:
        qs = PurchaseOrderChangeOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if source_order_id:
            qs = qs.filter(source_order_id=source_order_id)
        if status:
            qs = qs.filter(status=status)
        if supplier_id is not None and int(supplier_id) > 0:
            qs = qs.filter(supplier_id=int(supplier_id))
        if change_category and str(change_category).strip():
            qs = qs.filter(change_category=str(change_category).strip())
        if start_date:
            qs = qs.filter(created_at__gte=datetime.combine(start_date, datetime.min.time()))
        if end_date:
            qs = qs.filter(created_at__lte=datetime.combine(end_date, datetime.max.time()))
        if keyword and str(keyword).strip():
            kw = str(keyword).strip()
            qs = qs.filter(
                Q(change_code__icontains=kw)
                | Q(supplier_name__icontains=kw)
                | Q(source_order_code__icontains=kw)
                | Q(change_reason__icontains=kw)
            )
        if change_code and str(change_code).strip():
            qs = qs.filter(change_code__icontains=change_code.strip())
        if source_order_code and str(source_order_code).strip():
            qs = qs.filter(source_order_code__icontains=source_order_code.strip())

        order_clause = order_by if order_by else "-created_at"
        field = order_clause.lstrip("-")
        if field not in PURCHASE_ORDER_CHANGE_SORTABLE_FIELDS:
            order_clause = "-created_at"
        lifecycle_filter = (lifecycle_stage or "").strip()

        if lifecycle_filter:
            docs = await qs.order_by(order_clause, "-id").all()
            rows = await self._build_change_list_rows(tenant_id, docs, lifecycle_stage=lifecycle_filter)
            total = len(rows)
            return rows[skip : skip + limit], total

        total = await qs.count()
        docs = await qs.order_by(order_clause, "-id").offset(skip).limit(limit)
        rows = await self._build_change_list_rows(tenant_id, docs)
        return rows, total

    async def get_by_id(self, tenant_id: int, change_id: int) -> PurchaseOrderChangeWithItemsResponse:
        doc = await PurchaseOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"采购变更单不存在: {change_id}")
        resp = await self._to_detail(doc)
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "purchase_order_change", resp)

    async def list_by_order(self, tenant_id: int, order_id: int) -> List[PurchaseOrderChangeListResponse]:
        rows, _total = await self.list_change_orders(tenant_id, skip=0, limit=100, source_order_id=order_id)
        return rows

    async def delete_change_order(self, tenant_id: int, change_id: int) -> None:
        doc = await PurchaseOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"采购变更单不存在: {change_id}")
        assert_purchase_order_change_capability(doc, "delete")
        doc.deleted_at = datetime.now()
        await doc.save()

    async def submit(self, tenant_id: int, change_id: int, operator_id: int) -> PurchaseOrderChangeWithItemsResponse:
        doc = await PurchaseOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"采购变更单不存在: {change_id}")
        has_content = await self._has_change_content(tenant_id, doc)
        assert_purchase_order_change_capability(doc, "submit", has_change_content=has_content)
        audit_required = await self.business_config_service.check_audit_required(tenant_id, "purchase_order_change")
        if audit_required:
            doc.status = DocumentStatus.PENDING_REVIEW.value
            doc.review_status = ReviewStatus.PENDING.value
        else:
            doc.status = DocumentStatus.AUDITED.value
            doc.review_status = ReviewStatus.APPROVED.value
        doc.updated_by = operator_id
        await doc.save()
        if not audit_required:
            return await self.apply(tenant_id, change_id, operator_id)
        return await self._to_detail(doc)

    async def approve(
        self, tenant_id: int, change_id: int, body: ApproveChangeRequest, operator_id: int
    ) -> PurchaseOrderChangeWithItemsResponse:
        doc = await PurchaseOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"采购变更单不存在: {change_id}")
        assert_purchase_order_change_capability(doc, "approve")
        doc.reviewer_id = operator_id
        doc.reviewer_name = await self.get_user_name(operator_id)
        doc.review_time = datetime.now()
        doc.review_remarks = body.review_remarks
        if body.approved:
            doc.status = DocumentStatus.AUDITED.value
            doc.review_status = ReviewStatus.APPROVED.value
        else:
            doc.status = DocumentStatus.REJECTED.value
            doc.review_status = ReviewStatus.REJECTED.value
        doc.updated_by = operator_id
        await doc.save()
        if body.approved:
            return await self.apply(tenant_id, change_id, operator_id)
        return await self._to_detail(doc)

    async def withdraw(self, tenant_id: int, change_id: int, operator_id: int) -> PurchaseOrderChangeWithItemsResponse:
        doc = await PurchaseOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"采购变更单不存在: {change_id}")
        assert_purchase_order_change_capability(doc, "withdraw_submit")
        doc.status = DocumentStatus.DRAFT.value
        doc.review_status = ReviewStatus.PENDING.value
        doc.updated_by = operator_id
        await doc.save()
        return await self._to_detail(doc)

    async def preview_impact(self, tenant_id: int, change_id: int) -> ChangeImpactPreviewResponse:
        doc = await self.get_by_id(tenant_id, change_id)
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        impact = await DocumentRelationNewService().get_change_impact_purchase_order(tenant_id, doc.source_order_id)
        return ChangeImpactPreviewResponse(
            blocking_errors=[],
            warnings=[],
            affected_receipt_notices=impact.get("affected_receipt_notices", []),
            affected_inbounds=impact.get("affected_inbounds", []),
            recommended_actions=impact.get("recommended_actions", []),
        )

    async def apply(self, tenant_id: int, change_id: int, operator_id: int) -> PurchaseOrderChangeWithItemsResponse:
        doc = await PurchaseOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"采购变更单不存在: {change_id}")
        if doc.status == OrderChangeApplyStatus.APPLIED.value:
            return await self._to_detail(doc)
        assert_purchase_order_change_capability(doc, "apply")

        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=doc.source_order_id)
        if not order:
            raise NotFoundError("原采购订单不存在")
        items = await PurchaseOrderChangeItem.filter(tenant_id=tenant_id, change_order_id=doc.id).all()
        operator_name = await self.get_user_name(operator_id) or str(operator_id)

        async with in_transaction():
            if doc.header_changes:
                for field, val in doc.header_changes.items():
                    old_val = getattr(order, field, None)
                    if str(old_val) != str(val):
                        await PurchaseOrderChange.create(
                            tenant_id=tenant_id,
                            order_id=order.id,
                            change_type="Modify",
                            field_name=field,
                            old_value=str(old_val),
                            new_value=str(val),
                            reason=doc.change_reason,
                            operator_id=operator_id,
                            operator_name=operator_name,
                        )
                        setattr(order, field, val)

            for ch in items:
                if ch.change_type == OrderChangeLineType.LINE_ADD.value:
                    qty = Decimal(str(ch.after_quantity or 0))
                    price = Decimal(str(ch.after_unit_price or 0))
                    required_date = ch.after_delivery_date or order.order_date
                    if not ch.material_id:
                        raise BusinessLogicError("新增行缺少物料")
                    total_price = line_amount(qty, price)
                    await PurchaseOrderChange.create(
                        tenant_id=tenant_id,
                        order_id=order.id,
                        change_type="Add",
                        field_name=f"line_add_{ch.material_code}",
                        old_value="0",
                        new_value=str(qty),
                        reason=doc.change_reason,
                        operator_id=operator_id,
                        operator_name=operator_name,
                    )
                    await PurchaseOrderItem.create(
                        tenant_id=tenant_id,
                        order_id=order.id,
                        material_id=ch.material_id,
                        material_code=ch.material_code or "",
                        material_name=ch.material_name or "",
                        material_spec=ch.material_spec,
                        unit=ch.material_unit or "",
                        ordered_quantity=qty,
                        received_quantity=Decimal("0"),
                        outstanding_quantity=qty,
                        unit_price=price,
                        total_price=total_price,
                        required_date=required_date,
                    )
                    continue

                if not ch.source_item_id:
                    continue
                po_item = await PurchaseOrderItem.get_or_none(tenant_id=tenant_id, id=ch.source_item_id, order_id=order.id)
                if not po_item:
                    continue
                if ch.change_type == OrderChangeLineType.LINE_CANCEL.value:
                    await PurchaseOrderChange.create(
                        tenant_id=tenant_id,
                        order_id=order.id,
                        change_type="Cancel",
                        field_name=f"line_{po_item.id}",
                        old_value=str(po_item.ordered_quantity),
                        new_value="0",
                        reason=doc.change_reason,
                        operator_id=operator_id,
                        operator_name=operator_name,
                    )
                    await po_item.delete()
                    continue
                if ch.after_quantity != ch.before_quantity:
                    await PurchaseOrderChange.create(
                        tenant_id=tenant_id,
                        order_id=order.id,
                        change_type="Quantity",
                        field_name=f"line_{po_item.id}_quantity",
                        old_value=str(ch.before_quantity),
                        new_value=str(ch.after_quantity),
                        reason=doc.change_reason,
                        operator_id=operator_id,
                        operator_name=operator_name,
                    )
                if ch.after_unit_price != ch.before_unit_price:
                    await PurchaseOrderChange.create(
                        tenant_id=tenant_id,
                        order_id=order.id,
                        change_type="Price",
                        field_name=f"line_{po_item.id}_price",
                        old_value=str(ch.before_unit_price),
                        new_value=str(ch.after_unit_price),
                        reason=doc.change_reason,
                        operator_id=operator_id,
                        operator_name=operator_name,
                    )
                po_item.ordered_quantity = ch.after_quantity or po_item.ordered_quantity
                po_item.unit_price = ch.after_unit_price or po_item.unit_price
                po_item.required_date = ch.after_delivery_date or po_item.required_date
                received = Decimal(str(po_item.received_quantity or 0))
                po_item.outstanding_quantity = max(Decimal("0"), po_item.ordered_quantity - received)
                po_item.total_price = line_amount(po_item.ordered_quantity, po_item.unit_price)
                await po_item.save()

            remaining = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order.id).all()
            order.total_quantity = sum((Decimal(str(i.ordered_quantity or 0)) for i in remaining), Decimal("0"))
            order.total_amount = sum((Decimal(str(i.total_price or 0)) for i in remaining), Decimal("0"))
            order.updated_by = operator_id
            await order.save()

            doc.status = OrderChangeApplyStatus.APPLIED.value
            doc.applied_at = datetime.now()
            doc.applied_by = operator_id
            doc.updated_by = operator_id
            await doc.save()

        try:
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            await DocumentRelationNewService().create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="purchase_order",
                    source_id=order.id,
                    source_code=order.order_code,
                    source_name=order.order_code,
                    target_type="purchase_order_change",
                    target_id=doc.id,
                    target_code=doc.change_code,
                    target_name=doc.change_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="采购订单变更",
                ),
                created_by=operator_id,
            )
        except Exception:
            pass

        return await self._to_detail(doc)
