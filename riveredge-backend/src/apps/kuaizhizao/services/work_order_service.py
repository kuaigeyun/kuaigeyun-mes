"""
工单业务服务模块

提供工单相关的业务逻辑处理，包括CRUD操作、状态流转等。
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.services.user_service import UserService

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderListResponse
)


class WorkOrderService:
    """
    工单服务类

    处理工单相关的所有业务逻辑。
    """

    @staticmethod
    async def create_work_order(
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
            # 获取创建人信息
            creator = await UserService.get_user_by_id(created_by)
            created_by_name = f"{creator.first_name or ''} {creator.last_name or ''}".strip() or creator.username

            # 生成工单编码
            code = await WorkOrderService._generate_work_order_code(tenant_id)

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
                created_by_name=created_by_name,
            )

            return WorkOrderResponse.model_validate(work_order)

    @staticmethod
    async def get_work_order_by_id(
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
        work_order = await WorkOrder.get_or_none(
            id=work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        return WorkOrderResponse.model_validate(work_order)

    @staticmethod
    async def list_work_orders(
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

    @staticmethod
    async def update_work_order(
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
            work_order = await WorkOrder.get_or_none(
                id=work_order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")

            # 获取更新人信息
            updater = await UserService.get_user_by_id(updated_by)
            updated_by_name = f"{updater.first_name or ''} {updater.last_name or ''}".strip() or updater.username

            # 更新字段
            update_data = work_order_data.model_dump(exclude_unset=True)
            update_data['updated_by'] = updated_by
            update_data['updated_by_name'] = updated_by_name
            update_data['updated_at'] = datetime.now()

            await work_order.update_from_dict(update_data).save()

            return WorkOrderResponse.model_validate(work_order)

    @staticmethod
    async def delete_work_order(
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
        work_order = await WorkOrder.get_or_none(
            id=work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        # 检查是否可以删除
        if work_order.status not in ['draft', 'cancelled']:
            raise ValidationError("只能删除草稿状态或已取消的工单")

        # 软删除
        work_order.deleted_at = datetime.now()
        await work_order.save()

    @staticmethod
    async def release_work_order(
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
        work_order = await WorkOrder.get_or_none(
            id=work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        if work_order.status != 'draft':
            raise ValidationError("只能下达草稿状态的工单")

        # 更新状态
        work_order.status = 'released'
        work_order.updated_by = released_by
        work_order.updated_at = datetime.now()

        await work_order.save()

        return WorkOrderResponse.model_validate(work_order)

    @staticmethod
    async def _generate_work_order_code(tenant_id: int) -> str:
        """
        生成工单编码

        格式：WO{YYYYMMDD}{序号}

        Args:
            tenant_id: 组织ID

        Returns:
            str: 工单编码
        """
        today = datetime.now().strftime("%Y%m%d")
        prefix = f"WO{today}"

        # 查询今天已有的最大序号
        existing_codes = await WorkOrder.filter(
            tenant_id=tenant_id,
            code__startswith=prefix,
            deleted_at__isnull=True
        ).values_list('code', flat=True)

        max_sequence = 0
        for code in existing_codes:
            try:
                sequence = int(code[len(prefix):])
                max_sequence = max(max_sequence, sequence)
            except ValueError:
                continue

        new_sequence = max_sequence + 1
        return f"{prefix}{new_sequence:03d}"
