"""销售变更单服务"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, is_draft_status, normalize_status
from apps.kuaizhizao.constants.order_change import OrderChangeApplyStatus, OrderChangeLineType
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.sales_order_change_order import SalesOrderChangeOrder, SalesOrderChangeItem
from apps.kuaizhizao.schemas.order_change import (
    ApproveChangeRequest,
    ChangeImpactPreviewResponse,
    OrderChangeItemCreate,
    OrderChangeItemResponse,
    SalesOrderChangeCreate,
    SalesOrderChangeListResponse,
    SalesOrderChangeUpdate,
    SalesOrderChangeWithItemsResponse,
)
from apps.kuaizhizao.services.document_lifecycle_service import get_sales_order_change_lifecycle
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_sales_order_change_capabilities_on_response,
)
from apps.kuaizhizao.services.document_action_policy.sales_order_change import (
    assert_sales_order_change_capability,
    derive_sales_order_change_capabilities,
)
from apps.kuaizhizao.services.order_change.helpers import (
    infer_change_category,
    is_source_order_locked_for_direct_edit,
    line_amount,
    resolve_sales_line_change,
)
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.services.business_config_service import BusinessConfigService
from loguru import logger

SALES_ORDER_CHANGE_SORTABLE_FIELDS = frozenset({
    "change_code",
    "source_order_code",
    "change_version",
    "change_category",
    "customer_name",
    "delta_amount",
    "status",
    "review_status",
    "applied_at",
    "created_at",
    "updated_at",
})


class SalesOrderChangeService(AppBaseService[SalesOrderChangeOrder]):
    def __init__(self):
        super().__init__(SalesOrderChangeOrder)
        self.business_config_service = BusinessConfigService()

    async def _generate_code(self, tenant_id: int) -> str:
        return await self.generate_code(tenant_id, "SALES_ORDER_CHANGE_CODE", prefix="SOC")

    async def _has_change_content(self, tenant_id: int, doc: SalesOrderChangeOrder) -> bool:
        items = await SalesOrderChangeItem.filter(tenant_id=tenant_id, change_order_id=doc.id).all()
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
        count = await SalesOrderChangeOrder.filter(
            tenant_id=tenant_id,
            source_order_id=source_order_id,
            deleted_at__isnull=True,
            status=OrderChangeApplyStatus.APPLIED.value,
        ).count()
        pending = await SalesOrderChangeOrder.filter(
            tenant_id=tenant_id,
            source_order_id=source_order_id,
            deleted_at__isnull=True,
            status__in=[DocumentStatus.DRAFT.value, DocumentStatus.PENDING_REVIEW.value, DocumentStatus.AUDITED.value],
        ).count()
        if pending:
            raise BusinessLogicError("该销售订单存在未完成的变更单，请先处理后再创建")
        return count + 1

    def _item_to_response(self, item: SalesOrderChangeItem) -> OrderChangeItemResponse:
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

    async def _to_detail(self, doc: SalesOrderChangeOrder) -> SalesOrderChangeWithItemsResponse:
        items = await SalesOrderChangeItem.filter(tenant_id=doc.tenant_id, change_order_id=doc.id).order_by("line_no")
        lifecycle = get_sales_order_change_lifecycle(doc.status, doc.review_status, doc.applied_at)
        has_content = await self._has_change_content(doc.tenant_id, doc)
        resp = SalesOrderChangeWithItemsResponse(
            id=doc.id,
            change_code=doc.change_code,
            source_order_id=doc.source_order_id,
            source_order_code=doc.source_order_code,
            change_version=doc.change_version,
            customer_id=doc.customer_id,
            customer_name=doc.customer_name,
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
            created_by=doc.created_by,
            created_by_name=doc.created_by_name,
            updated_by=doc.updated_by,
            updated_by_name=doc.updated_by_name,
            header_changes=doc.header_changes,
            attachments=doc.attachments,
            notes=doc.notes,
            reviewer_name=doc.reviewer_name,
            review_time=doc.review_time,
            review_remarks=doc.review_remarks,
            lifecycle=lifecycle,
            items=[self._item_to_response(i) for i in items],
        )
        return enrich_sales_order_change_capabilities_on_response(
            doc, resp, has_change_content=has_content
        )

    async def _validate_source_order(self, tenant_id: int, order_id: int) -> SalesOrder:
        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=order_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError(f"销售订单不存在: {order_id}")
        if not is_source_order_locked_for_direct_edit(order.status, order.review_status):
            raise BusinessLogicError("仅已生效或执行中的销售订单可创建变更单")
        return order

    async def _build_items_from_payload(
        self,
        tenant_id: int,
        order: SalesOrder,
        items: List[OrderChangeItemCreate],
    ) -> tuple[list[dict], Decimal, Decimal, Decimal, Decimal, list[str]]:
        source_items = {
            int(i.id): i
            for i in await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=order.id).all()
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
                change_type, diff = resolve_sales_line_change(None, payload)
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

            change_type, diff = resolve_sales_line_change(src, payload)
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
                "material_unit": src.material_unit,
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
        self,
        tenant_id: int,
        order_id: int,
        created_by: int,
        change_reason: str = "订单变更",
    ) -> SalesOrderChangeWithItemsResponse:
        order = await self._validate_source_order(tenant_id, order_id)
        version = await self._next_version(tenant_id, order_id)
        code = await self._generate_code(tenant_id)
        source_items = await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=order.id).all()

        before_qty = Decimal("0")
        before_amt = Decimal("0")
        rows: list[dict] = []
        for idx, src in enumerate(source_items, start=1):
            b_amt = line_amount(src.order_quantity, src.unit_price)
            before_qty += Decimal(str(src.order_quantity or 0))
            before_amt += b_amt
            rows.append({
                "line_no": idx,
                "source_item_id": src.id,
                "change_type": OrderChangeLineType.QUANTITY.value,
                "material_id": src.material_id,
                "material_code": src.material_code,
                "material_name": src.material_name,
                "material_spec": src.material_spec,
                "material_unit": src.material_unit,
                "before_quantity": src.order_quantity,
                "after_quantity": src.order_quantity,
                "before_unit_price": src.unit_price,
                "after_unit_price": src.unit_price,
                "before_delivery_date": src.delivery_date,
                "after_delivery_date": src.delivery_date,
                "before_amount": b_amt,
                "after_amount": b_amt,
                "delta_amount": Decimal("0"),
                "notes": None,
            })

        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            doc = await SalesOrderChangeOrder.create(
                tenant_id=tenant_id,
                change_code=code,
                source_order_id=order.id,
                source_order_code=order.order_code,
                change_version=version,
                customer_id=order.customer_id,
                customer_name=order.customer_name,
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
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )
            for row in rows:
                await SalesOrderChangeItem.create(tenant_id=tenant_id, change_order_id=doc.id, **row)
        return await self._to_detail(doc)

    async def create_change_order(
        self,
        tenant_id: int,
        data: SalesOrderChangeCreate,
        created_by: int,
        prefilled_code: Optional[str] = None,
        prefilled_version: Optional[int] = None,
        prefilled_order: Optional[SalesOrder] = None,
    ) -> SalesOrderChangeWithItemsResponse:
        order = prefilled_order or await self._validate_source_order(tenant_id, data.source_order_id)
        rows, b_qty, a_qty, b_amt, a_amt, line_types = await self._build_items_from_payload(tenant_id, order, data.items)

        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            doc = await SalesOrderChangeOrder.create(
                tenant_id=tenant_id,
                change_code=prefilled_code or await self._generate_code(tenant_id),
                source_order_id=order.id,
                source_order_code=order.order_code,
                change_version=prefilled_version or await self._next_version(tenant_id, order.id),
                customer_id=order.customer_id,
                customer_name=order.customer_name,
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
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )
            for row in rows:
                await SalesOrderChangeItem.create(tenant_id=tenant_id, change_order_id=doc.id, **row)
        return await self._to_detail(doc)

    async def update_change_order(
        self,
        tenant_id: int,
        change_id: int,
        data: SalesOrderChangeUpdate,
        updated_by: int,
        approval_edit_context: Optional[Dict[str, Any]] = None,
        approval_edit_comment: Optional[str] = None,
    ) -> SalesOrderChangeWithItemsResponse:
        doc = await SalesOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"销售变更单不存在: {change_id}")
        assert_sales_order_change_capability(doc, "update")
        is_draft = is_draft_status(doc.status)
        is_pending = normalize_status(doc.status) == DocumentStatus.PENDING_REVIEW.value
        if not is_draft:
            if not (is_pending and approval_edit_context):
                if is_pending and not approval_edit_context:
                    from core.services.approval.approval_edit_guard import ApprovalEditGuard

                    edit_ctx = await ApprovalEditGuard.get_pending_edit_context(
                        tenant_id, "sales_order_change", change_id, updated_by
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
                if not is_field_editable("sales_order_change", field, node_editable):
                    raise ValidationError(f"字段「{field}」不允许在审核中修改")
            if data.items is not None and not is_field_editable("sales_order_change", "items", node_editable):
                raise ValidationError("字段「变更明细」不允许在审核中修改")

        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=doc.source_order_id)
        if not order:
            raise NotFoundError("原销售订单不存在")

        async with in_transaction():
            if data.items is not None:
                rows, b_qty, a_qty, b_amt, a_amt, line_types = await self._build_items_from_payload(
                    tenant_id, order, data.items
                )
                await SalesOrderChangeItem.filter(tenant_id=tenant_id, change_order_id=doc.id).delete()
                for row in rows:
                    await SalesOrderChangeItem.create(tenant_id=tenant_id, change_order_id=doc.id, **row)
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
            user_info = await self.get_user_info(updated_by)
            doc.updated_by = updated_by
            doc.updated_by_name = user_info["name"]
            await doc.save()
        if normalize_status(doc.status) == DocumentStatus.PENDING_REVIEW.value:
            audit_required = await self.business_config_service.check_audit_required(
                tenant_id, "sales_order_change"
            )
            if not audit_required:
                return await self.approve(
                    tenant_id,
                    change_id,
                    ApproveChangeRequest(approved=True, review_remarks="自动审核"),
                    updated_by,
                )
        return await self._to_detail(doc)

    async def _build_change_list_rows(
        self,
        tenant_id: int,
        docs: List[SalesOrderChangeOrder],
        lifecycle_stage: Optional[str] = None,
    ) -> List[SalesOrderChangeListResponse]:
        change_ids = [d.id for d in docs]
        all_items = await SalesOrderChangeItem.filter(
            tenant_id=tenant_id, change_order_id__in=change_ids
        ).all() if change_ids else []
        items_by_change: Dict[int, List[SalesOrderChangeItem]] = {}
        for it in all_items:
            items_by_change.setdefault(it.change_order_id, []).append(it)

        result: List[SalesOrderChangeListResponse] = []
        for doc in docs:
            lifecycle = get_sales_order_change_lifecycle(doc.status, doc.review_status, doc.applied_at)
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
            row = SalesOrderChangeListResponse(
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
                created_by=doc.created_by,
                created_by_name=doc.created_by_name,
                updated_by=doc.updated_by,
                updated_by_name=doc.updated_by_name,
                lifecycle=lifecycle,
                customer_id=doc.customer_id,
                customer_name=doc.customer_name,
                partner_name=doc.customer_name,
            )
            result.append(
                enrich_sales_order_change_capabilities_on_response(
                    doc, row, has_change_content=has_content
                )
            )
        from core.services.approval.audit_record_enricher import enrich_items

        return await enrich_items(tenant_id, "sales_order_change", result)

    async def list_change_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        source_order_id: Optional[int] = None,
        status: Optional[str] = None,
        lifecycle_stage: Optional[str] = None,
        customer_id: Optional[int] = None,
        change_category: Optional[str] = None,
        keyword: Optional[str] = None,
        change_code: Optional[str] = None,
        source_order_code: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        order_by: Optional[str] = None,
    ) -> Tuple[List[SalesOrderChangeListResponse], int]:
        qs = SalesOrderChangeOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if source_order_id:
            qs = qs.filter(source_order_id=source_order_id)
        if status:
            qs = qs.filter(status=status)
        if customer_id is not None and int(customer_id) > 0:
            qs = qs.filter(customer_id=int(customer_id))
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
                | Q(customer_name__icontains=kw)
                | Q(source_order_code__icontains=kw)
                | Q(change_reason__icontains=kw)
            )
        if change_code and str(change_code).strip():
            qs = qs.filter(change_code__icontains=change_code.strip())
        if source_order_code and str(source_order_code).strip():
            qs = qs.filter(source_order_code__icontains=source_order_code.strip())

        order_clause = order_by if order_by else "-created_at"
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

    async def get_by_id(self, tenant_id: int, change_id: int) -> SalesOrderChangeWithItemsResponse:
        doc = await SalesOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"销售变更单不存在: {change_id}")
        resp = await self._to_detail(doc)
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "sales_order_change", resp)

    async def list_by_order(self, tenant_id: int, order_id: int) -> List[SalesOrderChangeListResponse]:
        rows, _total = await self.list_change_orders(tenant_id, skip=0, limit=100, source_order_id=order_id)
        return rows

    async def delete_change_order(self, tenant_id: int, change_id: int) -> None:
        doc = await SalesOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"销售变更单不存在: {change_id}")
        assert_sales_order_change_capability(doc, "delete")
        doc.deleted_at = datetime.now()
        await doc.save()

    async def submit(self, tenant_id: int, change_id: int, operator_id: int) -> SalesOrderChangeWithItemsResponse:
        doc = await SalesOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"销售变更单不存在: {change_id}")
        has_content = await self._has_change_content(tenant_id, doc)
        assert_sales_order_change_capability(doc, "submit", has_change_content=has_content)
        audit_required = await self.business_config_service.check_audit_required(tenant_id, "sales_order_change")
        if audit_required:
            doc.status = DocumentStatus.PENDING_REVIEW.value
            doc.review_status = ReviewStatus.PENDING.value
        else:
            doc.status = DocumentStatus.AUDITED.value
            doc.review_status = ReviewStatus.APPROVED.value
        user_info = await self.get_user_info(operator_id)
        doc.updated_by = operator_id
        doc.updated_by_name = user_info["name"]
        await doc.save()
        if not audit_required:
            return await self.apply(tenant_id, change_id, operator_id)
        return await self._to_detail(doc)

    async def approve(
        self, tenant_id: int, change_id: int, body: ApproveChangeRequest, operator_id: int
    ) -> SalesOrderChangeWithItemsResponse:
        doc = await SalesOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"销售变更单不存在: {change_id}")
        assert_sales_order_change_capability(doc, "approve")
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
        user_info = await self.get_user_info(operator_id)
        doc.updated_by = operator_id
        doc.updated_by_name = user_info["name"]
        await doc.save()
        if body.approved:
            return await self.apply(tenant_id, change_id, operator_id)
        return await self._to_detail(doc)

    async def withdraw(self, tenant_id: int, change_id: int, operator_id: int) -> SalesOrderChangeWithItemsResponse:
        doc = await SalesOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"销售变更单不存在: {change_id}")
        assert_sales_order_change_capability(doc, "withdraw_submit")
        doc.status = DocumentStatus.DRAFT.value
        doc.review_status = ReviewStatus.PENDING.value
        user_info = await self.get_user_info(operator_id)
        doc.updated_by = operator_id
        doc.updated_by_name = user_info["name"]
        await doc.save()
        return await self._to_detail(doc)

    async def preview_impact(self, tenant_id: int, change_id: int) -> ChangeImpactPreviewResponse:
        doc = await self.get_by_id(tenant_id, change_id)
        blocking: list[str] = []
        for item in doc.items:
            if item.after_quantity is not None and item.before_quantity is not None:
                if item.after_quantity < item.before_quantity and item.change_type != OrderChangeLineType.LINE_CANCEL.value:
                    pass  # validated at build time
        from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
        impact = await DocumentRelationNewService().get_change_impact_sales_order(tenant_id, doc.source_order_id)
        return ChangeImpactPreviewResponse(
            blocking_errors=blocking,
            warnings=[],
            affected_demands=impact.get("affected_demands", []),
            affected_computations=impact.get("affected_computations", []),
            affected_plans=impact.get("affected_plans", []),
            affected_work_orders=impact.get("affected_work_orders", []),
            recommended_actions=impact.get("recommended_actions", []),
        )

    async def apply(self, tenant_id: int, change_id: int, operator_id: int) -> SalesOrderChangeWithItemsResponse:
        doc = await SalesOrderChangeOrder.get_or_none(tenant_id=tenant_id, id=change_id, deleted_at__isnull=True)
        if not doc:
            raise NotFoundError(f"销售变更单不存在: {change_id}")
        if doc.status == OrderChangeApplyStatus.APPLIED.value:
            return await self._to_detail(doc)
        assert_sales_order_change_capability(doc, "apply")

        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=doc.source_order_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError("原销售订单不存在")
        old_total = Decimal(str(order.total_amount or 0))
        old_qty = Decimal(str(order.total_quantity or 0))
        items = await SalesOrderChangeItem.filter(tenant_id=tenant_id, change_order_id=doc.id).all()

        async with in_transaction():
            if doc.header_changes:
                for field, val in doc.header_changes.items():
                    if hasattr(order, field):
                        setattr(order, field, val)

            total_qty = Decimal("0")
            total_amt = Decimal("0")
            for ch in items:
                if ch.change_type == OrderChangeLineType.LINE_ADD.value:
                    qty = Decimal(str(ch.after_quantity or 0))
                    price = Decimal(str(ch.after_unit_price or 0))
                    delivery = ch.after_delivery_date or order.delivery_date
                    if not ch.material_id:
                        raise BusinessLogicError("新增行缺少物料")
                    if not delivery:
                        raise BusinessLogicError("新增行缺少交货日期")
                    item_amt = line_amount(qty, price)
                    await SalesOrderItem.create(
                        tenant_id=tenant_id,
                        sales_order_id=order.id,
                        material_id=ch.material_id,
                        material_code=ch.material_code or "",
                        material_name=ch.material_name or "",
                        material_spec=ch.material_spec,
                        material_unit=ch.material_unit or "",
                        order_quantity=qty,
                        delivered_quantity=Decimal("0"),
                        remaining_quantity=qty,
                        unit_price=price,
                        tax_rate=Decimal("0"),
                        total_amount=item_amt,
                        delivery_date=delivery,
                    )
                    total_qty += qty
                    total_amt += item_amt
                    continue

                if not ch.source_item_id:
                    continue
                so_item = await SalesOrderItem.get_or_none(
                    tenant_id=tenant_id, id=ch.source_item_id, sales_order_id=order.id
                )
                if not so_item:
                    continue
                if ch.change_type == OrderChangeLineType.LINE_CANCEL.value:
                    await so_item.delete()
                    continue
                so_item.order_quantity = ch.after_quantity or so_item.order_quantity
                so_item.unit_price = ch.after_unit_price or so_item.unit_price
                so_item.delivery_date = ch.after_delivery_date or so_item.delivery_date
                delivered = Decimal(str(so_item.delivered_quantity or 0))
                so_item.remaining_quantity = max(Decimal("0"), so_item.order_quantity - delivered)
                so_item.total_amount = line_amount(so_item.order_quantity, so_item.unit_price)
                await so_item.save()
                total_qty += so_item.order_quantity
                total_amt += so_item.total_amount

            remaining_items = await SalesOrderItem.filter(tenant_id=tenant_id, sales_order_id=order.id).all()
            order.total_quantity = sum((Decimal(str(i.order_quantity or 0)) for i in remaining_items), Decimal("0"))
            order.total_amount = sum((Decimal(str(i.total_amount or 0)) for i in remaining_items), Decimal("0"))
            user_info = await self.get_user_info(operator_id)
            order.updated_by = operator_id
            order.updated_by_name = user_info["name"]
            await order.save()

            contract_id = getattr(order, "contract_id", None)
            if contract_id:
                from apps.kuaizhizao.models.sales_contract import SalesContract

                contract = await SalesContract.get_or_none(
                    tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True
                )
                if contract:
                    delta_amt = Decimal(str(order.total_amount or 0)) - old_total
                    delta_qty = Decimal(str(order.total_quantity or 0)) - old_qty
                    if delta_amt != 0 or delta_qty != 0:
                        new_released_amt = Decimal(str(contract.released_amount or 0)) + delta_amt
                        new_released_qty = Decimal(str(contract.released_quantity or 0)) + delta_qty
                        if new_released_amt < 0 or new_released_qty < 0:
                            raise BusinessLogicError("变更导致合同释放量为负，请先调整变更内容")
                        total_amt = Decimal(str(contract.total_amount or 0))
                        total_qty = Decimal(str(contract.total_quantity or 0))
                        if total_amt > 0 and new_released_amt > total_amt:
                            raise BusinessLogicError("变更导致合同释放金额超过合同总额")
                        if total_qty > 0 and new_released_qty > total_qty:
                            raise BusinessLogicError("变更导致合同释放数量超过合同总量")
                        contract.released_amount = new_released_amt
                        contract.released_quantity = new_released_qty
                        contract.updated_by = operator_id
                        contract.updated_by_name = user_info["name"]
                        await contract.save(
                            update_fields=[
                                "released_amount",
                                "released_quantity",
                                "updated_by",
                                "updated_by_name",
                                "updated_at",
                            ]
                        )

            doc.status = OrderChangeApplyStatus.APPLIED.value
            doc.applied_at = datetime.now()
            doc.applied_by = operator_id
            doc.updated_by = operator_id
            doc.updated_by_name = user_info["name"]
            await doc.save()

        from apps.kuaizhizao.services.sales_order_service import SalesOrderService
        svc = SalesOrderService()
        await svc._sync_demand_if_exists(tenant_id, order.id, operator_id)
        try:
            from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
            await DocumentRelationService().apply_upstream_change_impact(tenant_id, "sales_order", order.id)
        except Exception as e:
            logger.warning("销售变更生效-上游计划影响标记失败 change_id=%s: %s", change_id, e)
        try:
            from apps.kuaizhizao.services.demand_change_event_service import DemandChangeEventService
            await DemandChangeEventService().create_event(
                tenant_id=tenant_id,
                event_type="order",
                source_type="sales_order",
                source_id=order.id,
                source_code=order.order_code,
                source_name=order.order_code,
                changed_fields=["sales_order_change_applied"],
                payload={"change_order_id": doc.id, "change_code": doc.change_code},
                effective_at=datetime.now(),
                trigger_reason="sales_order_change_applied",
                requested_by=operator_id,
                correlation_id=f"sales_order_change:{doc.id}",
                auto_create_task=True,
            )
        except Exception as e:
            logger.warning(
                "销售变更生效-创建需求变更事件失败 change_id=%s order_id=%s: %s",
                change_id,
                order.id,
                e,
            )

        try:
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            await DocumentRelationNewService().create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="sales_order",
                    source_id=order.id,
                    source_code=order.order_code,
                    source_name=order.order_code,
                    target_type="sales_order_change",
                    target_id=doc.id,
                    target_code=doc.change_code,
                    target_name=doc.change_code,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="销售订单变更",
                ),
                created_by=operator_id,
            )
        except Exception:
            pass

        return await self._to_detail(doc)
