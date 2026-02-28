"""
组装单业务服务模块

提供组装单相关的业务逻辑处理，包括组装单创建、添加明细、执行组装等。
组装：消耗组件库存，增加成品库存。

Author: Luigi Lu
Date: 2026-02-26
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.assembly_order import AssemblyOrder, AssemblyOrderItem
from apps.kuaizhizao.schemas.assembly_order import (
    AssemblyOrderCreate,
    AssemblyOrderUpdate,
    AssemblyOrderResponse,
    AssemblyOrderListResponse,
    AssemblyOrderItemCreate,
    AssemblyOrderItemCreateInput,
    AssemblyOrderItemUpdate,
    AssemblyOrderItemResponse,
    AssemblyOrderWithItemsResponse,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class AssemblyOrderService(AppBaseService[AssemblyOrder]):
    def __init__(self):
        super().__init__(AssemblyOrder)
        self.business_config_service = BusinessConfigService()

    async def create_assembly_order(
        self,
        tenant_id: int,
        order_data: AssemblyOrderCreate,
        created_by: int
    ) -> AssemblyOrderResponse:
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "assembly_order")
        if not is_enabled:
            raise BusinessLogicError("组装单节点未启用，无法创建组装单")
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="ASSEMBLY_ORDER_CODE",
                prefix=f"ZZD{today}"
            )
            user_info = await self.get_user_info(created_by)

            order = await AssemblyOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                warehouse_id=order_data.warehouse_id,
                warehouse_name=order_data.warehouse_name,
                assembly_date=order_data.assembly_date,
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
            return AssemblyOrderResponse.model_validate(order)

    async def get_assembly_order_by_id(
        self,
        tenant_id: int,
        order_id: int
    ) -> AssemblyOrderWithItemsResponse:
        order = await AssemblyOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"组装单不存在: {order_id}")

        items = await AssemblyOrderItem.filter(
            assembly_order_id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).order_by('id')

        response = AssemblyOrderWithItemsResponse.model_validate(order)
        response.items = [AssemblyOrderItemResponse.model_validate(item) for item in items]
        return response

    async def update_assembly_order(
        self,
        tenant_id: int,
        order_id: int,
        order_data: AssemblyOrderUpdate,
        updated_by: int
    ) -> AssemblyOrderResponse:
        async with in_transaction():
            order = await AssemblyOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not order:
                raise NotFoundError(f"组装单不存在: {order_id}")
            if order.status not in ['draft']:
                raise ValidationError(f"组装单状态为{order.status}，不能修改")

            user_info = await self.get_user_info(updated_by)

            for field, value in order_data.model_dump(exclude_unset=True).items():
                setattr(order, field, value)

            order.updated_by = updated_by
            order.updated_by_name = user_info["name"]
            await order.save()
            return AssemblyOrderResponse.model_validate(order)

    async def list_assembly_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        warehouse_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> AssemblyOrderListResponse:
        query = AssemblyOrder.filter(
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
        return AssemblyOrderListResponse(
            items=[AssemblyOrderResponse.model_validate(o) for o in orders],
            total=total
        )

    async def create_assembly_order_item(
        self,
        tenant_id: int,
        order_id: int,
        item_data: AssemblyOrderItemCreateInput,
        created_by: int
    ) -> AssemblyOrderItemResponse:
        async with in_transaction():
            order = await AssemblyOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not order:
                raise NotFoundError(f"组装单不存在: {order_id}")
            if order.status not in ['draft']:
                raise ValidationError(f"组装单状态为{order.status}，不能添加明细")

            amount = item_data.quantity * item_data.unit_price

            item = await AssemblyOrderItem.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                assembly_order_id=order_id,
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
            return AssemblyOrderItemResponse.model_validate(item)

    async def update_assembly_order_item(
        self,
        tenant_id: int,
        item_id: int,
        item_data: AssemblyOrderItemUpdate,
        updated_by: int
    ) -> AssemblyOrderItemResponse:
        async with in_transaction():
            item = await AssemblyOrderItem.get_or_none(
                id=item_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not item:
                raise NotFoundError(f"组装明细不存在: {item_id}")
            if item.status != 'pending':
                raise ValidationError(f"组装明细状态为{item.status}，不能修改")

            if item_data.quantity is not None:
                item.quantity = item_data.quantity
            if item_data.unit_price is not None:
                item.unit_price = item_data.unit_price
            if item_data.remarks is not None:
                item.remarks = item_data.remarks

            item.amount = item.quantity * item.unit_price
            await item.save()

            await self._update_order_statistics(tenant_id, item.assembly_order_id)
            return AssemblyOrderItemResponse.model_validate(item)

    async def execute_assembly_order(
        self,
        tenant_id: int,
        order_id: int,
        executed_by: int
    ) -> AssemblyOrderResponse:
        async with in_transaction():
            order = await AssemblyOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if not order:
                raise NotFoundError(f"组装单不存在: {order_id}")
            if order.status != 'draft':
                raise ValidationError(f"组装单状态为{order.status}，不能执行")

            items = await AssemblyOrderItem.filter(
                assembly_order_id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                status='pending'
            )
            if not items:
                raise ValidationError("组装单没有待消耗的明细")

            # TODO: 调用库存服务更新库存（消耗组件、增加成品）
            for item in items:
                item.status = "consumed"
                await item.save()

            user_info = await self.get_user_info(executed_by)
            order.status = "completed"
            order.executed_by = executed_by
            order.executed_by_name = user_info["name"]
            order.executed_at = datetime.now()
            order.updated_by = executed_by
            order.updated_by_name = user_info["name"]
            await order.save()

            return AssemblyOrderResponse.model_validate(order)

    async def delete_assembly_order(self, tenant_id: int, order_id: int) -> bool:
        """删除组装单（软删除，仅草稿可删）"""
        order = await AssemblyOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError(f"组装单不存在: {order_id}")
        if order.status not in ['draft']:
            raise ValidationError(f"组装单状态为{order.status}，不能删除")
        await AssemblyOrder.filter(id=order_id, tenant_id=tenant_id).update(
            deleted_at=datetime.now()
        )
        return True

    async def _update_order_statistics(self, tenant_id: int, order_id: int) -> None:
        items = await AssemblyOrderItem.filter(
            assembly_order_id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        order = await AssemblyOrder.get(id=order_id)
        order.total_items = len(items)
        await order.save()
