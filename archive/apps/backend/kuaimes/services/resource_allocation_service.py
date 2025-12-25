"""
人机料法资源分配服务模块

提供人机料法（人、机、料、法）的关联管理和资源分配功能。
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from apps.kuaimes.models.work_order import WorkOrder
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ResourceAllocationService:
    """人机料法资源分配服务"""

    @staticmethod
    async def allocate_equipment_to_work_order(
        tenant_id: int,
        work_order_uuid: str,
        equipment_id: int,
        equipment_name: str,
        equipment_code: str
    ) -> WorkOrder:
        """
        为工单分配设备

        Args:
            tenant_id: 租户ID
            work_order_uuid: 工单UUID
            equipment_id: 设备ID
            equipment_name: 设备名称
            equipment_code: 设备编码

        Returns:
            WorkOrder: 更新后的工单对象

        Raises:
            NotFoundError: 当工单不存在时抛出
            ValidationError: 当设备已被占用时抛出
        """
        work_order = await WorkOrder.filter(
            tenant_id=tenant_id,
            uuid=work_order_uuid,
            deleted_at__isnull=True
        ).first()

        if not work_order:
            raise NotFoundError(f"工单 {work_order_uuid} 不存在")

        # 检查设备是否已被其他工单占用（在同一时间段）
        # 这里可以根据实际需求添加设备占用检查逻辑

        # 分配设备
        work_order.equipment_id = equipment_id
        work_order.equipment_name = equipment_name
        work_order.equipment_code = equipment_code
        await work_order.save()

        return work_order

    @staticmethod
    async def allocate_operator_to_work_order(
        tenant_id: int,
        work_order_uuid: str,
        operator_id: int,
        operator_name: str
    ) -> WorkOrder:
        """
        为工单分配操作员

        Args:
            tenant_id: 租户ID
            work_order_uuid: 工单UUID
            operator_id: 操作员ID
            operator_name: 操作员姓名

        Returns:
            WorkOrder: 更新后的工单对象

        Raises:
            NotFoundError: 当工单不存在时抛出
        """
        work_order = await WorkOrder.filter(
            tenant_id=tenant_id,
            uuid=work_order_uuid,
            deleted_at__isnull=True
        ).first()

        if not work_order:
            raise NotFoundError(f"工单 {work_order_uuid} 不存在")

        # 分配操作员
        work_order.operator_id = operator_id
        work_order.operator_name = operator_name
        await work_order.save()

        return work_order

    @staticmethod
    async def set_work_order_materials(
        tenant_id: int,
        work_order_uuid: str,
        materials: List[Dict[str, Any]],
        material_requirements: Optional[str] = None
    ) -> WorkOrder:
        """
        设置工单所需材料

        Args:
            tenant_id: 租户ID
            work_order_uuid: 工单UUID
            materials: 材料清单
            material_requirements: 材料需求说明

        Returns:
            WorkOrder: 更新后的工单对象

        Raises:
            NotFoundError: 当工单不存在时抛出
        """
        work_order = await WorkOrder.filter(
            tenant_id=tenant_id,
            uuid=work_order_uuid,
            deleted_at__isnull=True
        ).first()

        if not work_order:
            raise NotFoundError(f"工单 {work_order_uuid} 不存在")

        # 设置材料信息
        work_order.materials = materials
        if material_requirements:
            work_order.material_requirements = material_requirements
        await work_order.save()

        return work_order

    @staticmethod
    async def set_work_order_process_method(
        tenant_id: int,
        work_order_uuid: str,
        process_method: str,
        quality_requirements: Optional[str] = None
    ) -> WorkOrder:
        """
        设置工单工艺方法

        Args:
            tenant_id: 租户ID
            work_order_uuid: 工单UUID
            process_method: 工艺方法说明
            quality_requirements: 质量要求

        Returns:
            WorkOrder: 更新后的工单对象

        Raises:
            NotFoundError: 当工单不存在时抛出
        """
        work_order = await WorkOrder.filter(
            tenant_id=tenant_id,
            uuid=work_order_uuid,
            deleted_at__isnull=True
        ).first()

        if not work_order:
            raise NotFoundError(f"工单 {work_order_uuid} 不存在")

        # 设置工艺方法
        work_order.process_method = process_method
        if quality_requirements:
            work_order.quality_requirements = quality_requirements
        await work_order.save()

        return work_order

    @staticmethod
    async def get_work_order_resource_allocation(
        tenant_id: int,
        work_order_uuid: str
    ) -> Dict[str, Any]:
        """
        获取工单的资源分配情况

        Args:
            tenant_id: 租户ID
            work_order_uuid: 工单UUID

        Returns:
            Dict[str, Any]: 资源分配信息

        Raises:
            NotFoundError: 当工单不存在时抛出
        """
        work_order = await WorkOrder.filter(
            tenant_id=tenant_id,
            uuid=work_order_uuid,
            deleted_at__isnull=True
        ).first()

        if not work_order:
            raise NotFoundError(f"工单 {work_order_uuid} 不存在")

        return {
            "work_order_uuid": work_order.uuid,
            "work_order_no": work_order.work_order_no,
            "resource_allocation": {
                "personnel": {  # 人
                    "operator_id": work_order.operator_id,
                    "operator_name": work_order.operator_name
                },
                "equipment": {  # 机
                    "equipment_id": work_order.equipment_id,
                    "equipment_name": work_order.equipment_name,
                    "equipment_code": work_order.equipment_code
                },
                "materials": {  # 料
                    "materials": work_order.materials,
                    "material_requirements": work_order.material_requirements
                },
                "method": {  # 法
                    "process_method": work_order.process_method,
                    "quality_requirements": work_order.quality_requirements,
                    "route_id": work_order.route_id,
                    "route_name": work_order.route_name
                }
            }
        }

    @staticmethod
    async def check_resource_availability(
        tenant_id: int,
        equipment_id: Optional[int] = None,
        operator_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        检查资源可用性

        Args:
            tenant_id: 租户ID
            equipment_id: 设备ID
            operator_id: 操作员ID
            start_date: 开始日期
            end_date: 结束日期

        Returns:
            Dict[str, Any]: 资源可用性检查结果
        """
        result = {
            "equipment_available": True,
            "operator_available": True,
            "conflicts": []
        }

        # 检查设备占用情况
        if equipment_id and start_date and end_date:
            conflicting_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                equipment_id=equipment_id,
                status__in=["已下发", "执行中", "暂停"],
                deleted_at__isnull=True
            ).filter(
                # 检查时间冲突（简化版）
                planned_start_date__lte=end_date,
                planned_end_date__gte=start_date
            )

            if conflicting_orders:
                result["equipment_available"] = False
                result["conflicts"].extend([
                    {
                        "type": "equipment",
                        "work_order_no": order.work_order_no,
                        "equipment_name": order.equipment_name
                    } for order in conflicting_orders
                ])

        # 检查操作员占用情况
        if operator_id and start_date and end_date:
            conflicting_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                operator_id=operator_id,
                status__in=["已下发", "执行中", "暂停"],
                deleted_at__isnull=True
            ).filter(
                planned_start_date__lte=end_date,
                planned_end_date__gte=start_date
            )

            if conflicting_orders:
                result["operator_available"] = False
                result["conflicts"].extend([
                    {
                        "type": "operator",
                        "work_order_no": order.work_order_no,
                        "operator_name": order.operator_name
                    } for order in conflicting_orders
                ])

        return result
