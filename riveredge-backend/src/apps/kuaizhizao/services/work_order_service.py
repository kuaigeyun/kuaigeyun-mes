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
from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
from apps.kuaizhizao.utils.inventory_helper import get_material_available_quantity
from loguru import logger


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

    async def check_material_shortage(
        self,
        tenant_id: int,
        work_order_id: int,
        warehouse_id: Optional[int] = None
    ) -> dict:
        """
        检查工单缺料情况

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            warehouse_id: 仓库ID（可选，如果为None则查询所有仓库）

        Returns:
            dict: 缺料检测结果，包含：
            - has_shortage: 是否有缺料
            - shortage_items: 缺料明细列表
            - total_shortage_count: 缺料物料总数
        """
        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

        # 获取BOM物料需求
        try:
            material_requirements = await calculate_material_requirements_from_bom(
                tenant_id=tenant_id,
                material_id=work_order.product_id,
                required_quantity=float(work_order.quantity),
                only_approved=True
            )
        except NotFoundError:
            # 如果没有BOM，返回无缺料
            logger.warning(f"工单 {work_order.code} 的产品 {work_order.product_id} 没有BOM，跳过缺料检测")
            return {
                "has_shortage": False,
                "shortage_items": [],
                "total_shortage_count": 0
            }

        shortage_items = []
        
        # 检查每个物料的需求和库存
        for requirement in material_requirements:
            # 获取可用库存
            available_quantity = await get_material_available_quantity(
                tenant_id=tenant_id,
                material_id=requirement.component_id,
                warehouse_id=warehouse_id
            )
            
            # 计算缺料数量
            shortage_quantity = max(Decimal(0), Decimal(str(requirement.net_requirement)) - available_quantity)
            
            if shortage_quantity > 0:
                shortage_items.append({
                    "material_id": requirement.component_id,
                    "material_code": requirement.component_code,
                    "material_name": requirement.component_name,
                    "required_quantity": float(requirement.net_requirement),
                    "available_quantity": float(available_quantity),
                    "shortage_quantity": float(shortage_quantity),
                    "unit": requirement.unit
                })

        return {
            "has_shortage": len(shortage_items) > 0,
            "shortage_items": shortage_items,
            "total_shortage_count": len(shortage_items),
            "work_order_id": work_order_id,
            "work_order_code": work_order.code,
            "work_order_name": work_order.name
        }

    async def release_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        released_by: int,
        check_shortage: bool = True
    ) -> WorkOrderResponse:
        """
        下达工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            released_by: 下达人ID
            check_shortage: 是否在下达前检查缺料（默认：True）

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 不允许下达的工单状态
            BusinessLogicError: 存在缺料时抛出（如果check_shortage=True）
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            if work_order.status != 'draft':
                raise ValidationError("只能下达草稿状态的工单")

            # 检查缺料
            if check_shortage:
                shortage_result = await self.check_material_shortage(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id
                )
                if shortage_result["has_shortage"]:
                    shortage_materials = ", ".join([
                        f"{item['material_name']}(缺{item['shortage_quantity']}{item['unit']})"
                        for item in shortage_result["shortage_items"][:3]
                    ])
                    raise BusinessLogicError(
                        f"工单存在缺料，无法下达。缺料物料：{shortage_materials}"
                        + (f"等{shortage_result['total_shortage_count']}种物料" 
                           if shortage_result['total_shortage_count'] > 3 else "")
                    )

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

    async def check_delayed_work_orders(
        self,
        tenant_id: int,
        days_threshold: int = 0,
        status: Optional[str] = None
    ) -> List[dict]:
        """
        检查延期工单

        Args:
            tenant_id: 组织ID
            days_threshold: 延期天数阈值（默认0，即只要超过计划结束日期就算延期）
            status: 工单状态过滤（可选）

        Returns:
            List[dict]: 延期工单列表，每个元素包含：
            - work_order_id: 工单ID
            - work_order_code: 工单编码
            - work_order_name: 工单名称
            - planned_end_date: 计划结束日期
            - actual_end_date: 实际结束日期
            - delay_days: 延期天数
            - status: 工单状态
        """
        now = datetime.now()
        query = WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        # 状态过滤
        if status:
            query = query.filter(status=status)
        else:
            # 默认只查询未完成的工单
            query = query.filter(status__in=['released', 'in_progress'])

        # 查询有计划结束日期且已过期的工单
        query = query.filter(
            planned_end_date__isnull=False,
            planned_end_date__lt=now
        )

        work_orders = await query.all()
        delayed_orders = []

        for wo in work_orders:
            if wo.planned_end_date:
                # 计算延期天数
                if wo.actual_end_date:
                    # 如果已完工，使用实际结束日期
                    delay_days = (wo.actual_end_date - wo.planned_end_date).days
                else:
                    # 如果未完工，使用当前日期
                    delay_days = (now - wo.planned_end_date).days

                # 如果超过阈值，加入列表
                if delay_days > days_threshold:
                    delayed_orders.append({
                        "work_order_id": wo.id,
                        "work_order_code": wo.code,
                        "work_order_name": wo.name,
                        "product_name": wo.product_name,
                        "planned_end_date": wo.planned_end_date.isoformat() if wo.planned_end_date else None,
                        "actual_end_date": wo.actual_end_date.isoformat() if wo.actual_end_date else None,
                        "delay_days": delay_days,
                        "status": wo.status,
                        "priority": wo.priority
                    })

        # 按延期天数降序排序
        delayed_orders.sort(key=lambda x: x["delay_days"], reverse=True)
        return delayed_orders

    async def analyze_delay_reasons(
        self,
        tenant_id: int,
        work_order_id: Optional[int] = None
    ) -> dict:
        """
        分析延期原因

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID（可选，如果为None则分析所有延期工单）

        Returns:
            dict: 延期原因分析结果，包含：
            - total_delayed: 延期工单总数
            - delay_reasons: 延期原因统计
            - work_orders: 延期工单详情列表
        """
        if work_order_id:
            # 分析单个工单
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            delayed_orders = await self.check_delayed_work_orders(
                tenant_id=tenant_id,
                status=work_order.status
            )
            # 过滤出指定工单
            delayed_orders = [wo for wo in delayed_orders if wo["work_order_id"] == work_order_id]
        else:
            # 分析所有延期工单
            delayed_orders = await self.check_delayed_work_orders(tenant_id=tenant_id)

        # 分析延期原因
        delay_reasons = {
            "material_shortage": 0,  # 缺料
            "capacity_shortage": 0,  # 产能不足
            "quality_issue": 0,  # 质量问题
            "planning_issue": 0,  # 计划问题
            "other": 0  # 其他
        }

        # TODO: 根据实际业务逻辑分析延期原因
        # 这里可以根据工单的关联数据（如缺料记录、报工记录、检验记录等）来判断延期原因
        for order in delayed_orders:
            # 简化实现：根据工单状态和延期天数推断原因
            if order["status"] == "released":
                # 已下达但未开始，可能是缺料或产能问题
                delay_reasons["material_shortage"] += 1
            elif order["status"] == "in_progress":
                # 进行中但延期，可能是产能或质量问题
                if order["delay_days"] > 7:
                    delay_reasons["capacity_shortage"] += 1
                else:
                    delay_reasons["planning_issue"] += 1
            else:
                delay_reasons["other"] += 1

        return {
            "total_delayed": len(delayed_orders),
            "delay_reasons": delay_reasons,
            "work_orders": delayed_orders
        }
