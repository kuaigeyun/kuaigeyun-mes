"""
发货通知单服务模块

销售通知仓库发货，不直接动库存。来源为销售订单。

Author: RiverEdge Team
Date: 2026-02-22
"""

from typing import List
from datetime import datetime
from decimal import Decimal
from tortoise.transactions import in_transaction

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
from apps.kuaizhizao.models.shipment_notice_item import ShipmentNoticeItem
from apps.kuaizhizao.schemas.shipment_notice import (
    ShipmentNoticeCreate,
    ShipmentNoticeUpdate,
    ShipmentNoticeResponse,
    ShipmentNoticeListResponse,
    ShipmentNoticeWithItemsResponse,
    ShipmentNoticeItemCreate,
    ShipmentNoticeItemResponse,
)
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class ShipmentNoticeService(AppBaseService[ShipmentNotice]):
    """发货通知单服务"""

    def __init__(self):
        super().__init__(ShipmentNotice)
        self.business_config_service = BusinessConfigService()

    async def create_shipment_notice(
        self,
        tenant_id: int,
        notice_data: ShipmentNoticeCreate,
        created_by: int
    ) -> ShipmentNoticeResponse:
        """创建发货通知单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "shipment_notice")
        if not is_enabled:
            raise BusinessLogicError("发货通知单节点未启用，无法创建发货通知单")
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "SHIPMENT_NOTICE_CODE", prefix=f"SN{today}")

            dump = notice_data.model_dump(exclude_unset=True, exclude={"items", "notice_code"})
            if notice_data.notice_code:
                code = notice_data.notice_code

            notice = await ShipmentNotice.create(
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
                await ShipmentNoticeItem.create(
                    tenant_id=tenant_id,
                    notice_id=notice.id,
                    notice_quantity=qty,
                    unit_price=Decimal(str(item_data.unit_price or 0)),
                    total_amount=amt,
                    **item_data.model_dump(exclude_unset=True, exclude={"notice_quantity", "unit_price", "total_amount"})
                )
                total_quantity += qty
                total_amount += amt

            await ShipmentNotice.filter(tenant_id=tenant_id, id=notice.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )
            notice = await ShipmentNotice.get(tenant_id=tenant_id, id=notice.id)
            return ShipmentNoticeResponse.model_validate(notice)

    async def get_shipment_notice_by_id(
        self,
        tenant_id: int,
        notice_id: int
    ) -> ShipmentNoticeWithItemsResponse:
        """根据ID获取发货通知单（含明细）"""
        notice = await ShipmentNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")

        items = await ShipmentNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).all()
        response = ShipmentNoticeWithItemsResponse.model_validate(notice)
        response.items = [ShipmentNoticeItemResponse.model_validate(i) for i in items]
        return response

    async def list_shipment_notices(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[ShipmentNoticeListResponse]:
        """获取发货通知单列表"""
        query = ShipmentNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("sales_order_id"):
            query = query.filter(sales_order_id=filters["sales_order_id"])
        if filters.get("customer_id"):
            query = query.filter(customer_id=filters["customer_id"])

        notices = await query.offset(skip).limit(limit).order_by("-created_at")
        return [ShipmentNoticeListResponse.model_validate(r) for r in notices]

    async def update_shipment_notice(
        self,
        tenant_id: int,
        notice_id: int,
        notice_data: ShipmentNoticeUpdate,
        updated_by: int
    ) -> ShipmentNoticeResponse:
        """更新发货通知单"""
        notice = await self.get_shipment_notice_by_id(tenant_id, notice_id)
        if notice.status != "待发货":
            raise BusinessLogicError("只能更新待发货状态的发货通知单")

        async with in_transaction():
            dump = notice_data.model_dump(exclude_unset=True, exclude={"notice_code"})
            dump["updated_by"] = updated_by
            await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(**dump)
            return ShipmentNoticeResponse.model_validate(
                await ShipmentNotice.get(tenant_id=tenant_id, id=notice_id)
            )

    async def delete_shipment_notice(self, tenant_id: int, notice_id: int) -> bool:
        """删除发货通知单"""
        notice = await ShipmentNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        if notice.status != "待发货":
            raise BusinessLogicError("只能删除待发货状态的发货通知单")

        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(deleted_at=datetime.now())
        return True

    async def notify_warehouse(
        self,
        tenant_id: int,
        notice_id: int,
        notified_by: int
    ) -> ShipmentNoticeResponse:
        """通知仓库（标记为已通知）"""
        notice = await ShipmentNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        if notice.status != "待发货":
            raise BusinessLogicError("只有待发货状态的通知单才能通知仓库")

        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="已通知",
            notified_at=datetime.now(),
            updated_by=notified_by
        )
        return ShipmentNoticeResponse.model_validate(
            await ShipmentNotice.get(tenant_id=tenant_id, id=notice_id)
        )
