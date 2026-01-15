"""
库存盘点业务服务模块

提供库存盘点单相关的业务逻辑处理，包括盘点单创建、执行、差异处理等。

Author: Luigi Lu
Date: 2025-01-04
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.stocktaking import Stocktaking, StocktakingItem
from apps.kuaizhizao.schemas.stocktaking import (
    StocktakingCreate,
    StocktakingUpdate,
    StocktakingResponse,
    StocktakingListResponse,
    StocktakingItemCreate,
    StocktakingItemUpdate,
    StocktakingItemResponse,
    StocktakingWithItemsResponse,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class StocktakingService(AppBaseService[Stocktaking]):
    """
    库存盘点服务类

    处理库存盘点单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(Stocktaking)

    async def create_stocktaking(
        self,
        tenant_id: int,
        stocktaking_data: StocktakingCreate,
        created_by: int
    ) -> StocktakingResponse:
        """
        创建库存盘点单

        Args:
            tenant_id: 组织ID
            stocktaking_data: 盘点单创建数据
            created_by: 创建人ID

        Returns:
            StocktakingResponse: 创建的盘点单信息

        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 生成盘点单号
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="STOCKTAKING_CODE",
                prefix=f"ST{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建盘点单
            stocktaking = await Stocktaking.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                warehouse_id=stocktaking_data.warehouse_id,
                warehouse_name=stocktaking_data.warehouse_name,
                stocktaking_date=stocktaking_data.stocktaking_date,
                stocktaking_type=stocktaking_data.stocktaking_type,
                status="draft",
                total_items=0,
                counted_items=0,
                total_differences=0,
                total_difference_amount=Decimal("0"),
                remarks=stocktaking_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            return StocktakingResponse.model_validate(stocktaking)

    async def get_stocktaking_by_id(
        self,
        tenant_id: int,
        stocktaking_id: int
    ) -> StocktakingWithItemsResponse:
        """
        根据ID获取库存盘点单详情（包含明细）

        Args:
            tenant_id: 组织ID
            stocktaking_id: 盘点单ID

        Returns:
            StocktakingWithItemsResponse: 盘点单详情（包含明细）

        Raises:
            NotFoundError: 盘点单不存在
        """
        stocktaking = await Stocktaking.get_or_none(
            id=stocktaking_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not stocktaking:
            raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

        # 获取盘点明细
        items = await StocktakingItem.filter(
            stocktaking_id=stocktaking_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).order_by('id')

        # 构建响应
        response = StocktakingWithItemsResponse.model_validate(stocktaking)
        response.items = [StocktakingItemResponse.model_validate(item) for item in items]

        return response

    async def update_stocktaking(
        self,
        tenant_id: int,
        stocktaking_id: int,
        stocktaking_data: StocktakingUpdate,
        updated_by: int
    ) -> StocktakingResponse:
        """
        更新库存盘点单

        Args:
            tenant_id: 组织ID
            stocktaking_id: 盘点单ID
            stocktaking_data: 盘点单更新数据
            updated_by: 更新人ID

        Returns:
            StocktakingResponse: 更新后的盘点单信息

        Raises:
            NotFoundError: 盘点单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取盘点单
            stocktaking = await Stocktaking.get_or_none(
                id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

            # 检查盘点单状态
            if stocktaking.status not in ['draft']:
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能修改")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新盘点单字段
            if stocktaking_data.warehouse_id is not None:
                stocktaking.warehouse_id = stocktaking_data.warehouse_id
            if stocktaking_data.warehouse_name is not None:
                stocktaking.warehouse_name = stocktaking_data.warehouse_name
            if stocktaking_data.stocktaking_date is not None:
                stocktaking.stocktaking_date = stocktaking_data.stocktaking_date
            if stocktaking_data.stocktaking_type is not None:
                stocktaking.stocktaking_type = stocktaking_data.stocktaking_type
            if stocktaking_data.remarks is not None:
                stocktaking.remarks = stocktaking_data.remarks

            stocktaking.updated_by = updated_by
            stocktaking.updated_by_name = user_info["name"]

            await stocktaking.save()

            return StocktakingResponse.model_validate(stocktaking)

    async def start_stocktaking(
        self,
        tenant_id: int,
        stocktaking_id: int,
        started_by: int
    ) -> StocktakingResponse:
        """
        开始盘点（将状态从draft改为in_progress）

        Args:
            tenant_id: 组织ID
            stocktaking_id: 盘点单ID
            started_by: 开始人ID

        Returns:
            StocktakingResponse: 更新后的盘点单信息

        Raises:
            NotFoundError: 盘点单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取盘点单
            stocktaking = await Stocktaking.get_or_none(
                id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

            if stocktaking.status != 'draft':
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能开始盘点")

            # 获取开始人信息
            user_info = await self.get_user_info(started_by)

            # 更新状态
            stocktaking.status = 'in_progress'
            stocktaking.updated_by = started_by
            stocktaking.updated_by_name = user_info["name"]

            await stocktaking.save()

            return StocktakingResponse.model_validate(stocktaking)

    async def create_stocktaking_item(
        self,
        tenant_id: int,
        stocktaking_id: int,
        item_data: StocktakingItemCreate,
        created_by: int
    ) -> StocktakingItemResponse:
        """
        创建盘点明细

        Args:
            tenant_id: 组织ID
            stocktaking_id: 盘点单ID
            item_data: 盘点明细创建数据
            created_by: 创建人ID

        Returns:
            StocktakingItemResponse: 创建的盘点明细信息

        Raises:
            NotFoundError: 盘点单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 检查盘点单是否存在
            stocktaking = await Stocktaking.get_or_none(
                id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

            # 检查盘点单状态
            if stocktaking.status not in ['draft', 'in_progress']:
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能添加明细")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建盘点明细
            item = await StocktakingItem.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                stocktaking_id=stocktaking_id,
                material_id=item_data.material_id,
                material_code=item_data.material_code,
                material_name=item_data.material_name,
                warehouse_id=item_data.warehouse_id,
                location_id=item_data.location_id,
                location_code=item_data.location_code,
                batch_no=item_data.batch_no,
                book_quantity=item_data.book_quantity,
                actual_quantity=item_data.actual_quantity,
                difference_quantity=Decimal("0"),
                unit_price=item_data.unit_price,
                difference_amount=Decimal("0"),
                status="pending",
                remarks=item_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            # 更新盘点单的物料总数
            stocktaking.total_items = await StocktakingItem.filter(
                stocktaking_id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).count()

            await stocktaking.save()

            return StocktakingItemResponse.model_validate(item)

    async def update_stocktaking_item(
        self,
        tenant_id: int,
        item_id: int,
        item_data: StocktakingItemUpdate,
        updated_by: int
    ) -> StocktakingItemResponse:
        """
        更新盘点明细（主要用于更新实际数量）

        Args:
            tenant_id: 组织ID
            item_id: 盘点明细ID
            item_data: 盘点明细更新数据
            updated_by: 更新人ID

        Returns:
            StocktakingItemResponse: 更新后的盘点明细信息

        Raises:
            NotFoundError: 盘点明细不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取盘点明细
            item = await StocktakingItem.get_or_none(
                id=item_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not item:
                raise NotFoundError(f"盘点明细不存在: {item_id}")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新字段
            if item_data.actual_quantity is not None:
                item.actual_quantity = item_data.actual_quantity
                # 重新计算差异数量
                item.difference_quantity = item.actual_quantity - item.book_quantity
                # 重新计算差异金额
                item.difference_amount = item.difference_quantity * item.unit_price
            if item_data.remarks is not None:
                item.remarks = item_data.remarks

            item.updated_by = updated_by
            item.updated_by_name = user_info["name"]

            await item.save()

            # 更新盘点单统计信息
            await self._update_stocktaking_statistics(tenant_id, item.stocktaking_id)

            return StocktakingItemResponse.model_validate(item)

    async def list_stocktakings(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        warehouse_id: Optional[int] = None,
        status: Optional[str] = None,
        stocktaking_type: Optional[str] = None,
        stocktaking_date_start: Optional[datetime] = None,
        stocktaking_date_end: Optional[datetime] = None,
    ) -> StocktakingListResponse:
        """
        获取库存盘点单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            warehouse_id: 仓库ID（可选）
            status: 状态（可选）
            stocktaking_date_start: 盘点开始日期（可选）
            stocktaking_date_end: 盘点结束日期（可选）

        Returns:
            List[StocktakingListResponse]: 盘点单列表
        """
        query = Stocktaking.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if code:
            query = query.filter(code__icontains=code)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)
        if status:
            query = query.filter(status=status)
        if stocktaking_type:
            query = query.filter(stocktaking_type=stocktaking_type)
        if stocktaking_date_start:
            query = query.filter(stocktaking_date__gte=stocktaking_date_start)
        if stocktaking_date_end:
            query = query.filter(stocktaking_date__lte=stocktaking_date_end)

        # 获取总数
        total = await query.count()

        # 获取列表
        stocktakings = await query.order_by('-created_at').offset(skip).limit(limit)

        # 返回分页响应
        from typing import List
        return StocktakingListResponse(
            items=[StocktakingResponse.model_validate(st) for st in stocktakings],
            total=total
        )

    async def add_stocktaking_items(
        self,
        tenant_id: int,
        stocktaking_id: int,
        items: List[StocktakingItemCreate],
        created_by: int
    ) -> List[StocktakingItemResponse]:
        """
        添加盘点明细

        Args:
            tenant_id: 组织ID
            stocktaking_id: 盘点单ID
            items: 盘点明细列表
            created_by: 创建人ID

        Returns:
            List[StocktakingItemResponse]: 创建的盘点明细列表

        Raises:
            NotFoundError: 盘点单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 检查盘点单是否存在
            stocktaking = await Stocktaking.get_or_none(
                id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

            # 检查盘点单状态
            if stocktaking.status not in ['draft', 'in_progress']:
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能添加明细")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建盘点明细
            created_items = []
            for item_data in items:
                # TODO: 从库存服务获取账面数量（book_quantity）
                # 这里简化处理，假设item_data中已包含账面数量

                item = await StocktakingItem.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    stocktaking_id=stocktaking_id,
                    material_id=item_data.material_id,
                    material_code=item_data.material_code,
                    material_name=item_data.material_name,
                    warehouse_id=item_data.warehouse_id,
                    location_id=item_data.location_id,
                    location_code=item_data.location_code,
                    batch_no=item_data.batch_no,
                    book_quantity=item_data.book_quantity,
                    actual_quantity=item_data.actual_quantity,
                    difference_quantity=Decimal("0"),
                    unit_price=item_data.unit_price,
                    difference_amount=Decimal("0"),
                    status="pending",
                    remarks=item_data.remarks,
                    created_by=created_by,
                    created_by_name=user_info["name"],
                    updated_by=created_by,
                    updated_by_name=user_info["name"],
                )

                created_items.append(item)

            # 更新盘点单的物料总数
            stocktaking.total_items = await StocktakingItem.filter(
                stocktaking_id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).count()

            await stocktaking.save()

            return [StocktakingItemResponse.model_validate(item) for item in created_items]

    async def execute_stocktaking_item(
        self,
        tenant_id: int,
        item_id: int,
        actual_quantity: Decimal,
        counted_by: int,
        remarks: Optional[str] = None
    ) -> StocktakingItemResponse:
        """
        执行盘点明细（更新实际数量）

        Args:
            tenant_id: 组织ID
            item_id: 盘点明细ID
            actual_quantity: 实际数量
            counted_by: 盘点人ID
            remarks: 备注（可选）

        Returns:
            StocktakingItemResponse: 更新后的盘点明细信息

        Raises:
            NotFoundError: 盘点明细不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取盘点明细
            item = await StocktakingItem.get_or_none(
                id=item_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not item:
                raise NotFoundError(f"盘点明细不存在: {item_id}")

            # 检查盘点单状态
            stocktaking = await Stocktaking.get_or_none(
                id=item.stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {item.stocktaking_id}")

            if stocktaking.status not in ['draft', 'in_progress']:
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能执行盘点")

            # 获取盘点人信息
            user_info = await self.get_user_info(counted_by)

            # 计算差异
            difference_quantity = actual_quantity - item.book_quantity
            difference_amount = difference_quantity * item.unit_price

            # 更新盘点明细
            item.actual_quantity = actual_quantity
            item.difference_quantity = difference_quantity
            item.difference_amount = difference_amount
            item.counted_by = counted_by
            item.counted_by_name = user_info["name"]
            item.counted_at = datetime.now()
            item.status = "counted"
            if remarks:
                item.remarks = remarks
            item.updated_by = counted_by
            item.updated_by_name = user_info["name"]

            await item.save()

            # 更新盘点单统计信息
            await self._update_stocktaking_statistics(tenant_id, item.stocktaking_id)

            return StocktakingItemResponse.model_validate(item)

    async def adjust_stocktaking_differences(
        self,
        tenant_id: int,
        stocktaking_id: int,
        adjusted_by: int
    ) -> StocktakingResponse:
        """
        处理盘点差异（调整库存）

        Args:
            tenant_id: 组织ID
            stocktaking_id: 盘点单ID
            adjusted_by: 调整人ID

        Returns:
            StocktakingResponse: 更新后的盘点单信息

        Raises:
            NotFoundError: 盘点单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取盘点单
            stocktaking = await Stocktaking.get_or_none(
                id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not stocktaking:
                raise NotFoundError(f"盘点单不存在: {stocktaking_id}")

            if stocktaking.status != 'in_progress':
                raise ValidationError(f"盘点单状态为{stocktaking.status}，不能处理差异")

            # 获取所有有差异的明细
            items = await StocktakingItem.filter(
                stocktaking_id=stocktaking_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                difference_quantity__ne=Decimal("0")
            )

            # TODO: 调用库存服务调整库存
            # 对于每个有差异的明细，更新库存数量
            for item in items:
                # TODO: 调用库存服务更新库存
                # inventory_service.adjust_inventory(
                #     material_id=item.material_id,
                #     warehouse_id=item.warehouse_id,
                #     quantity=item.difference_quantity,
                #     ...
                # )
                item.status = "adjusted"
                await item.save()

            # 获取调整人信息
            user_info = await self.get_user_info(adjusted_by)

            # 更新盘点单状态为已完成
            stocktaking.status = "completed"
            stocktaking.completed_by = adjusted_by
            stocktaking.completed_by_name = user_info["name"]
            stocktaking.completed_at = datetime.now()
            stocktaking.updated_by = adjusted_by
            stocktaking.updated_by_name = user_info["name"]

            await stocktaking.save()

            return StocktakingResponse.model_validate(stocktaking)

    async def _update_stocktaking_statistics(
        self,
        tenant_id: int,
        stocktaking_id: int
    ) -> None:
        """
        更新盘点单统计信息

        Args:
            tenant_id: 组织ID
            stocktaking_id: 盘点单ID
        """
        # 获取所有明细
        items = await StocktakingItem.filter(
            stocktaking_id=stocktaking_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        # 统计信息
        total_items = len(items)
        counted_items = sum(1 for item in items if item.status == "counted")
        total_differences = sum(1 for item in items if item.difference_quantity != Decimal("0"))
        total_difference_amount = sum(item.difference_amount for item in items)

        # 更新盘点单
        stocktaking = await Stocktaking.get_or_none(
            id=stocktaking_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if stocktaking:
            stocktaking.total_items = total_items
            stocktaking.counted_items = counted_items
            stocktaking.total_differences = total_differences
            stocktaking.total_difference_amount = total_difference_amount

            # 如果所有明细都已盘点，更新状态为in_progress
            if counted_items == total_items and total_items > 0:
                if stocktaking.status == "draft":
                    stocktaking.status = "in_progress"

            await stocktaking.save()

