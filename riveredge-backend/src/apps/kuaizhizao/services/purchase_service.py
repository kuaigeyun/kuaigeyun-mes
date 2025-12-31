"""
采购订单服务

提供采购订单相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.transactions import in_transaction
from tortoise.expressions import Q

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.kuaizhizao.models import (
    PurchaseOrder, PurchaseOrderItem
)
from apps.master_data.models import Supplier
from apps.master_data.models.material import Material
from apps.kuaizhizao.schemas.purchase import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    PurchaseOrderListResponse, PurchaseOrderItemResponse,
    PurchaseOrderApprove, PurchaseOrderConfirm, PurchaseOrderListParams
)


class PurchaseService(AppBaseService[PurchaseOrder]):
    """采购订单服务类"""

    def __init__(self):
        super().__init__(PurchaseOrder)

    async def create_purchase_order(
        self,
        tenant_id: int,
        order_data: PurchaseOrderCreate,
        created_by: int
    ) -> PurchaseOrderResponse:
        """
        创建采购订单

        Args:
            tenant_id: 租户ID
            order_data: 订单数据
            created_by: 创建人ID

        Returns:
            PurchaseOrderResponse: 创建的订单信息
        """
        async with in_transaction():
            # 生成订单编码
            if not order_data.order_code:
                today = datetime.now().strftime("%Y%m%d")
                order_data.order_code = await self.generate_code(tenant_id, "PURCHASE_ORDER_CODE", prefix=f"PO{today}")

            # 验证供应商
            supplier = await Supplier.get_or_none(tenant_id=tenant_id, id=order_data.supplier_id)
            if not supplier:
                raise NotFoundError(f"供应商不存在: {order_data.supplier_id}")

            # 创建订单头
            order_dict = order_data.model_dump(exclude={'items'})
            order_dict.update({
                'tenant_id': tenant_id,
                'created_by': created_by,
                'updated_by': created_by
            })

            order = await PurchaseOrder.create(**order_dict)

            # 创建订单明细
            total_quantity = Decimal(0)
            total_amount = Decimal(0)

            for item_data in order_data.items:
                # 验证物料
                material = await Material.get_or_none(tenant_id=tenant_id, id=item_data.material_id)
                if not material:
                    raise NotFoundError(f"物料不存在: {item_data.material_id}")

                # 计算总价
                total_price = item_data.ordered_quantity * item_data.unit_price
                outstanding_quantity = item_data.ordered_quantity

                item_dict = item_data.model_dump()
                item_dict.update({
                    'tenant_id': tenant_id,
                    'order_id': order.id,
                    'total_price': total_price,
                    'outstanding_quantity': outstanding_quantity,
                    'created_by': created_by,
                    'updated_by': created_by
                })

                await PurchaseOrderItem.create(**item_dict)

                total_quantity += item_data.ordered_quantity
                total_amount += total_price

            # 更新订单头金额信息
            tax_amount = total_amount * order_data.tax_rate
            net_amount = total_amount + tax_amount

            await order.update_from_dict({
                'total_quantity': total_quantity,
                'total_amount': total_amount,
                'tax_amount': tax_amount,
                'net_amount': net_amount,
                'updated_by': created_by
            }).save()

            return await self.get_purchase_order_by_id(tenant_id, order.id)

    async def get_purchase_order_by_id(self, tenant_id: int, order_id: int) -> PurchaseOrderResponse:
        """
        根据ID获取采购订单详情

        Args:
            tenant_id: 租户ID
            order_id: 订单ID

        Returns:
            PurchaseOrderResponse: 订单详情
        """
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        # 获取订单明细
        items = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id)
        order.items = items

        return PurchaseOrderResponse.model_validate(order)

    async def list_purchase_orders(
        self,
        tenant_id: int,
        params: PurchaseOrderListParams
    ) -> List[PurchaseOrderListResponse]:
        """
        获取采购订单列表

        Args:
            tenant_id: 租户ID
            params: 查询参数

        Returns:
            List[PurchaseOrderListResponse]: 订单列表
        """
        query = PurchaseOrder.filter(tenant_id=tenant_id)

        # 应用筛选条件
        if params.supplier_id:
            query = query.filter(supplier_id=params.supplier_id)
        if params.status:
            query = query.filter(status=params.status)
        if params.review_status:
            query = query.filter(review_status=params.review_status)
        if params.order_date_from:
            query = query.filter(order_date__gte=params.order_date_from)
        if params.order_date_to:
            query = query.filter(order_date__lte=params.order_date_to)
        if params.delivery_date_from:
            query = query.filter(delivery_date__gte=params.delivery_date_from)
        if params.delivery_date_to:
            query = query.filter(delivery_date__lte=params.delivery_date_to)
        if params.keyword:
            keyword = params.keyword
            # 使用icontains进行模糊搜索，多个条件使用OR逻辑
            from tortoise.expressions import Q
            query = query.filter(
                Q(order_code__icontains=keyword) |
                Q(supplier_name__icontains=keyword) |
                Q(notes__icontains=keyword)
            )

        # 分页
        skip = params.skip or 0
        limit = params.limit or 20

        total = await query.count()
        orders = await query.offset(skip).limit(limit).order_by('-created_at')

        # 为每个订单加载明细（简化版，只返回基本信息）
        result = []
        for order in orders:
            items_count = await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order.id).count()
            order_dict = order.__dict__
            order_dict['items_count'] = items_count
            result.append(PurchaseOrderListResponse.model_validate(order))

        return result

    async def update_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        order_data: PurchaseOrderUpdate,
        updated_by: int
    ) -> PurchaseOrderResponse:
        """
        更新采购订单

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            order_data: 更新数据
            updated_by: 更新人ID

        Returns:
            PurchaseOrderResponse: 更新后的订单信息
        """
        async with in_transaction():
            order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
            if not order:
                raise NotFoundError(f"采购订单不存在: {order_id}")

            # 只能更新草稿状态的订单
            if order.status != "草稿":
                raise BusinessLogicError("只能更新草稿状态的订单")

            # 更新订单头
            update_dict = order_data.model_dump(exclude_unset=True, exclude={'items'})
            update_dict['updated_by'] = updated_by

            await order.update_from_dict(update_dict).save()

            # 如果有明细更新，重新计算金额
            if order_data.items:
                # 删除原有明细
                await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).delete()

                # 重新创建明细
                total_quantity = Decimal(0)
                total_amount = Decimal(0)

                for item_data in order_data.items:
                    total_price = item_data.ordered_quantity * item_data.unit_price
                    outstanding_quantity = item_data.ordered_quantity

                    item_dict = item_data.model_dump()
                    item_dict.update({
                        'tenant_id': tenant_id,
                        'order_id': order.id,
                        'total_price': total_price,
                        'outstanding_quantity': outstanding_quantity,
                        'updated_by': updated_by
                    })

                    await PurchaseOrderItem.create(**item_dict)

                    total_quantity += item_data.ordered_quantity
                    total_amount += total_price

                # 更新订单头金额
                tax_amount = total_amount * (order_data.tax_rate or order.tax_rate)
                net_amount = total_amount + tax_amount

                await order.update_from_dict({
                    'total_quantity': total_quantity,
                    'total_amount': total_amount,
                    'tax_amount': tax_amount,
                    'net_amount': net_amount,
                    'updated_by': updated_by
                }).save()

            return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def approve_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        approve_data: PurchaseOrderApprove,
        approved_by: int
    ) -> PurchaseOrderResponse:
        """
        审核采购订单

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            approve_data: 审核数据
            approved_by: 审核人ID

        Returns:
            PurchaseOrderResponse: 审核后的订单信息
        """
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        if order.review_status != "待审核":
            raise BusinessLogicError("订单已被审核")

        update_dict = {
            'reviewer_id': approved_by,
            'review_time': datetime.now(),
            'review_status': "审核通过" if approve_data.approved else "审核驳回",
            'review_remarks': approve_data.review_remarks,
            'updated_by': approved_by
        }

        if approve_data.approved:
            update_dict['status'] = "已审核"

        await order.update_from_dict(update_dict).save()

        return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def confirm_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
        confirm_data: PurchaseOrderConfirm,
        confirmed_by: int
    ) -> PurchaseOrderResponse:
        """
        确认采购订单（供应商确认）

        Args:
            tenant_id: 租户ID
            order_id: 订单ID
            confirm_data: 确认数据
            confirmed_by: 确认人ID

        Returns:
            PurchaseOrderResponse: 确认后的订单信息
        """
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        if order.status != "已审核":
            raise BusinessLogicError("只有已审核的订单才能确认")

        await order.update_from_dict({
            'status': "已确认",
            'notes': order.notes + f"\n确认备注：{confirm_data.confirm_remarks or ''}",
            'updated_by': confirmed_by
        }).save()

        return await self.get_purchase_order_by_id(tenant_id, order_id)

    async def delete_purchase_order(self, tenant_id: int, order_id: int) -> bool:
        """
        删除采购订单

        Args:
            tenant_id: 租户ID
            order_id: 订单ID

        Returns:
            bool: 是否删除成功
        """
        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        # 只能删除草稿状态的订单
        if order.status != "草稿":
            raise BusinessLogicError("只能删除草稿状态的订单")

        # 删除订单明细
        await PurchaseOrderItem.filter(tenant_id=tenant_id, order_id=order_id).delete()

        # 删除订单头
        await order.delete()

        return True
