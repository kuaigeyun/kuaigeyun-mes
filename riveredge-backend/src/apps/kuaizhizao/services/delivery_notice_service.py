"""
发货通知单服务模块

在销售出库前/后向客户发送发货通知，记录物流信息。不直接动库存。

Author: RiverEdge Team
Date: 2026-02-19
"""

from typing import List
from datetime import datetime
from decimal import Decimal
from tortoise.transactions import in_transaction

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
from apps.kuaizhizao.models.delivery_notice_item import DeliveryNoticeItem
from apps.kuaizhizao.schemas.delivery_notice import (
    DeliveryNoticeCreate,
    DeliveryNoticeUpdate,
    DeliveryNoticeResponse,
    DeliveryNoticeListResponse,
    DeliveryNoticeWithItemsResponse,
    DeliveryNoticeItemCreate,
    DeliveryNoticeItemResponse,
)
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError


class DeliveryNoticeService(AppBaseService[DeliveryNotice]):
    """发货通知单服务"""

    def __init__(self):
        super().__init__(DeliveryNotice)

    async def create_delivery_notice(
        self,
        tenant_id: int,
        notice_data: DeliveryNoticeCreate,
        created_by: int
    ) -> DeliveryNoticeResponse:
        """创建发货通知单"""
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "DELIVERY_NOTICE_CODE", prefix=f"DN{today}")

            dump = notice_data.model_dump(exclude_unset=True, exclude={"items", "notice_code"})
            if notice_data.notice_code:
                code = notice_data.notice_code

            notice = await DeliveryNotice.create(
                tenant_id=tenant_id,
                notice_code=code,
                created_by=created_by,
                **dump
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
        """根据ID获取发货通知单（含明细）"""
        notice = await DeliveryNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")

        items = await DeliveryNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).all()
        response = DeliveryNoticeWithItemsResponse.model_validate(notice)
        response.items = [DeliveryNoticeItemResponse.model_validate(i) for i in items]
        return response

    async def list_delivery_notices(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[DeliveryNoticeListResponse]:
        """获取发货通知单列表"""
        query = DeliveryNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("sales_delivery_id"):
            query = query.filter(sales_delivery_id=filters["sales_delivery_id"])
        if filters.get("sales_order_id"):
            query = query.filter(sales_order_id=filters["sales_order_id"])
        if filters.get("customer_id"):
            query = query.filter(customer_id=filters["customer_id"])

        notices = await query.offset(skip).limit(limit).order_by("-created_at")
        return [DeliveryNoticeListResponse.model_validate(r) for r in notices]

    async def update_delivery_notice(
        self,
        tenant_id: int,
        notice_id: int,
        notice_data: DeliveryNoticeUpdate,
        updated_by: int
    ) -> DeliveryNoticeResponse:
        """更新发货通知单"""
        notice = await self.get_delivery_notice_by_id(tenant_id, notice_id)
        if notice.status != "待发送":
            raise BusinessLogicError("只能更新待发送状态的发货通知单")

        async with in_transaction():
            dump = notice_data.model_dump(exclude_unset=True, exclude={"notice_code"})
            dump["updated_by"] = updated_by
            await DeliveryNotice.filter(tenant_id=tenant_id, id=notice_id).update(**dump)
            return DeliveryNoticeResponse.model_validate(
                await DeliveryNotice.get(tenant_id=tenant_id, id=notice_id)
            )

    async def delete_delivery_notice(self, tenant_id: int, notice_id: int) -> bool:
        """删除发货通知单"""
        notice = await DeliveryNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        if notice.status != "待发送":
            raise BusinessLogicError("只能删除待发送状态的发货通知单")

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
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        if notice.status != "待发送":
            raise BusinessLogicError("只有待发送状态的通知单才能发送")

        await DeliveryNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="已发送",
            sent_at=datetime.now(),
            updated_by=sent_by
        )
        return DeliveryNoticeResponse.model_validate(
            await DeliveryNotice.get(tenant_id=tenant_id, id=notice_id)
        )
