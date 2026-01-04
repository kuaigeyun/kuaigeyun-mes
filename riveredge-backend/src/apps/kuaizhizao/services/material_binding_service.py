"""
物料绑定业务服务模块

提供物料绑定记录相关的业务逻辑处理，包括上料绑定、下料绑定等。

Author: Luigi Lu
Date: 2025-01-04
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.material_binding import MaterialBinding
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.material_binding import (
    MaterialBindingCreateFromReporting,
    MaterialBindingResponse,
    MaterialBindingListResponse,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class MaterialBindingService(AppBaseService[MaterialBinding]):
    """
    物料绑定服务类

    处理物料绑定记录相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(MaterialBinding)

    async def create_material_binding_from_reporting(
        self,
        tenant_id: int,
        reporting_record_id: int,
        binding_data: MaterialBindingCreateFromReporting,
        bound_by: int
    ) -> MaterialBindingResponse:
        """
        从报工记录创建物料绑定记录

        Args:
            tenant_id: 组织ID
            reporting_record_id: 报工记录ID
            binding_data: 物料绑定创建数据
            bound_by: 绑定人ID

        Returns:
            MaterialBindingResponse: 创建的物料绑定记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取报工记录
            reporting_record = await ReportingRecord.get_or_none(
                id=reporting_record_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not reporting_record:
                raise NotFoundError(f"报工记录不存在: {reporting_record_id}")

            # 获取工单信息
            work_order = await WorkOrder.get_or_none(
                id=reporting_record.work_order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {reporting_record.work_order_id}")

            # 获取物料信息（这里需要从物料服务获取，简化处理，假设binding_data中已包含物料信息）
            # TODO: 从物料服务获取物料详细信息
            material_code = binding_data.material_id  # 临时处理，实际应从物料服务获取
            material_name = f"物料{binding_data.material_id}"  # 临时处理

            # 获取绑定人信息
            user_info = await self.get_user_info(bound_by)

            # 获取仓库信息（如果提供了仓库ID）
            warehouse_name = None
            if binding_data.warehouse_id:
                # TODO: 从仓库服务获取仓库名称
                warehouse_name = f"仓库{binding_data.warehouse_id}"  # 临时处理

            # 创建物料绑定记录
            material_binding = await MaterialBinding.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                reporting_record_id=reporting_record_id,
                work_order_id=reporting_record.work_order_id,
                work_order_code=reporting_record.work_order_code,
                operation_id=reporting_record.operation_id,
                operation_code=reporting_record.operation_code,
                operation_name=reporting_record.operation_name,
                binding_type=binding_data.binding_type,
                material_id=binding_data.material_id,
                material_code=material_code,
                material_name=material_name,
                quantity=binding_data.quantity,
                warehouse_id=binding_data.warehouse_id,
                warehouse_name=warehouse_name,
                location_id=binding_data.location_id,
                location_code=binding_data.location_code,
                batch_no=binding_data.batch_no,
                barcode=binding_data.barcode,
                binding_method=binding_data.binding_method,
                bound_by=bound_by,
                bound_by_name=user_info["name"],
                bound_at=binding_data.bound_at or datetime.now(),
                remarks=binding_data.remarks,
            )

            # TODO: 更新库存（根据绑定类型进行上料或下料的库存操作）
            # - 上料（feeding）：减少库存
            # - 下料（discharging）：增加库存

            return MaterialBindingResponse.model_validate(material_binding)

    async def get_material_bindings_by_reporting_record(
        self,
        tenant_id: int,
        reporting_record_id: int
    ) -> List[MaterialBindingListResponse]:
        """
        根据报工记录ID获取物料绑定记录列表

        Args:
            tenant_id: 组织ID
            reporting_record_id: 报工记录ID

        Returns:
            List[MaterialBindingListResponse]: 物料绑定记录列表
        """
        bindings = await MaterialBinding.filter(
            tenant_id=tenant_id,
            reporting_record_id=reporting_record_id,
            deleted_at__isnull=True
        ).order_by('-bound_at')

        return [MaterialBindingListResponse.model_validate(binding) for binding in bindings]

    async def delete_material_binding(
        self,
        tenant_id: int,
        binding_id: int
    ) -> None:
        """
        删除物料绑定记录（软删除）

        Args:
            tenant_id: 组织ID
            binding_id: 物料绑定记录ID

        Raises:
            NotFoundError: 物料绑定记录不存在
        """
        binding = await MaterialBinding.get_or_none(
            id=binding_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not binding:
            raise NotFoundError(f"物料绑定记录不存在: {binding_id}")

        # 软删除
        binding.deleted_at = datetime.now()
        await binding.save()

        # TODO: 恢复库存（根据绑定类型进行反向操作）

