"""
发货通知单服务模块

销售通知仓库发货，不直接动库存。来源为销售订单。

Author: RiverEdge Team
Date: 2026-02-22
"""

import logging
from collections import defaultdict
from typing import List
from datetime import datetime
from decimal import Decimal
from tortoise.transactions import in_transaction

from apps.base_service import AppBaseService

logger = logging.getLogger(__name__)
from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
from apps.kuaizhizao.models.shipment_notice_item import ShipmentNoticeItem
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
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
from apps.kuaizhizao.utils.inventory_helper import get_material_available_quantity


class ShipmentNoticeService(AppBaseService[ShipmentNotice]):
    """发货通知单服务"""

    def __init__(self):
        super().__init__(ShipmentNotice)
        self.business_config_service = BusinessConfigService()

    async def _validate_not_overdelivery_on_notify(
        self,
        *,
        tenant_id: int,
        notice: ShipmentNotice,
    ) -> None:
        """
        P1-S-009: 在通知仓库（提交）前做超发校验。
        以销售订单明细可发数量（剩余数量）为上限，且扣除其他“已通知”单据已占用数量。
        """
        notice_items = await ShipmentNoticeItem.filter(
            tenant_id=tenant_id,
            notice_id=notice.id,
        ).all()
        if not notice_items:
            raise BusinessLogicError("发货通知单无明细，无法通知仓库")

        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=notice.sales_order_id,
        ).all()
        if not order_items:
            raise BusinessLogicError("销售订单明细不存在，无法校验发货通知数量")

        order_item_by_id = {int(it.id): it for it in order_items}

        reserved_notice_ids = await ShipmentNotice.filter(
            tenant_id=tenant_id,
            sales_order_id=notice.sales_order_id,
            status="已通知",
            deleted_at__isnull=True,
        ).exclude(id=notice.id).values_list("id", flat=True)

        reserved_by_item_id: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        if reserved_notice_ids:
            reserved_items = await ShipmentNoticeItem.filter(
                tenant_id=tenant_id,
                notice_id__in=list(reserved_notice_ids),
            ).all()
            for rit in reserved_items:
                so_item_id = getattr(rit, "sales_order_item_id", None)
                if so_item_id is None:
                    continue
                reserved_by_item_id[int(so_item_id)] += Decimal(str(rit.notice_quantity or 0))

        for n_item in notice_items:
            qty = Decimal(str(n_item.notice_quantity or 0))
            if qty <= Decimal("0"):
                raise BusinessLogicError("发货通知数量必须大于0")

            so_item_id = getattr(n_item, "sales_order_item_id", None)
            if so_item_id is None:
                # 无法映射到订单行时，不做超发额度校验（但保留数量>0校验）
                continue
            so_item_id = int(so_item_id)
            so_item = order_item_by_id.get(so_item_id)
            if not so_item:
                raise BusinessLogicError(f"发货通知明细缺少有效的订单行关联: {so_item_id}")

            remaining_qty = (
                Decimal(str(so_item.remaining_quantity))
                if getattr(so_item, "remaining_quantity", None) is not None
                else Decimal(str(so_item.order_quantity or 0)) - Decimal(str(so_item.delivered_quantity or 0))
            )
            remaining_qty = max(Decimal("0"), remaining_qty)
            available_qty = max(Decimal("0"), remaining_qty - reserved_by_item_id.get(so_item_id, Decimal("0")))
            if qty > available_qty:
                material_label = (getattr(so_item, "material_code", None) or getattr(so_item, "material_name", None) or str(so_item_id))
                raise BusinessLogicError(
                    f"物料 {material_label} 通知数量 {qty} 超过可通知欠发量 {available_qty}"
                )

    async def _validate_inventory_reservation_on_notify(
        self,
        *,
        tenant_id: int,
        notice: ShipmentNotice,
    ) -> None:
        """
        P1-S-011: 通知仓库前校验库存预占量。
        以仓内可用库存为基础，扣除其他“已通知”单据对同仓同物料的预占量后再判断。
        """
        notice_items = await ShipmentNoticeItem.filter(
            tenant_id=tenant_id,
            notice_id=notice.id,
        ).all()
        if not notice_items:
            return

        required_by_material: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        material_labels: dict[int, str] = {}
        for item in notice_items:
            material_id = getattr(item, "material_id", None)
            if not material_id:
                continue
            qty = Decimal(str(getattr(item, "notice_quantity", 0) or 0))
            if qty <= Decimal("0"):
                continue
            material_id = int(material_id)
            required_by_material[material_id] += qty
            material_labels[material_id] = (
                getattr(item, "material_code", None)
                or getattr(item, "material_name", None)
                or str(material_id)
            )

        if not required_by_material:
            return

        reserved_notice_query = ShipmentNotice.filter(
            tenant_id=tenant_id,
            status="已通知",
            deleted_at__isnull=True,
        ).exclude(id=notice.id)
        if getattr(notice, "warehouse_id", None) is not None:
            reserved_notice_query = reserved_notice_query.filter(warehouse_id=notice.warehouse_id)
        reserved_notice_ids = await reserved_notice_query.values_list("id", flat=True)

        reserved_by_material: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        if reserved_notice_ids:
            reserved_items = await ShipmentNoticeItem.filter(
                tenant_id=tenant_id,
                notice_id__in=list(reserved_notice_ids),
            ).all()
            for rit in reserved_items:
                material_id = getattr(rit, "material_id", None)
                if not material_id:
                    continue
                qty = Decimal(str(getattr(rit, "notice_quantity", 0) or 0))
                if qty <= Decimal("0"):
                    continue
                reserved_by_material[int(material_id)] += qty

        for material_id, required_qty in required_by_material.items():
            available_qty = await get_material_available_quantity(
                tenant_id=tenant_id,
                material_id=material_id,
                warehouse_id=getattr(notice, "warehouse_id", None),
            )
            effective_qty = max(
                Decimal("0"),
                Decimal(str(available_qty or 0)) - reserved_by_material.get(material_id, Decimal("0")),
            )
            if required_qty > effective_qty:
                label = material_labels.get(material_id, str(material_id))
                raise BusinessLogicError(
                    f"物料 {label} 通知数量 {required_qty} 超过库存可用量 {effective_qty}（已扣减预占）"
                )

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
            code = notice_data.notice_code
            if not code:
                try:
                    code = await self.generate_code(tenant_id, "SHIPMENT_NOTICE_CODE", prefix="SN")
                except Exception as e:
                    from infra.exceptions.exceptions import ValidationError
                    if isinstance(e, ValidationError) and ("不存在" in str(e) or "未启用" in str(e)):
                        from core.services.default.default_values_service import DefaultValuesService
                        created = await DefaultValuesService.ensure_code_rule_for_page(
                            tenant_id, "kuaizhizao-shipment-notice"
                        )
                        if created:
                            try:
                                code = await self.generate_code(tenant_id, "SHIPMENT_NOTICE_CODE", prefix="SN")
                            except Exception as e2:
                                logger.warning("发货通知单编码规则补建后生成仍失败: %s", e2)
                        else:
                            logger.warning("发货通知单编码规则生成失败: %s", e)
                    else:
                        logger.warning("发货通知单编码规则生成失败: %s", e)
                if not code:
                    import uuid
                    code = f"SN{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:6].upper()}"

            dump = notice_data.model_dump(exclude_unset=True, exclude={"items", "notice_code"})

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
        from apps.kuaizhizao.services.document_lifecycle_service import get_shipment_notice_lifecycle, get_document_milestones
        milestones = await get_document_milestones(tenant_id, "shipment_notice", notice_id)
        response.lifecycle = get_shipment_notice_lifecycle(notice, milestones=milestones)
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
        from apps.kuaizhizao.services.document_lifecycle_service import get_shipment_notice_lifecycle
        out: List[ShipmentNoticeListResponse] = []
        for r in notices:
            resp = ShipmentNoticeListResponse.model_validate(r)
            resp.lifecycle = get_shipment_notice_lifecycle(r)
            out.append(resp)
        return out

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

        await self._validate_not_overdelivery_on_notify(
            tenant_id=tenant_id,
            notice=notice,
        )
        await self._validate_inventory_reservation_on_notify(
            tenant_id=tenant_id,
            notice=notice,
        )

        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="已通知",
            notified_at=datetime.now(),
            updated_by=notified_by
        )
        return ShipmentNoticeResponse.model_validate(
            await ShipmentNotice.get(tenant_id=tenant_id, id=notice_id)
        )

    async def withdraw_notice(
        self,
        tenant_id: int,
        notice_id: int,
        withdrawn_by: int,
    ) -> ShipmentNoticeResponse:
        """撤回通知（已通知 -> 待发货）。已出库/已关联出库单不允许撤回。"""
        notice = await ShipmentNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")

        if notice.status != "已通知":
            raise BusinessLogicError("只有已通知状态的发货通知单才能撤回")
        if getattr(notice, "sales_delivery_id", None):
            raise BusinessLogicError("该通知单已关联销售出库单，不能撤回")

        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="待发货",
            notified_at=None,
            updated_by=withdrawn_by,
        )
        updated = await ShipmentNotice.get(tenant_id=tenant_id, id=notice_id)
        return ShipmentNoticeResponse.model_validate(updated)
