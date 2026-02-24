"""
收货通知单服务模块

采购通知仓库收货，不直接动库存。来源为采购订单。

Author: RiverEdge Team
Date: 2026-02-22
"""

from typing import List
from datetime import datetime
from decimal import Decimal
from tortoise.transactions import in_transaction

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.receipt_notice import ReceiptNotice
from apps.kuaizhizao.models.receipt_notice_item import ReceiptNoticeItem
from apps.kuaizhizao.schemas.receipt_notice import (
    ReceiptNoticeCreate,
    ReceiptNoticeUpdate,
    ReceiptNoticeResponse,
    ReceiptNoticeListResponse,
    ReceiptNoticeWithItemsResponse,
    ReceiptNoticeItemCreate,
    ReceiptNoticeItemResponse,
)
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class ReceiptNoticeService(AppBaseService[ReceiptNotice]):
    """收货通知单服务"""

    def __init__(self):
        super().__init__(ReceiptNotice)
        self.business_config_service = BusinessConfigService()

    async def create_receipt_notice(
        self,
        tenant_id: int,
        notice_data: ReceiptNoticeCreate,
        created_by: int
    ) -> ReceiptNoticeResponse:
        """创建收货通知单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "receipt_notice")
        if not is_enabled:
            raise BusinessLogicError("收货通知单节点未启用，无法创建收货通知单")
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "RECEIPT_NOTICE_CODE", prefix=f"RN{today}")

            dump = notice_data.model_dump(exclude_unset=True, exclude={"items", "notice_code"})
            if notice_data.notice_code:
                code = notice_data.notice_code

            notice = await ReceiptNotice.create(
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
                await ReceiptNoticeItem.create(
                    tenant_id=tenant_id,
                    notice_id=notice.id,
                    notice_quantity=qty,
                    unit_price=Decimal(str(item_data.unit_price or 0)),
                    total_amount=amt,
                    **item_data.model_dump(exclude_unset=True, exclude={"notice_quantity", "unit_price", "total_amount"})
                )
                total_quantity += qty
                total_amount += amt

            await ReceiptNotice.filter(tenant_id=tenant_id, id=notice.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )
            notice = await ReceiptNotice.get(tenant_id=tenant_id, id=notice.id)
            return ReceiptNoticeResponse.model_validate(notice)

    async def get_receipt_notice_by_id(
        self,
        tenant_id: int,
        notice_id: int
    ) -> ReceiptNoticeWithItemsResponse:
        """根据ID获取收货通知单（含明细）"""
        notice = await ReceiptNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"收货通知单不存在: {notice_id}")

        items = await ReceiptNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).all()
        response = ReceiptNoticeWithItemsResponse.model_validate(notice)
        response.items = [ReceiptNoticeItemResponse.model_validate(i) for i in items]
        return response

    async def list_receipt_notices(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[ReceiptNoticeListResponse]:
        """获取收货通知单列表"""
        query = ReceiptNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("purchase_order_id"):
            query = query.filter(purchase_order_id=filters["purchase_order_id"])
        if filters.get("supplier_id"):
            query = query.filter(supplier_id=filters["supplier_id"])

        notices = await query.offset(skip).limit(limit).order_by("-created_at")
        return [ReceiptNoticeListResponse.model_validate(r) for r in notices]

    async def update_receipt_notice(
        self,
        tenant_id: int,
        notice_id: int,
        notice_data: ReceiptNoticeUpdate,
        updated_by: int
    ) -> ReceiptNoticeResponse:
        """更新收货通知单"""
        notice = await self.get_receipt_notice_by_id(tenant_id, notice_id)
        if notice.status != "待收货":
            raise BusinessLogicError("只能更新待收货状态的收货通知单")

        async with in_transaction():
            dump = notice_data.model_dump(exclude_unset=True, exclude={"notice_code"})
            dump["updated_by"] = updated_by
            await ReceiptNotice.filter(tenant_id=tenant_id, id=notice_id).update(**dump)
            return ReceiptNoticeResponse.model_validate(
                await ReceiptNotice.get(tenant_id=tenant_id, id=notice_id)
            )

    async def delete_receipt_notice(self, tenant_id: int, notice_id: int) -> bool:
        """删除收货通知单"""
        notice = await ReceiptNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"收货通知单不存在: {notice_id}")
        if notice.status != "待收货":
            raise BusinessLogicError("只能删除待收货状态的收货通知单")

        await ReceiptNotice.filter(tenant_id=tenant_id, id=notice_id).update(deleted_at=datetime.now())
        return True

    async def notify_warehouse(
        self,
        tenant_id: int,
        notice_id: int,
        notified_by: int
    ) -> ReceiptNoticeResponse:
        """通知仓库（标记为已通知）"""
        notice = await ReceiptNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"收货通知单不存在: {notice_id}")
        if notice.status != "待收货":
            raise BusinessLogicError("只有待收货状态的通知单才能通知仓库")

        await ReceiptNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="已通知",
            notified_at=datetime.now(),
            updated_by=notified_by
        )
        return ReceiptNoticeResponse.model_validate(
            await ReceiptNotice.get(tenant_id=tenant_id, id=notice_id)
        )
