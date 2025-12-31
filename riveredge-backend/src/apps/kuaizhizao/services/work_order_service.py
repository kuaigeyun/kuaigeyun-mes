"""
工单业务服务模块

提供工单相关的业务逻辑处理，包括CRUD操作、状态流转等。

Author: Luigi Lu
Date: 2025-01-01
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderListResponse
)


class WorkOrderService(AppBaseService[WorkOrder]):
    """
    工单服务类

    处理工单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(WorkOrder)

    async def create_work_order(
        self,
        tenant_id: int,
        work_order_data: WorkOrderCreate,
        created_by: int
    ) -> WorkOrderResponse:
        """
        创建工单

        Args:
            tenant_id: 组织ID
            work_order_data: 工单创建数据
            created_by: 创建人ID

        Returns:
            WorkOrderResponse: 创建的工单信息

        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 生成工单编码
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="WORK_ORDER_CODE",
                prefix=f"WO{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建工单
            work_order = await WorkOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                name=work_order_data.name,
                product_id=work_order_data.product_id,
                product_code=work_order_data.product_code,
                product_name=work_order_data.product_name,
                quantity=work_order_data.quantity,
                production_mode=work_order_data.production_mode,
                sales_order_id=work_order_data.sales_order_id,
                sales_order_code=work_order_data.sales_order_code,
                sales_order_name=work_order_data.sales_order_name,
                workshop_id=work_order_data.workshop_id,
                workshop_name=work_order_data.workshop_name,
                work_center_id=work_order_data.work_center_id,
                work_center_name=work_order_data.work_center_name,
                status=work_order_data.status,
                priority=work_order_data.priority,
                planned_start_date=work_order_data.planned_start_date,
                planned_end_date=work_order_data.planned_end_date,
                actual_start_date=work_order_data.actual_start_date,
                actual_end_date=work_order_data.actual_end_date,
                completed_quantity=work_order_data.completed_quantity,
                qualified_quantity=work_order_data.qualified_quantity,
                unqualified_quantity=work_order_data.unqualified_quantity,
                remarks=work_order_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
            )

            return WorkOrderResponse.model_validate(work_order)

    async def get_work_order_by_id(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> WorkOrderResponse:
        """
        根据ID获取工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID

        Returns:
            WorkOrderResponse: 工单信息

        Raises:
            NotFoundError: 工单不存在
        """
        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
        return WorkOrderResponse.model_validate(work_order)

    async def list_work_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        name: Optional[str] = None,
        product_name: Optional[str] = None,
        production_mode: Optional[str] = None,
        status: Optional[str] = None,
        workshop_id: Optional[int] = None,
        work_center_id: Optional[int] = None,
    ) -> List[WorkOrderListResponse]:
        """
        获取工单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            code: 工单编码（模糊搜索）
            name: 工单名称（模糊搜索）
            product_name: 产品名称（模糊搜索）
            production_mode: 生产模式
            status: 工单状态
            workshop_id: 车间ID
            work_center_id: 工作中心ID

        Returns:
            List[WorkOrderListResponse]: 工单列表
        """
        query = WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        # 添加筛选条件
        if code:
            query = query.filter(code__icontains=code)
        if name:
            query = query.filter(name__icontains=name)
        if product_name:
            query = query.filter(product_name__icontains=product_name)
        if production_mode:
            query = query.filter(production_mode=production_mode)
        if status:
            query = query.filter(status=status)
        if workshop_id:
            query = query.filter(workshop_id=workshop_id)
        if work_center_id:
            query = query.filter(work_center_id=work_center_id)

        work_orders = await query.offset(skip).limit(limit).order_by("-created_at").all()

        return [WorkOrderListResponse.model_validate(wo) for wo in work_orders]

    async def update_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        work_order_data: WorkOrderUpdate,
        updated_by: int
    ) -> WorkOrderResponse:
        """
        更新工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            work_order_data: 工单更新数据
            updated_by: 更新人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 更新字段
            update_data = work_order_data.model_dump(exclude_unset=True)
            
            work_order = await self.update_with_user(
                tenant_id=tenant_id,
                record_id=work_order_id,
                updated_by=updated_by,
                **update_data
            )

            return WorkOrderResponse.model_validate(work_order)

    async def delete_work_order(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> None:
        """
        删除工单（软删除）

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 不允许删除的工单状态
        """
        def validate_work_order(work_order):
            """验证工单是否可以删除"""
            if work_order.status not in ['draft', 'cancelled']:
                raise ValidationError("只能删除草稿状态或已取消的工单")

        await self.delete_with_validation(
            tenant_id=tenant_id,
            record_id=work_order_id,
            validate_func=validate_work_order,
            soft_delete=True
        )

    async def release_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        released_by: int
    ) -> WorkOrderResponse:
        """
        下达工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            released_by: 下达人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 不允许下达的工单状态
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            if work_order.status != 'draft':
                raise ValidationError("只能下达草稿状态的工单")

            # 更新状态
            work_order = await self.update_with_user(
                tenant_id=tenant_id,
                record_id=work_order_id,
                updated_by=released_by,
                status='released'
            )

            return WorkOrderResponse.model_validate(work_order)

    async def update_work_order_status(
        self,
        tenant_id: int,
        work_order_id: int,
        status: str,
        updated_by: int
    ) -> WorkOrderResponse:
        """
        更新工单状态

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            status: 新状态
            updated_by: 更新人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息
        """
        work_order = await self.update_with_user(
            tenant_id=tenant_id,
            record_id=work_order_id,
            updated_by=updated_by,
            status=status
        )
        return WorkOrderResponse.model_validate(work_order)
