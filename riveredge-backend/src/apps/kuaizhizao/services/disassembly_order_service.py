"""
拆卸单业务服务模块

提供拆卸单相关的业务逻辑处理，包括拆卸单创建、添加明细、执行拆卸等。
拆卸：消耗成品库存，增加组件库存。

Author: Luigi Lu
Date: 2026-02-26
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.disassembly_order import DisassemblyOrder, DisassemblyOrderItem
from apps.kuaizhizao.schemas.disassembly_order import (
    DisassemblyOrderCreate,
    DisassemblyOrderUpdate,
    DisassemblyOrderResponse,
    DisassemblyOrderListResponse,
    DisassemblyOrderItemCreate,
    DisassemblyOrderItemCreateInput,
    DisassemblyOrderItemUpdate,
    DisassemblyOrderItemResponse,
    DisassemblyOrderWithItemsResponse,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class DisassemblyOrderService(AppBaseService[DisassemblyOrder]):
    def __init__(self):
        super().__init__(DisassemblyOrder)
        self.business_config_service = BusinessConfigService()

    async def create_disassembly_order(
        self,
        tenant_id: int,
        order_data: DisassemblyOrderCreate,
        created_by: int
    ) -> DisassemblyOrderResponse:
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "disassembly_order")
        if not is_enabled:
            raise BusinessLogicError("拆卸单节点未启用，无法创建拆卸单")
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="DISASSEMBLY_ORDER_CODE",
                prefix=f"CXD{today}"
            )
            user_info = await self.get_user_info(created_by)

            order = await DisassemblyOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                warehouse_id=order_data.warehouse_id,
                warehouse_name=order_data.warehouse_name,
                disassembly_date=order_data.disassembly_date,
                status="draft",
                product_material_id=order_data.product_material_id,
                product_material_code=order_data.product_material_code,
                product_material_name=order_data.product_material_name,
                total_quantity=order_data.total_quantity or Decimal("0"),
                total_items=0,
                remarks=order_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )
            return DisassemblyOrderResponse.model_validate(order)

    async def get_disassembly_order_by_id(
        self,
        tenant_id: int,
        order_id: int
    ) -> DisassemblyOrderWithItemsResponse:
        order = await DisassemblyOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"拆卸单不存在: {order_id}")

        items = await DisassemblyOrderItem.filter(
            disassembly_order_id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).order_by('id')

        response = DisassemblyOrderWithItemsResponse.model_validate(order)
        response.items = [DisassemblyOrderItemResponse.model_validate(item) for item in items]
        return response

    async def update_disassembly_order(
        self,
        tenant_id: int,
        order_id: int,
        order_data: DisassemblyOrderUpdate,
        updated_by: int
    ) -> DisassemblyOrderResponse:
        async with in_transaction():
            order = await DisassemblyOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not order:
                raise NotFoundError(f"拆卸单不存在: {order_id}")
            if order.status not in ['draft']:
                raise ValidationError(f"拆卸单状态为{order.status}，不能修改")

            user_info = await self.get_user_info(updated_by)

            for field, value in order_data.model_dump(exclude_unset=True).items():
                setattr(order, field, value)

            order.updated_by = updated_by
            order.updated_by_name = user_info["name"]
            await order.save()
            return DisassemblyOrderResponse.model_validate(order)

    async def list_disassembly_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        warehouse_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> DisassemblyOrderListResponse:
        query = DisassemblyOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if code:
            query = query.filter(code__icontains=code)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)
        if status:
            query = query.filter(status=status)

        total = await query.count()
        orders = await query.order_by('-created_at').offset(skip).limit(limit)
        return DisassemblyOrderListResponse(
            items=[DisassemblyOrderResponse.model_validate(o) for o in orders],
            total=total
        )

    async def create_disassembly_order_item(
        self,
        tenant_id: int,
        order_id: int,
        item_data: DisassemblyOrderItemCreateInput,
        created_by: int
    ) -> DisassemblyOrderItemResponse:
        async with in_transaction():
            order = await DisassemblyOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not order:
                raise NotFoundError(f"拆卸单不存在: {order_id}")
            if order.status not in ['draft']:
                raise ValidationError(f"拆卸单状态为{order.status}，不能添加明细")

            amount = item_data.quantity * item_data.unit_price

            item = await DisassemblyOrderItem.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                disassembly_order_id=order_id,
                material_id=item_data.material_id,
                material_code=item_data.material_code,
                material_name=item_data.material_name,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                amount=amount,
                status="pending",
                remarks=item_data.remarks,
            )

            await self._update_order_statistics(tenant_id, order_id)
            return DisassemblyOrderItemResponse.model_validate(item)

    async def update_disassembly_order_item(
        self,
        tenant_id: int,
        item_id: int,
        item_data: DisassemblyOrderItemUpdate,
        updated_by: int
    ) -> DisassemblyOrderItemResponse:
        async with in_transaction():
            item = await DisassemblyOrderItem.get_or_none(
                id=item_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not item:
                raise NotFoundError(f"拆卸明细不存在: {item_id}")
            if item.status != 'pending':
                raise ValidationError(f"拆卸明细状态为{item.status}，不能修改")

            if item_data.quantity is not None:
                item.quantity = item_data.quantity
            if item_data.unit_price is not None:
                item.unit_price = item_data.unit_price
            if item_data.remarks is not None:
                item.remarks = item_data.remarks

            item.amount = item.quantity * item.unit_price
            await item.save()

            await self._update_order_statistics(tenant_id, item.disassembly_order_id)
            return DisassemblyOrderItemResponse.model_validate(item)

    async def execute_disassembly_order(
        self,
        tenant_id: int,
        order_id: int,
        executed_by: int
    ) -> DisassemblyOrderResponse:
        async with in_transaction():
            order = await DisassemblyOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not order:
                raise NotFoundError(f"拆卸单不存在: {order_id}")
            if order.status != 'draft':
                raise ValidationError(f"拆卸单状态为{order.status}，不能执行")

            items = await DisassemblyOrderItem.filter(
                disassembly_order_id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                status='pending'
            )
            if not items:
                raise ValidationError("拆卸单没有待产出的明细")

            # TODO: 调用库存服务更新库存（消耗成品、增加组件）
            for item in items:
                item.status = "produced"
                await item.save()

            user_info = await self.get_user_info(executed_by)
            order.status = "completed"
            order.executed_by = executed_by
            order.executed_by_name = user_info["name"]
            order.executed_at = datetime.now()
            order.updated_by = executed_by
            order.updated_by_name = user_info["name"]
            await order.save()

            return DisassemblyOrderResponse.model_validate(order)

    async def _update_order_statistics(self, tenant_id: int, order_id: int) -> None:
        items = await DisassemblyOrderItem.filter(
            disassembly_order_id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        order = await DisassemblyOrder.get(id=order_id)
        order.total_items = len(items)
        await order.save()
