"""
返工单业务服务模块

提供返工单相关的业务逻辑处理，包括CRUD操作、从工单创建返工单等。

Author: Luigi Lu
Date: 2026-01-05
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.rework_order import ReworkOrder
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.rework_order import (
    ReworkOrderCreate,
    ReworkOrderUpdate,
    ReworkOrderResponse,
    ReworkOrderListResponse,
    ReworkOrderFromWorkOrderRequest,
)
from loguru import logger


class ReworkOrderService(AppBaseService[ReworkOrder]):
    """
    返工单服务类

    处理返工单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(ReworkOrder)
        self.business_config_service = BusinessConfigService()

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
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "rework_order")
        if not is_enabled:
            raise BusinessLogicError("返工工单节点未启用，无法创建返工工单")
        async with in_transaction():
            # 生成返工单编码（如果未提供）
            if not rework_order_data.code:
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(
                    tenant_id=tenant_id,
                    code_type="REWORK_ORDER_CODE",
                    prefix=f"返工-{today}"
                )
            else:
                code = rework_order_data.code
                # 检查编码是否已存在
                existing = await ReworkOrder.filter(
                    tenant_id=tenant_id,
                    code=code,
                    deleted_at__isnull=True
                ).first()
                if existing:
                    raise ValidationError(f"返工单编码 {code} 已存在")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 如果关联了原工单，验证原工单是否存在
            if rework_order_data.original_work_order_id:
                original_work_order = await WorkOrder.get_or_none(
                    tenant_id=tenant_id,
                    id=rework_order_data.original_work_order_id,
                    deleted_at__isnull=True
                )
                if not original_work_order:
                    raise NotFoundError(f"原工单不存在: {rework_order_data.original_work_order_id}")

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
                route_id=rework_order_data.route_id,
                route_name=rework_order_data.route_name,
                status="draft",
                planned_start_date=rework_order_data.planned_start_date,
                planned_end_date=rework_order_data.planned_end_date,
                work_center_id=rework_order_data.work_center_id,
                work_center_name=rework_order_data.work_center_name,
                operator_id=rework_order_data.operator_id,
                operator_name=rework_order_data.operator_name,
                cost=Decimal("0"),
                remarks=rework_order_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            return ReworkOrderResponse.model_validate(rework_order)

    async def create_rework_order_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        request_data: ReworkOrderFromWorkOrderRequest,
        created_by: int
    ) -> ReworkOrderResponse:
        """
        从工单创建返工单

        Args:
            tenant_id: 组织ID
            work_order_id: 原工单ID
            request_data: 创建返工单请求数据
            created_by: 创建人ID

        Returns:
            ReworkOrderResponse: 创建的返工单信息

        Raises:
            NotFoundError: 原工单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取原工单
            original_work_order = await WorkOrder.get_or_none(
                tenant_id=tenant_id,
                id=work_order_id,
                deleted_at__isnull=True
            )
            if not original_work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")

            # 验证工单状态（只有已完成的工单才能创建返工单）
            if original_work_order.status not in ["completed", "in_progress"]:
                raise BusinessLogicError(f"只有已完成或进行中的工单才能创建返工单，当前工单状态: {original_work_order.status}")

            # 生成返工单编码
            today = datetime.now().strftime("%Y%m%d")
            # 查找该工单已创建的返工单数量
            existing_count = await ReworkOrder.filter(
                tenant_id=tenant_id,
                original_work_order_id=work_order_id,
                deleted_at__isnull=True
            ).count()
            sequence = existing_count + 1

            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="REWORK_ORDER_CODE",
                prefix=f"返工-{original_work_order.code}-{sequence:03d}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 确定返工数量（如果未提供则使用原工单数量）
            quantity = request_data.quantity if request_data.quantity else original_work_order.quantity

            # 创建返工单
            rework_order_data = ReworkOrderCreate(
                code=code,
                original_work_order_id=work_order_id,
                original_work_order_uuid=original_work_order.uuid,
                product_id=original_work_order.product_id,
                product_code=original_work_order.product_code,
                product_name=original_work_order.product_name,
                quantity=quantity,
                rework_reason=request_data.rework_reason,
                rework_type=request_data.rework_type,
                route_id=request_data.route_id,
                work_center_id=request_data.work_center_id or original_work_order.work_center_id,
                work_center_name=original_work_order.work_center_name if not request_data.work_center_id else None,
                remarks=request_data.remarks,
            )

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

    async def get_rework_order_by_uuid(
        self,
        tenant_id: int,
        rework_order_uuid: str
    ) -> ReworkOrderResponse:
        """
        根据UUID获取返工单

        Args:
            tenant_id: 组织ID
            rework_order_uuid: 返工单UUID

        Returns:
            ReworkOrderResponse: 返工单信息

        Raises:
            NotFoundError: 返工单不存在
        """
        rework_order = await ReworkOrder.get_or_none(
            tenant_id=tenant_id,
            uuid=rework_order_uuid,
            deleted_at__isnull=True
        )
        if not rework_order:
            raise NotFoundError(f"返工单不存在: {rework_order_uuid}")
        return ReworkOrderResponse.model_validate(rework_order)

    async def list_rework_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        original_work_order_id: Optional[int] = None,
        product_name: Optional[str] = None,
        status: Optional[str] = None,
        rework_type: Optional[str] = None,
    ) -> List[ReworkOrderListResponse]:
        """
        获取返工单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            code: 返工单编码（模糊搜索）
            original_work_order_id: 原工单ID
            product_name: 产品名称（模糊搜索）
            status: 返工单状态
            rework_type: 返工类型

        Returns:
            List[ReworkOrderListResponse]: 返工单列表
        """
        from tortoise.queryset import Q

        query = ReworkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        # 应用过滤条件
        if code:
            query = query.filter(code__icontains=code)
        if original_work_order_id:
            query = query.filter(original_work_order_id=original_work_order_id)
        if product_name:
            query = query.filter(product_name__icontains=product_name)
        if status:
            query = query.filter(status=status)
        if rework_type:
            query = query.filter(rework_type=rework_type)

        rework_orders = await query.offset(skip).limit(limit).order_by("-created_at")
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
            # 获取返工单
            rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)

            # 验证状态（已完成的返工单不允许修改）
            if rework_order.status == "completed":
                raise BusinessLogicError("已完成的返工单不允许修改")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新字段
            update_data = rework_order_data.model_dump(exclude_unset=True)
            update_data["updated_by"] = updated_by
            update_data["updated_by_name"] = user_info["name"]

            # 如果状态变更为in_progress，记录实际开始时间
            if "status" in update_data and update_data["status"] == "in_progress" and not rework_order.actual_start_date:
                update_data["actual_start_date"] = datetime.now()

            # 如果状态变更为completed，记录实际结束时间
            if "status" in update_data and update_data["status"] == "completed" and not rework_order.actual_end_date:
                update_data["actual_end_date"] = datetime.now()

            await ReworkOrder.filter(
                tenant_id=tenant_id,
                id=rework_order_id
            ).update(**update_data)

            # 返回更新后的返工单
            updated_rework_order = await self.get_rework_order_by_id(tenant_id, rework_order_id)
            return updated_rework_order

    async def delete_rework_order(
        self,
        tenant_id: int,
        rework_order_id: int
    ) -> bool:
        """
        删除返工单（软删除）

        Args:
            tenant_id: 组织ID
            rework_order_id: 返工单ID

        Returns:
            bool: 删除是否成功

        Raises:
            NotFoundError: 返工单不存在
            BusinessLogicError: 已完成的返工单不允许删除
        """
        async with in_transaction():
            # 获取返工单
            rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)

            # 验证状态（已完成的返工单不允许删除）
            if rework_order.status == "completed":
                raise BusinessLogicError("已完成的返工单不允许删除")

            # 软删除
            await ReworkOrder.filter(
                tenant_id=tenant_id,
                id=rework_order_id
            ).update(deleted_at=datetime.now())

            return True
