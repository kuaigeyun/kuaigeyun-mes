"""
返工单业务服务模块

提供返工单相关的业务逻辑处理，包括CRUD操作、状态流转等。

Author: Luigi Lu
Date: 2026-01-04
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.rework_order import ReworkOrder
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.rework_order import (
    ReworkOrderCreate,
    ReworkOrderUpdate,
    ReworkOrderResponse,
    ReworkOrderListResponse
)
from loguru import logger


class ReworkOrderService(AppBaseService[ReworkOrder]):
    """
    返工单服务类

    处理返工单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(ReworkOrder)

    async def create_rework_order(
        self,
        tenant_id: int,
        rework_order_data: ReworkOrderCreate,
        created_by: int
    ) -> ReworkOrderResponse:
        """
        创建返工单

        Args:
            tenant_id: 组织ID
            rework_order_data: 返工单创建数据
            created_by: 创建人ID

        Returns:
            ReworkOrderResponse: 创建的返工单信息

        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 生成返工单编码（如果未提供）
            if not rework_order_data.code:
                # 返工单编码格式：返工-{原工单号}-{序号}
                if rework_order_data.original_work_order_uuid:
                    # 根据原工单UUID获取原工单编码
                    original_work_order = await WorkOrder.filter(
                        tenant_id=tenant_id,
                        uuid=rework_order_data.original_work_order_uuid
                    ).first()
                    
                    if not original_work_order:
                        raise NotFoundError(f"原工单不存在: {rework_order_data.original_work_order_uuid}")
                    
                    original_code = original_work_order.code
                elif rework_order_data.original_work_order_id:
                    # 根据原工单ID获取原工单编码
                    original_work_order = await WorkOrder.filter(
                        tenant_id=tenant_id,
                        id=rework_order_data.original_work_order_id
                    ).first()
                    
                    if not original_work_order:
                        raise NotFoundError(f"原工单不存在: {rework_order_data.original_work_order_id}")
                    
                    original_code = original_work_order.code
                    # 同时更新UUID
                    rework_order_data.original_work_order_uuid = original_work_order.uuid
                else:
                    # 如果没有原工单信息，使用默认前缀
                    original_code = "WO"
                
                # 查询该原工单已创建的返工单数量，用于生成序号
                existing_count = await ReworkOrder.filter(
                    tenant_id=tenant_id,
                    original_work_order_id=original_work_order.id if rework_order_data.original_work_order_id else None,
                    original_work_order_uuid=rework_order_data.original_work_order_uuid
                ).count()
                
                seq = existing_count + 1
                code = f"返工-{original_code}-{seq:03d}"
            else:
                code = rework_order_data.code

            # 检查编码是否已存在
            existing = await ReworkOrder.filter(
                tenant_id=tenant_id,
                code=code
            ).first()
            
            if existing:
                raise ValidationError(f"返工单编码已存在: {code}")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建返工单
            rework_order = await ReworkOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                original_work_order_id=rework_order_data.original_work_order_id,
                original_work_order_uuid=rework_order_data.original_work_order_uuid,
                product_id=rework_order_data.product_id,
                product_code=rework_order_data.product_code,
                product_name=rework_order_data.product_name,
                quantity=rework_order_data.quantity,
                rework_reason=rework_order_data.rework_reason,
                rework_type=rework_order_data.rework_type,
                status=rework_order_data.status,
                planned_start_date=rework_order_data.planned_start_date,
                planned_end_date=rework_order_data.planned_end_date,
                actual_start_date=rework_order_data.actual_start_date,
                actual_end_date=rework_order_data.actual_end_date,
                workshop_id=rework_order_data.workshop_id,
                workshop_name=rework_order_data.workshop_name,
                work_center_id=rework_order_data.work_center_id,
                work_center_name=rework_order_data.work_center_name,
                completed_quantity=rework_order_data.completed_quantity,
                qualified_quantity=rework_order_data.qualified_quantity,
                unqualified_quantity=rework_order_data.unqualified_quantity,
                remarks=rework_order_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
            )

            logger.info(f"创建返工单成功: {code} (租户: {tenant_id})")
            return ReworkOrderResponse.model_validate(rework_order)

    async def create_rework_order_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        rework_order_data: ReworkOrderCreate,
        created_by: int
    ) -> ReworkOrderResponse:
        """
        从原工单创建返工单

        Args:
            tenant_id: 组织ID
            work_order_id: 原工单ID
            rework_order_data: 返工单创建数据（部分字段可从原工单继承）
            created_by: 创建人ID

        Returns:
            ReworkOrderResponse: 创建的返工单信息

        Raises:
            NotFoundError: 原工单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取原工单信息
            original_work_order = await WorkOrder.filter(
                tenant_id=tenant_id,
                id=work_order_id
            ).first()
            
            if not original_work_order:
                raise NotFoundError(f"原工单不存在: {work_order_id}")

            # 从原工单继承信息（如果返工单数据中未提供）
            if not rework_order_data.original_work_order_id:
                rework_order_data.original_work_order_id = original_work_order.id
            if not rework_order_data.original_work_order_uuid:
                rework_order_data.original_work_order_uuid = original_work_order.uuid
            if not rework_order_data.product_id:
                rework_order_data.product_id = original_work_order.product_id
            if not rework_order_data.product_code:
                rework_order_data.product_code = original_work_order.product_code
            if not rework_order_data.product_name:
                rework_order_data.product_name = original_work_order.product_name
            if not rework_order_data.workshop_id:
                rework_order_data.workshop_id = original_work_order.workshop_id
            if not rework_order_data.workshop_name:
                rework_order_data.workshop_name = original_work_order.workshop_name
            if not rework_order_data.work_center_id:
                rework_order_data.work_center_id = original_work_order.work_center_id
            if not rework_order_data.work_center_name:
                rework_order_data.work_center_name = original_work_order.work_center_name

            # 创建返工单
            return await self.create_rework_order(
                tenant_id=tenant_id,
                rework_order_data=rework_order_data,
                created_by=created_by
            )

    async def get_rework_order_by_id(
        self,
        tenant_id: int,
        rework_order_id: int
    ) -> ReworkOrderResponse:
        """
        根据ID获取返工单

        Args:
            tenant_id: 组织ID
            rework_order_id: 返工单ID

        Returns:
            ReworkOrderResponse: 返工单信息

        Raises:
            NotFoundError: 返工单不存在
        """
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        return ReworkOrderResponse.model_validate(rework_order)

    async def list_rework_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        status: Optional[str] = None,
        original_work_order_id: Optional[int] = None,
        product_id: Optional[int] = None
    ) -> List[ReworkOrderListResponse]:
        """
        查询返工单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            code: 返工单编码（模糊查询）
            status: 返工单状态
            original_work_order_id: 原工单ID
            product_id: 产品ID

        Returns:
            List[ReworkOrderListResponse]: 返工单列表
        """
        query = Q(tenant_id=tenant_id)

        if code:
            query &= Q(code__icontains=code)
        if status:
            query &= Q(status=status)
        if original_work_order_id:
            query &= Q(original_work_order_id=original_work_order_id)
        if product_id:
            query &= Q(product_id=product_id)

        rework_orders = await ReworkOrder.filter(query).offset(skip).limit(limit).order_by("-created_at")
        return [ReworkOrderListResponse.model_validate(ro) for ro in rework_orders]

    async def update_rework_order(
        self,
        tenant_id: int,
        rework_order_id: int,
        rework_order_data: ReworkOrderUpdate,
        updated_by: int
    ) -> ReworkOrderResponse:
        """
        更新返工单

        Args:
            tenant_id: 组织ID
            rework_order_id: 返工单ID
            rework_order_data: 返工单更新数据
            updated_by: 更新人ID

        Returns:
            ReworkOrderResponse: 更新后的返工单信息

        Raises:
            NotFoundError: 返工单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新字段
            update_data = rework_order_data.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(rework_order, key, value)

            # 更新更新人信息
            rework_order.updated_by = updated_by
            rework_order.updated_by_name = user_info["name"]

            await rework_order.save()

            logger.info(f"更新返工单成功: {rework_order.code} (租户: {tenant_id})")
            return ReworkOrderResponse.model_validate(rework_order)

    async def delete_rework_order(
        self,
        tenant_id: int,
        rework_order_id: int
    ) -> None:
        """
        删除返工单（软删除）

        Args:
            tenant_id: 组织ID
            rework_order_id: 返工单ID

        Raises:
            NotFoundError: 返工单不存在
        """
        async with in_transaction():
            rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)

            # 软删除
            rework_order.deleted_at = datetime.utcnow()
            await rework_order.save()

            logger.info(f"删除返工单成功: {rework_order.code} (租户: {tenant_id})")

