"""
送货单服务模块

在销售出库前/后向客户发送发货通知，记录物流信息。不直接动库存。

Author: RiverEdge Team
Date: 2026-02-19
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from decimal import Decimal
from tortoise.transactions import in_transaction
from tortoise.expressions import Q

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
from apps.kuaizhizao.models.delivery_notice_item import DeliveryNoticeItem
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaizhizao.schemas.delivery_notice import (
    DeliveryNoticeCreate,
    DeliveryNoticeUpdate,
    DeliveryNoticeResponse,
    DeliveryNoticeListResponse,
    DeliveryNoticeWithItemsResponse,
    DeliveryNoticeItemCreate,
    DeliveryNoticeItemResponse,
    DeliveryNoticePullCandidate,
    DeliveryNoticePullPreviewLine,
    DeliveryNoticePullPreviewResponse,
)
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class DeliveryNoticeService(AppBaseService[DeliveryNotice]):
    """送货单服务"""

    def __init__(self):
        super().__init__(DeliveryNotice)
        self.business_config_service = BusinessConfigService()

    async def batch_sales_deliveries_have_notice(
        self,
        tenant_id: int,
        sales_delivery_ids: List[int],
    ) -> Dict[int, bool]:
        if not sales_delivery_ids:
            return {}
        rows = await DeliveryNotice.filter(
            tenant_id=tenant_id,
            sales_delivery_id__in=sales_delivery_ids,
            deleted_at__isnull=True,
        ).values_list("sales_delivery_id", flat=True)
        linked = {int(row) for row in rows if row is not None}
        return {int(delivery_id): int(delivery_id) in linked for delivery_id in sales_delivery_ids}

    async def batch_sales_deliveries_have_noticeable_lines(
        self,
        tenant_id: int,
        sales_delivery_ids: List[int],
    ) -> Dict[int, bool]:
        if not sales_delivery_ids:
            return {}
        rows = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id__in=sales_delivery_ids,
            delivery_quantity__gt=0,
        ).values_list("delivery_id", flat=True)
        with_lines = {int(row) for row in rows if row is not None}
        return {int(delivery_id): int(delivery_id) in with_lines for delivery_id in sales_delivery_ids}

    async def list_delivery_notice_pull_candidates(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.document_action_policy.sales_delivery import (
            derive_sales_delivery_pull_capabilities,
        )

        query = SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(
                    Q(delivery_code__icontains=kw)
                    | Q(sales_order_code__icontains=kw)
                    | Q(customer_name__icontains=kw)
                )
        total = await query.count()
        deliveries = await query.offset(skip).limit(limit).order_by("-created_at")
        delivery_ids = [int(d.id) for d in deliveries if d.id is not None]
        notice_by_id = await self.batch_sales_deliveries_have_notice(tenant_id, delivery_ids)
        lines_by_id = await self.batch_sales_deliveries_have_noticeable_lines(tenant_id, delivery_ids)

        candidates: List[DeliveryNoticePullCandidate] = []
        for delivery in deliveries:
            delivery_id = int(delivery.id)
            has_notice = notice_by_id.get(delivery_id, False)
            has_lines = lines_by_id.get(delivery_id, False)
            caps = derive_sales_delivery_pull_capabilities(
                delivery,
                has_delivery_notice=has_notice,
                has_noticeable_lines=has_lines,
            )
            pullable = bool(caps.push_delivery_notice.allowed)
            candidates.append(
                DeliveryNoticePullCandidate(
                    id=delivery_id,
                    delivery_code=str(delivery.delivery_code or ""),
                    sales_order_id=delivery.sales_order_id,
                    sales_order_code=delivery.sales_order_code,
                    customer_id=int(delivery.customer_id),
                    customer_name=str(delivery.customer_name or ""),
                    status=str(delivery.status or ""),
                    delivery_date=getattr(delivery, "delivery_date", None),
                    updated_at=delivery.updated_at,
                    pullable=pullable,
                    capabilities=caps,
                )
            )
        return {
            "data": [item.model_dump() for item in candidates],
            "total": total,
            "success": True,
        }

    async def get_delivery_notice_pull_preview(
        self,
        tenant_id: int,
        sales_delivery_id: int,
    ) -> DeliveryNoticePullPreviewResponse:
        from apps.kuaizhizao.services.document_action_policy.sales_delivery import (
            assert_sales_delivery_pull_capability,
        )

        delivery = await SalesDelivery.get_or_none(
            tenant_id=tenant_id,
            id=sales_delivery_id,
            deleted_at__isnull=True,
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {sales_delivery_id}")

        has_notice = bool(
            await DeliveryNotice.filter(
                tenant_id=tenant_id,
                sales_delivery_id=sales_delivery_id,
                deleted_at__isnull=True,
            ).exists()
        )
        items = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id=sales_delivery_id,
            delivery_quantity__gt=0,
        ).all()
        has_lines = len(items) > 0
        assert_sales_delivery_pull_capability(
            delivery,
            "push_delivery_notice",
            has_delivery_notice=has_notice,
            has_noticeable_lines=has_lines,
        )

        preview_lines: List[DeliveryNoticePullPreviewLine] = []
        for item in items:
            qty = float(item.delivery_quantity or 0)
            if qty <= 0:
                continue
            preview_lines.append(
                DeliveryNoticePullPreviewLine(
                    item_id=int(item.id),
                    material_id=int(item.material_id),
                    material_code=str(item.material_code or ""),
                    material_name=str(item.material_name or ""),
                    material_unit=str(item.material_unit or "个"),
                    quantity=qty,
                    pushed_quantity=0.0,
                    max_push_quantity=qty,
                    unit_price=float(item.unit_price or 0),
                )
            )

        message = None
        if not preview_lines:
            message = "sales_delivery.push_delivery_notice.no_lines"

        return DeliveryNoticePullPreviewResponse(
            sales_delivery_id=sales_delivery_id,
            sales_delivery_code=str(delivery.delivery_code or sales_delivery_id),
            customer_id=int(delivery.customer_id),
            customer_name=str(delivery.customer_name or ""),
            customer_contact=getattr(delivery, "customer_contact", None),
            customer_phone=getattr(delivery, "customer_phone", None),
            sales_order_id=delivery.sales_order_id,
            sales_order_code=delivery.sales_order_code,
            planned_delivery_date=getattr(delivery, "delivery_date", None),
            shipping_address=getattr(delivery, "shipping_address", None),
            items=preview_lines,
            message=message,
        )

    async def create_delivery_notice(
        self,
        tenant_id: int,
        notice_data: DeliveryNoticeCreate,
        created_by: int
    ) -> DeliveryNoticeResponse:
        """创建送货单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "delivery_notice")
        if not is_enabled:
            raise BusinessLogicError("送货单节点未启用，无法创建送货单")
        if notice_data.sales_delivery_id:
            source_delivery = await SalesDelivery.get_or_none(
                tenant_id=tenant_id,
                id=notice_data.sales_delivery_id,
                deleted_at__isnull=True,
            )
            if not source_delivery:
                raise BusinessLogicError("销售出库单不存在或已删除，无法创建送货单")
            has_notice = bool(
                await DeliveryNotice.filter(
                    tenant_id=tenant_id,
                    sales_delivery_id=notice_data.sales_delivery_id,
                    deleted_at__isnull=True,
                ).exists()
            )
            has_lines = bool(
                await SalesDeliveryItem.filter(
                    tenant_id=tenant_id,
                    delivery_id=notice_data.sales_delivery_id,
                    delivery_quantity__gt=0,
                ).exists()
            )
            from apps.kuaizhizao.services.document_action_policy.sales_delivery import (
                assert_sales_delivery_pull_capability,
            )

            assert_sales_delivery_pull_capability(
                source_delivery,
                "push_delivery_notice",
                has_delivery_notice=has_notice,
                has_noticeable_lines=has_lines,
            )
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "DELIVERY_NOTICE_CODE", prefix=f"DN{today}")

            dump = notice_data.model_dump(exclude_unset=True, exclude={"items", "notice_code"})
            if notice_data.notice_code:
                code = notice_data.notice_code

            user_info = await self.get_user_info(created_by)
            notice = await DeliveryNotice.create(
                tenant_id=tenant_id,
                notice_code=code,
                **dump,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            items = getattr(notice_data, "items", None) or []
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            for item_data in items:
                qty = Decimal(str(item_data.notice_quantity))
                amt = item_data.total_amount if item_data.total_amount is not None else qty * Decimal(str(item_data.unit_price or 0))
                await DeliveryNoticeItem.create(
                    tenant_id=tenant_id,
                    notice_id=notice.id,
                    notice_quantity=qty,
                    unit_price=Decimal(str(item_data.unit_price or 0)),
                    total_amount=amt,
                    **item_data.model_dump(exclude_unset=True, exclude={"notice_quantity", "unit_price", "total_amount"})
                )
                total_quantity += qty
                total_amount += amt

            await DeliveryNotice.filter(tenant_id=tenant_id, id=notice.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )
            notice = await DeliveryNotice.get(tenant_id=tenant_id, id=notice.id)
            return DeliveryNoticeResponse.model_validate(notice)

    async def get_delivery_notice_by_id(
        self,
        tenant_id: int,
        notice_id: int
    ) -> DeliveryNoticeWithItemsResponse:
        """根据ID获取送货单（含明细）"""
        notice = await DeliveryNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"送货单不存在: {notice_id}")

        items = await DeliveryNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).all()
        response = DeliveryNoticeWithItemsResponse.model_validate(notice)
        response.items = [DeliveryNoticeItemResponse.model_validate(i) for i in items]
        from apps.kuaizhizao.services.document_lifecycle_service import get_delivery_notice_lifecycle

        response.lifecycle = get_delivery_notice_lifecycle(notice, milestones=[])
        return response

    async def list_delivery_notices(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> tuple[List[DeliveryNoticeListResponse], int]:
        """获取送货单列表"""
        from apps.kuaizhizao.services.warehouse_list_core import apply_delivery_notice_list_filters

        query = DeliveryNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("sales_delivery_id"):
            query = query.filter(sales_delivery_id=filters["sales_delivery_id"])
        if filters.get("sales_order_id"):
            query = query.filter(sales_order_id=filters["sales_order_id"])
        if filters.get("customer_id"):
            query = query.filter(customer_id=filters["customer_id"])

        query, order_clause = apply_delivery_notice_list_filters(
            query,
            keyword=filters.get("keyword"),
            search=filters.get("search"),
            order_by=filters.get("order_by"),
            sent_start_date=filters.get("sent_start_date"),
            sent_end_date=filters.get("sent_end_date"),
            planned_delivery_start_date=filters.get("planned_delivery_start_date"),
            planned_delivery_end_date=filters.get("planned_delivery_end_date"),
            created_start_date=filters.get("created_start_date"),
            created_end_date=filters.get("created_end_date"),
            updated_start_date=filters.get("updated_start_date"),
            updated_end_date=filters.get("updated_end_date"),
        )
        total = await query.count()
        notices = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_lifecycle_service import get_delivery_notice_lifecycle

        responses = [DeliveryNoticeListResponse.model_validate(r) for r in notices]
        for notice, resp in zip(notices, responses):
            resp.lifecycle = get_delivery_notice_lifecycle(notice, milestones=[])
        return responses, total

    async def update_delivery_notice(
        self,
        tenant_id: int,
        notice_id: int,
        notice_data: DeliveryNoticeUpdate,
        updated_by: int
    ) -> DeliveryNoticeResponse:
        """更新送货单"""
        notice = await self.get_delivery_notice_by_id(tenant_id, notice_id)
        if notice.status != "待发送":
            raise BusinessLogicError("只能更新待发送状态的送货单")

        async with in_transaction():
            dump = notice_data.model_dump(exclude_unset=True, exclude={"notice_code"})
            user_info = await self.get_user_info(updated_by)
            dump["updated_by"] = updated_by
            dump["updated_by_name"] = user_info["name"]
            await DeliveryNotice.filter(tenant_id=tenant_id, id=notice_id).update(**dump)
            return DeliveryNoticeResponse.model_validate(
                await DeliveryNotice.get(tenant_id=tenant_id, id=notice_id)
            )

    async def delete_delivery_notice(self, tenant_id: int, notice_id: int) -> bool:
        """删除送货单"""
        notice = await DeliveryNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"送货单不存在: {notice_id}")
        if notice.status != "待发送":
            raise BusinessLogicError("只能删除待发送状态的送货单")

        await DeliveryNotice.filter(tenant_id=tenant_id, id=notice_id).update(deleted_at=datetime.now())
        return True

    async def send_notice(
        self,
        tenant_id: int,
        notice_id: int,
        sent_by: int
    ) -> DeliveryNoticeResponse:
        """发送通知（标记为已发送，可对接邮件/短信/打印）"""
        notice = await DeliveryNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"送货单不存在: {notice_id}")
        if notice.status != "待发送":
            raise BusinessLogicError("只有待发送状态的通知单才能发送")

        await DeliveryNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="已发送",
            sent_at=datetime.now(),
            updated_by=sent_by,
            updated_by_name=(await self.get_user_info(sent_by))["name"],
        )
        return DeliveryNoticeResponse.model_validate(
            await DeliveryNotice.get(tenant_id=tenant_id, id=notice_id)
        )
