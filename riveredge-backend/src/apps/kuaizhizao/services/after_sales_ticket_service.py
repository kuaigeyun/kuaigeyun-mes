"""
售后服务工单服务
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Sequence

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaizhizao.models.after_sales_ticket import AfterSalesTicket
from apps.kuaizhizao.models.after_sales_ticket_item import AfterSalesTicketItem
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.schemas.after_sales_ticket import (
    REQUEST_TYPES,
    TICKET_STATUSES,
    AfterSalesTicketClose,
    AfterSalesTicketCreate,
    AfterSalesTicketItemCreate,
    AfterSalesTicketItemResponse,
    AfterSalesTicketListEnvelope,
    AfterSalesTicketPullFromSalesDeliveryRequest,
    AfterSalesTicketPullFromSalesOrderRequest,
    AfterSalesTicketPushPreviewLine,
    AfterSalesTicketPushPreviewResponse,
    AfterSalesTicketPushToSalesReturnRequest,
    AfterSalesTicketResponse,
    AfterSalesTicketUpdate,
)
from apps.kuaizhizao.services.document_action_policy.after_sales_ticket import (
    assert_after_sales_ticket_capability,
    derive_after_sales_ticket_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.types import CAPABILITY_REASON_MESSAGES
from apps.master_data.models.customer import Customer
from apps.master_data.models.material import Material
from core.services.authorization.data_scope_service import DataScopeService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User
from loguru import logger

AFTER_SALES_TICKET_SORTABLE_FIELDS = frozenset({
    "ticket_code",
    "customer_name",
    "request_type",
    "status",
    "registered_at",
    "closed_at",
    "sales_order_code",
    "claim_amount",
    "created_at",
    "updated_at",
})

RESOURCE_AFTER_SALES_TICKET = "kuaizhizao:after-sales-ticket"
RESOURCE_AFTER_SALES_TICKET_CUSTOMER = "kuaizhizao:after-sales-ticket-customer"


class AfterSalesTicketService:
    """售后服务工单业务逻辑"""

    @staticmethod
    def _gen_ticket_code() -> str:
        return f"SHFW{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

    @staticmethod
    async def _load_customer(
        tenant_id: int,
        customer_id: int,
        current_user: Optional[User],
    ) -> Customer:
        customer = await Customer.filter(
            id=customer_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not customer:
            raise NotFoundError(f"客户不存在: {customer_id}")
        if current_user:
            await DataScopeService.assert_row_visible(
                customer,
                tenant_id=tenant_id,
                user=current_user,
                resource=RESOURCE_AFTER_SALES_TICKET_CUSTOMER,
            )
        return customer

    @staticmethod
    async def _apply_list_scope(query, tenant_id: int, current_user: Optional[User]):
        if not current_user:
            return query
        return await DataScopeService.apply(
            query,
            tenant_id=tenant_id,
            user=current_user,
            resource=RESOURCE_AFTER_SALES_TICKET,
        )

    @staticmethod
    async def _resolve_sales_order(
        tenant_id: int,
        customer_id: int,
        sales_order_id: Optional[int],
    ) -> tuple[Optional[int], Optional[str]]:
        if sales_order_id is None:
            return None, None
        so = await SalesOrder.filter(
            id=sales_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not so:
            raise ValidationError(f"销售订单不存在: {sales_order_id}")
        if so.customer_id != customer_id:
            raise ValidationError("销售订单不属于所选客户")
        return so.id, so.order_code

    @staticmethod
    async def _resolve_sales_delivery(
        tenant_id: int,
        customer_id: int,
        sales_delivery_id: Optional[int],
    ) -> tuple[Optional[int], Optional[str]]:
        if sales_delivery_id is None:
            return None, None
        row = await SalesDelivery.filter(
            id=sales_delivery_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise ValidationError(f"销售出库单不存在: {sales_delivery_id}")
        if row.customer_id != customer_id:
            raise ValidationError("销售出库单不属于所选客户")
        return row.id, row.delivery_code

    @staticmethod
    def _validate_request_type(value: str) -> str:
        v = (value or "").strip()
        if v not in REQUEST_TYPES:
            raise ValidationError(f"无效的诉求类型: {value}")
        return v

    @staticmethod
    def _validate_status(value: str) -> str:
        v = (value or "").strip()
        if v not in TICKET_STATUSES:
            raise ValidationError(f"无效的工单状态: {value}")
        return v

    @classmethod
    async def _normalize_items(
        cls,
        tenant_id: int,
        items: Sequence[AfterSalesTicketItemCreate],
    ) -> List[dict]:
        normalized: List[dict] = []
        for idx, item in enumerate(items, start=1):
            material_id = item.material_id
            material_code = (item.material_code or "").strip() or None
            material_name = (item.material_name or "").strip() or None
            material_spec = (item.material_spec or "").strip() or None
            material_unit = (item.material_unit or "").strip() or None
            if material_id is not None:
                mat = await Material.filter(
                    id=material_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).first()
                if not mat:
                    raise ValidationError(f"物料不存在: {material_id}")
                material_code = material_code or mat.main_code or mat.code
                material_name = material_name or mat.name
                if not material_spec:
                    material_spec = mat.specification
                if not material_unit:
                    material_unit = mat.base_unit
            elif not material_code and not material_name:
                raise ValidationError(f"第 {idx} 行请选择物料")

            qty = item.quantity
            if qty is not None and qty < 0:
                raise ValidationError(f"第 {idx} 行数量不能为负")
            claim = item.claim_amount
            if claim is not None and claim < 0:
                raise ValidationError(f"第 {idx} 行索赔金额不能为负")

            normalized.append({
                "material_id": material_id,
                "material_code": material_code,
                "material_name": material_name,
                "material_spec": material_spec,
                "material_unit": material_unit,
                "sales_order_item_id": item.sales_order_item_id,
                "sales_delivery_item_id": item.sales_delivery_item_id,
                "batch_no": (item.batch_no or "").strip() or None,
                "quantity": qty,
                "claim_amount": claim,
                "notes": (item.notes or "").strip() or None,
                "line_no": idx,
            })
        return normalized

    @classmethod
    async def _replace_items(
        cls,
        tenant_id: int,
        ticket_id: int,
        items: Sequence[AfterSalesTicketItemCreate],
        current_user: User,
    ) -> List[AfterSalesTicketItem]:
        normalized = await cls._normalize_items(tenant_id, items)
        await AfterSalesTicketItem.filter(tenant_id=tenant_id, ticket_id=ticket_id).delete()
        created: List[AfterSalesTicketItem] = []
        for row in normalized:
            payload = {"tenant_id": tenant_id, "ticket_id": ticket_id, **row}
            apply_create_audit(payload, current_user)
            created.append(await AfterSalesTicketItem.create(**payload))
        return created

    @staticmethod
    def _sum_claim(items: Sequence[AfterSalesTicketItem]) -> Optional[Decimal]:
        total = Decimal("0")
        has_any = False
        for item in items:
            if item.claim_amount is not None:
                has_any = True
                total += Decimal(str(item.claim_amount))
        return total if has_any else None

    @classmethod
    async def _load_items(cls, tenant_id: int, ticket_id: int) -> List[AfterSalesTicketItem]:
        return await AfterSalesTicketItem.filter(
            tenant_id=tenant_id,
            ticket_id=ticket_id,
        ).order_by("line_no", "id")

    @classmethod
    async def _has_returnable_qty(cls, tenant_id: int, sales_order_id: Optional[int]) -> bool:
        if not sales_order_id:
            return False
        from apps.kuaizhizao.services.warehouse_service import SalesReturnService

        preview = await SalesReturnService().get_sales_order_return_preview(
            tenant_id=tenant_id,
            sales_order_id=int(sales_order_id),
        )
        return bool(preview.lines)

    @classmethod
    async def _to_response(
        cls,
        row: AfterSalesTicket,
        items: Optional[List[AfterSalesTicketItem]] = None,
        *,
        has_returnable_qty: Optional[bool] = None,
    ) -> AfterSalesTicketResponse:
        if items is None:
            items = await cls._load_items(row.tenant_id, row.id)
        item_resps = [AfterSalesTicketItemResponse.model_validate(i) for i in items]
        claim = cls._sum_claim(items)
        if claim is None:
            claim = row.claim_amount
        if has_returnable_qty is None:
            # 列表批量场景由调用方传入，避免 N+1；缺省仅在需要时计算
            need_returnable = (
                str(row.request_type or "").strip() in {"退货", "换货"}
                and row.sales_order_id
                and not row.sales_return_id
                and str(row.status or "").strip() != "已关闭"
                and bool(items)
            )
            has_returnable_qty = (
                await cls._has_returnable_qty(row.tenant_id, row.sales_order_id)
                if need_returnable
                else False
            )
        caps = derive_after_sales_ticket_capabilities(
            row,
            has_items=bool(items),
            has_returnable_qty=bool(has_returnable_qty),
        )
        base = AfterSalesTicketResponse.model_validate(row)
        return base.model_copy(
            update={
                "items": item_resps,
                "item_count": len(item_resps),
                "claim_amount": claim,
                "capabilities": caps.model_dump(),
            }
        )

    @staticmethod
    async def _create_document_relation(
        *,
        tenant_id: int,
        created_by: int,
        source_type: str,
        source_id: int,
        source_code: Optional[str],
        target_type: str,
        target_id: int,
        target_code: Optional[str],
        relation_mode: str,
        relation_desc: str,
    ) -> None:
        try:
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService

            await DocumentRelationNewService().create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type=source_type,
                    source_id=source_id,
                    source_code=source_code,
                    target_type=target_type,
                    target_id=target_id,
                    target_code=target_code,
                    relation_type="source",
                    relation_mode=relation_mode,
                    relation_desc=relation_desc,
                ),
                created_by=created_by,
            )
        except Exception as rel_err:
            logger.warning("建立售后单据关联失败: {}", rel_err)

    @classmethod
    async def create(
        cls,
        tenant_id: int,
        data: AfterSalesTicketCreate,
        current_user: User,
    ) -> AfterSalesTicketResponse:
        customer = await cls._load_customer(tenant_id, data.customer_id, current_user)
        request_type = cls._validate_request_type(data.request_type)
        content = (data.content or "").strip()
        if not content:
            raise ValidationError("请填写问题描述")
        sid, scode = await cls._resolve_sales_order(tenant_id, customer.id, data.sales_order_id)
        did, dcode = await cls._resolve_sales_delivery(tenant_id, customer.id, data.sales_delivery_id)
        registered_at = resolve_business_datetime(data.registered_at)
        items_payload = data.items or []

        async with in_transaction():
            row_data = {
                "tenant_id": tenant_id,
                "ticket_code": cls._gen_ticket_code(),
                "customer_id": customer.id,
                "customer_name": customer.name,
                "sales_order_id": sid,
                "sales_order_code": scode,
                "sales_delivery_id": did,
                "sales_delivery_code": dcode,
                "request_type": request_type,
                "status": "待处理",
                "content": content,
                "claim_amount": None,
                "registered_at": registered_at,
            }
            apply_create_audit(row_data, current_user)
            row = await AfterSalesTicket.create(**row_data)
            items = await cls._replace_items(tenant_id, row.id, items_payload, current_user)
            claim = cls._sum_claim(items)
            if claim is not None:
                await AfterSalesTicket.filter(id=row.id, tenant_id=tenant_id).update(claim_amount=claim)
                row.claim_amount = claim
        return await cls._to_response(row, items)

    @classmethod
    async def update(
        cls,
        tenant_id: int,
        ticket_id: int,
        data: AfterSalesTicketUpdate,
        current_user: User,
    ) -> AfterSalesTicketResponse:
        row = await AfterSalesTicket.filter(
            id=ticket_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"售后服务工单不存在: {ticket_id}")
        if row.status == "已关闭":
            raise ValidationError("已关闭的工单不可编辑")

        dump = data.model_dump(exclude_unset=True)
        items_payload = dump.pop("items", None)
        if "request_type" in dump and dump["request_type"] is not None:
            dump["request_type"] = cls._validate_request_type(dump["request_type"])
        if "status" in dump and dump["status"] is not None:
            status = cls._validate_status(dump["status"])
            if status == "已关闭":
                raise ValidationError("请使用关闭接口关闭工单")
            dump["status"] = status
        if "content" in dump:
            content = (dump["content"] or "").strip()
            if not content:
                raise ValidationError("请填写问题描述")
            dump["content"] = content
        if "registered_at" in dump and dump["registered_at"] is not None:
            dump["registered_at"] = resolve_business_datetime(dump["registered_at"])
        if "sales_order_id" in dump:
            sid, scode = await cls._resolve_sales_order(tenant_id, row.customer_id, dump["sales_order_id"])
            dump["sales_order_id"] = sid
            dump["sales_order_code"] = scode
        if "sales_delivery_id" in dump:
            did, dcode = await cls._resolve_sales_delivery(
                tenant_id, row.customer_id, dump["sales_delivery_id"]
            )
            dump["sales_delivery_id"] = did
            dump["sales_delivery_code"] = dcode
        if "resolution" in dump and dump["resolution"] is not None:
            dump["resolution"] = str(dump["resolution"]).strip() or None

        async with in_transaction():
            if dump:
                apply_update_audit(dump, current_user)
                await AfterSalesTicket.filter(id=ticket_id, tenant_id=tenant_id).update(**dump)
            items: Optional[List[AfterSalesTicketItem]] = None
            if items_payload is not None:
                items = await cls._replace_items(
                    tenant_id,
                    ticket_id,
                    [AfterSalesTicketItemCreate.model_validate(x) for x in items_payload],
                    current_user,
                )
                claim = cls._sum_claim(items)
                await AfterSalesTicket.filter(id=ticket_id, tenant_id=tenant_id).update(
                    claim_amount=claim
                )
            row = await AfterSalesTicket.get(id=ticket_id, tenant_id=tenant_id)
        return await cls._to_response(row, items)

    @classmethod
    async def close(
        cls,
        tenant_id: int,
        ticket_id: int,
        data: AfterSalesTicketClose,
        current_user: User,
    ) -> AfterSalesTicketResponse:
        row = await AfterSalesTicket.filter(
            id=ticket_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"售后服务工单不存在: {ticket_id}")
        if row.status == "已关闭":
            raise ValidationError("工单已关闭")

        dump: dict = {
            "status": "已关闭",
            "closed_at": resolve_business_datetime(),
        }
        if data.resolution is not None:
            dump["resolution"] = (data.resolution or "").strip() or None
        apply_update_audit(dump, current_user)
        await AfterSalesTicket.filter(id=ticket_id, tenant_id=tenant_id).update(**dump)
        row = await AfterSalesTicket.get(id=ticket_id, tenant_id=tenant_id)
        return await cls._to_response(row)

    @classmethod
    async def delete(cls, tenant_id: int, ticket_id: int, current_user: User) -> bool:
        row = await AfterSalesTicket.filter(
            id=ticket_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"售后服务工单不存在: {ticket_id}")
        dump = {"deleted_at": resolve_business_datetime()}
        apply_update_audit(dump, current_user)
        await AfterSalesTicket.filter(id=ticket_id, tenant_id=tenant_id).update(**dump)
        return True

    @classmethod
    async def get(
        cls,
        tenant_id: int,
        ticket_id: int,
        current_user: User,
    ) -> AfterSalesTicketResponse:
        query = AfterSalesTicket.filter(
            id=ticket_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        query = await cls._apply_list_scope(query, tenant_id, current_user)
        row = await query.first()
        if not row:
            raise NotFoundError(f"售后服务工单不存在: {ticket_id}")
        return await cls._to_response(row)

    @classmethod
    async def list_tickets(
        cls,
        *,
        tenant_id: int,
        skip: int,
        limit: int,
        customer_id: Optional[int] = None,
        request_type: Optional[str] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        sales_order_code: Optional[str] = None,
        registered_from: Optional[datetime] = None,
        registered_to: Optional[datetime] = None,
        order_by: Optional[str] = None,
        current_user: Optional[User] = None,
    ) -> AfterSalesTicketListEnvelope:
        query = AfterSalesTicket.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        query = await cls._apply_list_scope(query, tenant_id, current_user)

        if customer_id is not None:
            query = query.filter(customer_id=customer_id)
        if request_type:
            query = query.filter(request_type=request_type.strip())
        if status:
            query = query.filter(status=status.strip())
        if sales_order_code:
            query = query.filter(sales_order_code__icontains=sales_order_code.strip())
        if registered_from is not None:
            query = query.filter(registered_at__gte=registered_from)
        if registered_to is not None:
            query = query.filter(registered_at__lte=registered_to)
        if keyword:
            kw = keyword.strip()
            if kw:
                item_ticket_ids = await AfterSalesTicketItem.filter(tenant_id=tenant_id).filter(
                    Q(material_code__icontains=kw) | Q(material_name__icontains=kw)
                ).values_list("ticket_id", flat=True)
                query = query.filter(
                    Q(ticket_code__icontains=kw)
                    | Q(customer_name__icontains=kw)
                    | Q(content__icontains=kw)
                    | Q(sales_order_code__icontains=kw)
                    | Q(id__in=list(item_ticket_ids))
                )

        total = await query.count()
        if order_by:
            query = query.order_by(order_by)
        else:
            query = query.order_by("-registered_at", "-id")
        rows = await query.offset(skip).limit(limit)
        ticket_ids = [r.id for r in rows]
        items_by_ticket: dict[int, List[AfterSalesTicketItem]] = {tid: [] for tid in ticket_ids}
        if ticket_ids:
            all_items = await AfterSalesTicketItem.filter(
                tenant_id=tenant_id,
                ticket_id__in=ticket_ids,
            ).order_by("line_no", "id")
            for item in all_items:
                items_by_ticket.setdefault(item.ticket_id, []).append(item)

        candidate_so_ids = {
            int(r.sales_order_id)
            for r in rows
            if r.sales_order_id
            and not r.sales_return_id
            and str(r.status or "").strip() != "已关闭"
            and str(r.request_type or "").strip() in {"退货", "换货"}
            and items_by_ticket.get(r.id)
        }
        returnable_so_ids: set[int] = set()
        for so_id in candidate_so_ids:
            if await cls._has_returnable_qty(tenant_id, so_id):
                returnable_so_ids.add(so_id)

        return AfterSalesTicketListEnvelope(
            items=[
                await cls._to_response(
                    r,
                    items_by_ticket.get(r.id, []),
                    has_returnable_qty=bool(
                        r.sales_order_id and int(r.sales_order_id) in returnable_so_ids
                    ),
                )
                for r in rows
            ],
            total=total,
        )

    @classmethod
    async def pull_from_sales_order(
        cls,
        tenant_id: int,
        data: AfterSalesTicketPullFromSalesOrderRequest,
        current_user: User,
    ) -> AfterSalesTicketResponse:
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

        so = await SalesOrder.filter(
            id=data.sales_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not so:
            raise NotFoundError(f"销售订单不存在: {data.sales_order_id}")
        shipped_delivery = await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_id=so.id,
            deleted_at__isnull=True,
            status="已出库",
        ).exists()
        if not shipped_delivery:
            raise ValidationError("仅已发货（已出库）的销售订单可上拉创建售后服务工单")
        await cls._load_customer(tenant_id, so.customer_id, current_user)

        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=so.id,
            deleted_at__isnull=True,
        ).order_by("id")
        if data.selected_item_ids:
            selected = {int(x) for x in data.selected_item_ids}
            order_items = [it for it in order_items if int(it.id) in selected]
        if not order_items:
            raise ValidationError("销售订单没有可选明细，无法上拉售后服务工单")

        request_type = cls._validate_request_type(data.request_type or "退货")
        content = (data.content or "").strip() or f"由销售订单 {so.order_code} 上拉登记的售后诉求"
        items = [
            AfterSalesTicketItemCreate(
                material_id=it.material_id,
                material_code=it.material_code,
                material_name=it.material_name,
                material_spec=it.material_spec,
                material_unit=it.material_unit,
                sales_order_item_id=it.id,
                quantity=it.order_quantity,
            )
            for it in order_items
        ]
        created = await cls.create(
            tenant_id,
            AfterSalesTicketCreate(
                customer_id=so.customer_id,
                request_type=request_type,
                content=content,
                sales_order_id=so.id,
                items=items,
            ),
            current_user,
        )
        await cls._create_document_relation(
            tenant_id=tenant_id,
            created_by=current_user.id,
            source_type="sales_order",
            source_id=so.id,
            source_code=so.order_code,
            target_type="after_sales_ticket",
            target_id=created.id,
            target_code=created.ticket_code,
            relation_mode="pull",
            relation_desc="销售订单上拉售后服务工单",
        )
        return created

    @classmethod
    async def pull_from_sales_delivery(
        cls,
        tenant_id: int,
        data: AfterSalesTicketPullFromSalesDeliveryRequest,
        current_user: User,
    ) -> AfterSalesTicketResponse:
        from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem

        delivery = await SalesDelivery.filter(
            id=data.sales_delivery_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {data.sales_delivery_id}")
        await cls._load_customer(tenant_id, delivery.customer_id, current_user)

        delivery_items = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id=delivery.id,
            deleted_at__isnull=True,
        ).order_by("id")
        if data.selected_item_ids:
            selected = {int(x) for x in data.selected_item_ids}
            delivery_items = [it for it in delivery_items if int(it.id) in selected]
        if not delivery_items:
            raise ValidationError("销售出库单没有可选明细，无法上拉售后服务工单")

        request_type = cls._validate_request_type(data.request_type or "退货")
        content = (
            (data.content or "").strip()
            or f"由销售出库单 {delivery.delivery_code} 上拉登记的售后诉求"
        )
        items = [
            AfterSalesTicketItemCreate(
                material_id=it.material_id,
                material_code=it.material_code,
                material_name=it.material_name,
                material_spec=it.material_spec,
                material_unit=it.material_unit,
                sales_delivery_item_id=it.id,
                batch_no=it.batch_number,
                quantity=it.delivery_quantity,
            )
            for it in delivery_items
        ]
        created = await cls.create(
            tenant_id,
            AfterSalesTicketCreate(
                customer_id=delivery.customer_id,
                request_type=request_type,
                content=content,
                sales_order_id=delivery.sales_order_id,
                sales_delivery_id=delivery.id,
                items=items,
            ),
            current_user,
        )
        await cls._create_document_relation(
            tenant_id=tenant_id,
            created_by=current_user.id,
            source_type="sales_delivery",
            source_id=delivery.id,
            source_code=delivery.delivery_code,
            target_type="after_sales_ticket",
            target_id=created.id,
            target_code=created.ticket_code,
            relation_mode="pull",
            relation_desc="销售出库单上拉售后服务工单",
        )
        return created

    @classmethod
    async def preview_push_to_sales_return(
        cls,
        tenant_id: int,
        ticket_id: int,
        current_user: User,
    ) -> AfterSalesTicketPushPreviewResponse:
        row = await AfterSalesTicket.filter(
            id=ticket_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"售后服务工单不存在: {ticket_id}")
        items = await cls._load_items(tenant_id, ticket_id)
        has_returnable = await cls._has_returnable_qty(tenant_id, row.sales_order_id)
        caps = derive_after_sales_ticket_capabilities(
            row,
            has_items=bool(items),
            has_returnable_qty=has_returnable,
        )
        blocking_reason = caps.push_sales_return.reason
        has_blocking = not caps.push_sales_return.allowed

        lines: List[AfterSalesTicketPushPreviewLine] = []
        message = None
        if row.sales_order_id and not has_blocking:
            from apps.kuaizhizao.services.warehouse_service import SalesReturnService

            preview = await SalesReturnService().get_sales_order_return_preview(
                tenant_id=tenant_id,
                sales_order_id=int(row.sales_order_id),
            )
            returnable_by_item = {
                int(line.sales_order_item_id): line
                for line in preview.lines
                if line.sales_order_item_id is not None
            }
            returnable_by_material: dict[int, list] = {}
            for line in preview.lines:
                if line.material_id is None:
                    continue
                returnable_by_material.setdefault(int(line.material_id), []).append(line)

            used_so_item_ids: set[int] = set()
            for item in items:
                so_item_id = int(item.sales_order_item_id) if item.sales_order_item_id else None
                preview_line = returnable_by_item.get(so_item_id) if so_item_id else None
                if preview_line is None and item.material_id is not None:
                    candidates = returnable_by_material.get(int(item.material_id), [])
                    for cand in candidates:
                        cid = int(cand.sales_order_item_id) if cand.sales_order_item_id else None
                        if cid is not None and cid not in used_so_item_ids:
                            preview_line = cand
                            so_item_id = cid
                            break
                if preview_line is None:
                    continue
                if so_item_id is not None:
                    used_so_item_ids.add(so_item_id)
                returnable = Decimal(str(preview_line.source_pending_quantity or 0))
                ticket_qty = Decimal(str(item.quantity or 0)) if item.quantity is not None else returnable
                chosen = min(returnable, ticket_qty) if ticket_qty > 0 else returnable
                if chosen <= 0:
                    continue
                lines.append(
                    AfterSalesTicketPushPreviewLine(
                        ticket_item_id=item.id,
                        sales_order_item_id=so_item_id,
                        material_id=item.material_id or preview_line.material_id,
                        material_code=item.material_code or preview_line.material_code,
                        material_name=item.material_name or preview_line.material_name,
                        material_spec=item.material_spec or preview_line.material_spec,
                        material_unit=item.material_unit or preview_line.material_unit,
                        batch_no=item.batch_no,
                        ticket_quantity=item.quantity,
                        returnable_quantity=returnable,
                        return_quantity=chosen,
                    )
                )
            if not lines:
                has_blocking = True
                blocking_reason = "after_sales_ticket.push_sales_return.no_returnable"
                message = "明细与可退货行无法对应，请检查销售订单出库与退货情况"
        elif has_blocking:
            message = CAPABILITY_REASON_MESSAGES.get(blocking_reason or "", blocking_reason)

        return AfterSalesTicketPushPreviewResponse(
            ticket_id=row.id,
            ticket_code=row.ticket_code,
            sales_order_id=int(row.sales_order_id or 0),
            sales_order_code=row.sales_order_code,
            has_blocking_issues=has_blocking,
            blocking_reason=blocking_reason,
            lines=lines,
            message=message or (
                CAPABILITY_REASON_MESSAGES.get(blocking_reason or "", None) if has_blocking else None
            ),
        )

    @classmethod
    async def push_to_sales_return(
        cls,
        tenant_id: int,
        ticket_id: int,
        data: AfterSalesTicketPushToSalesReturnRequest,
        current_user: User,
    ) -> dict:
        row = await AfterSalesTicket.filter(
            id=ticket_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"售后服务工单不存在: {ticket_id}")
        items = await cls._load_items(tenant_id, ticket_id)
        has_returnable = await cls._has_returnable_qty(tenant_id, row.sales_order_id)
        assert_after_sales_ticket_capability(
            row,
            "push_sales_return",
            has_items=bool(items),
            has_returnable_qty=has_returnable,
        )
        if not row.sales_order_id:
            raise ValidationError("售后服务工单未关联销售订单")
        if data.warehouse_id <= 0:
            raise ValidationError("必须提供有效的退货仓库ID")

        preview = await cls.preview_push_to_sales_return(tenant_id, ticket_id, current_user)
        if preview.has_blocking_issues:
            raise BusinessLogicError(preview.message or "当前工单不可下推销售退货单")
        if not preview.lines:
            raise BusinessLogicError("没有可下推的退货明细")

        return_quantities: dict[int, float] = {}
        batch_numbers: dict[int, str] = {}
        if data.return_quantities:
            for k, v in data.return_quantities.items():
                try:
                    return_quantities[int(k)] = float(v)
                except Exception:
                    continue
        else:
            for line in preview.lines:
                if line.sales_order_item_id is None:
                    continue
                return_quantities[int(line.sales_order_item_id)] = float(line.return_quantity or 0)
        if data.batch_numbers:
            for k, v in data.batch_numbers.items():
                text = str(v or "").strip()
                if text:
                    batch_numbers[int(k)] = text
        else:
            for line in preview.lines:
                if line.sales_order_item_id is None:
                    continue
                batch = str(line.batch_no or "").strip()
                if batch:
                    batch_numbers[int(line.sales_order_item_id)] = batch

        from apps.kuaizhizao.services.warehouse_service import SalesReturnService

        async with in_transaction():
            sales_return = await SalesReturnService().pull_from_sales_order(
                tenant_id=tenant_id,
                sales_order_id=int(row.sales_order_id),
                created_by=current_user.id,
                warehouse_id=data.warehouse_id,
                warehouse_name=data.warehouse_name,
                return_quantities=return_quantities or None,
                batch_numbers=batch_numbers or None,
                return_code=data.return_code,
            )
            dump = {
                "sales_return_id": sales_return.id,
                "sales_return_code": sales_return.return_code,
            }
            if str(row.status or "").strip() == "待处理":
                dump["status"] = "处理中"
            apply_update_audit(dump, current_user)
            await AfterSalesTicket.filter(id=ticket_id, tenant_id=tenant_id).update(**dump)

        await cls._create_document_relation(
            tenant_id=tenant_id,
            created_by=current_user.id,
            source_type="after_sales_ticket",
            source_id=row.id,
            source_code=row.ticket_code,
            target_type="sales_return",
            target_id=sales_return.id,
            target_code=sales_return.return_code,
            relation_mode="push",
            relation_desc="售后服务工单下推销售退货单",
        )
        return {
            "success": True,
            "message": "已生成销售退货单",
            "ticket_id": ticket_id,
            "return_id": sales_return.id,
            "return_code": sales_return.return_code,
        }
