"""
设备状态监控服务模块

提供设备状态监控相关的业务逻辑。

Author: Luigi Lu
Date: 2026-01-16
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
from loguru import logger

from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.models.equipment_status_monitor import EquipmentStatusMonitor, EquipmentStatusHistory
from apps.kuaizhizao.schemas.equipment_status_monitor import (
    EquipmentStatusMonitorCreate,
    EquipmentStatusMonitorUpdate,
    EquipmentStatusUpdateRequest,
)
from apps.kuaizhizao.services.equipment_service import EquipmentService
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EquipmentStatusMonitorService:
    """
    设备状态监控服务类

    提供设备状态监控相关的业务逻辑。
    """

    def __init__(self):
        self.equipment_service = EquipmentService()
        self.work_order_service = WorkOrderService()

    async def create_status_monitor(
        self,
        tenant_id: int,
        data: EquipmentStatusMonitorCreate,
        created_by: Optional[int] = None
    ) -> EquipmentStatusMonitor:
        """
        创建设备状态监控记录

        Args:
            tenant_id: 租户ID
            data: 监控记录创建数据
            created_by: 创建人ID（可选）

        Returns:
            EquipmentStatusMonitor: 创建的监控记录对象

        Raises:
            NotFoundError: 当设备不存在时抛出
        """
        # 验证设备是否存在
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, data.equipment_uuid)

        # 创建监控记录
        monitor = EquipmentStatusMonitor(
            tenant_id=tenant_id,
            equipment_id=equipment.id,
            equipment_uuid=equipment.uuid,
            equipment_code=equipment.code,
            equipment_name=equipment.name,
            **data.model_dump(exclude={"equipment_uuid"}, exclude_none=True)
        )
        await monitor.save()

        # 如果状态发生变化，记录状态历史
        if equipment.status != data.status:
            await self._create_status_history(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                equipment_uuid=equipment.uuid,
                from_status=equipment.status,
                to_status=data.status,
                changed_by=created_by,
                reason="状态监控更新",
            )

            # 更新设备状态
            equipment.status = data.status
            await equipment.save()

        return monitor

    async def get_latest_status(
        self,
        tenant_id: int,
        equipment_uuid: str
    ) -> Optional[EquipmentStatusMonitor]:
        """
        获取设备最新状态

        Args:
            tenant_id: 租户ID
            equipment_uuid: 设备UUID

        Returns:
            Optional[EquipmentStatusMonitor]: 最新状态监控记录，如果不存在返回None
        """
        return await EquipmentStatusMonitor.filter(
            tenant_id=tenant_id,
            equipment_uuid=equipment_uuid,
            deleted_at__isnull=True
        ).order_by("-monitored_at").first()

    async def list_equipment_status(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        equipment_uuid: Optional[str] = None,
        status: Optional[str] = None,
        is_online: Optional[bool] = None,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
    ) -> tuple[List[EquipmentStatusMonitor], int]:
        """
        获取设备状态监控列表

        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            equipment_uuid: 设备UUID（可选）
            status: 设备状态（可选）
            is_online: 是否在线（可选）
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）

        Returns:
            tuple[List[EquipmentStatusMonitor], int]: 监控记录列表和总数量
        """
        query = EquipmentStatusMonitor.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if equipment_uuid:
            query = query.filter(equipment_uuid=equipment_uuid)
        if status:
            query = query.filter(status=status)
        if is_online is not None:
            query = query.filter(is_online=is_online)
        if date_start:
            query = query.filter(monitored_at__gte=date_start)
        if date_end:
            query = query.filter(monitored_at__lte=date_end)

        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by("-monitored_at")

        return items, total

    async def get_realtime_status_list(
        self,
        tenant_id: int,
        equipment_ids: Optional[List[int]] = None,
    ) -> List[Dict[str, Any]]:
        """
        获取设备实时状态列表

        返回每个设备的最新状态。

        Args:
            tenant_id: 租户ID
            equipment_ids: 设备ID列表（可选，如果指定则只返回这些设备的状态）

        Returns:
            List[Dict[str, Any]]: 设备实时状态列表
        """
        # 获取设备列表
        if equipment_ids:
            equipment_list = await Equipment.filter(
                tenant_id=tenant_id,
                id__in=equipment_ids,
                deleted_at__isnull=True
            ).all()
        else:
            equipment_list = await Equipment.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                is_active=True
            ).all()

        # 获取每个设备的最新状态
        status_list = []
        for equipment in equipment_list:
            latest_status = await self.get_latest_status(tenant_id, equipment.uuid)
            
            status_data = {
                "equipment": {
                    "id": equipment.id,
                    "uuid": equipment.uuid,
                    "code": equipment.code,
                    "name": equipment.name,
                    "type": equipment.type,
                    "category": equipment.category,
                },
                "status": equipment.status,  # 从设备表获取当前状态
                "is_online": latest_status.is_online if latest_status else False,
                "monitored_at": latest_status.monitored_at.isoformat() if latest_status else None,
                "runtime_hours": float(latest_status.runtime_hours) if latest_status and latest_status.runtime_hours else None,
                "temperature": float(latest_status.temperature) if latest_status and latest_status.temperature else None,
                "pressure": float(latest_status.pressure) if latest_status and latest_status.pressure else None,
                "vibration": float(latest_status.vibration) if latest_status and latest_status.vibration else None,
                "other_parameters": latest_status.other_parameters if latest_status else None,
                "last_maintenance_date": latest_status.last_maintenance_date.isoformat() if latest_status and latest_status.last_maintenance_date else None,
                "next_maintenance_date": latest_status.next_maintenance_date.isoformat() if latest_status and latest_status.next_maintenance_date else None,
            }
            status_list.append(status_data)

        return status_list

    async def update_equipment_status(
        self,
        tenant_id: int,
        data: EquipmentStatusUpdateRequest,
        updated_by: Optional[int] = None
    ) -> EquipmentStatusMonitor:
        """
        更新设备状态

        Args:
            tenant_id: 租户ID
            data: 状态更新请求数据
            updated_by: 更新人ID（可选）

        Returns:
            EquipmentStatusMonitor: 更新的监控记录对象

        Raises:
            NotFoundError: 当设备不存在时抛出
        """
        # 验证设备是否存在
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, data.equipment_uuid)

        # 获取当前状态
        from_status = equipment.status

        # 如果状态发生变化，记录状态历史
        if from_status != data.status:
            # 获取用户信息
            user_name = None
            if updated_by:
                try:
                    user_info = await self.work_order_service.get_user_info(updated_by)
                    user_name = user_info.get("name") if user_info else None
                except:
                    pass

            await self._create_status_history(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                equipment_uuid=equipment.uuid,
                from_status=from_status,
                to_status=data.status,
                changed_by=updated_by,
                changed_by_name=user_name,
                reason=data.reason,
                remark=data.remark,
            )

            # 更新设备状态
            equipment.status = data.status
            await equipment.save()

        # 创建新的监控记录
        monitor_data = EquipmentStatusMonitorCreate(
            equipment_uuid=data.equipment_uuid,
            status=data.status,
            is_online=data.is_online if data.is_online is not None else equipment.status == "运行中",
            monitored_at=datetime.now(),
            data_source="manual",
        )

        return await self.create_status_monitor(
            tenant_id=tenant_id,
            data=monitor_data,
            created_by=updated_by
        )

    async def get_status_history(
        self,
        tenant_id: int,
        equipment_uuid: str,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[List[EquipmentStatusHistory], int]:
        """
        获取设备状态历史

        Args:
            tenant_id: 租户ID
            equipment_uuid: 设备UUID
            skip: 跳过数量
            limit: 限制数量

        Returns:
            tuple[List[EquipmentStatusHistory], int]: 状态历史记录列表和总数量
        """
        query = EquipmentStatusHistory.filter(
            tenant_id=tenant_id,
            equipment_uuid=equipment_uuid,
            deleted_at__isnull=True
        )

        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by("-status_changed_at")

        return items, total

    async def _create_status_history(
        self,
        tenant_id: int,
        equipment_id: int,
        equipment_uuid: str,
        from_status: Optional[str],
        to_status: str,
        changed_by: Optional[int] = None,
        changed_by_name: Optional[str] = None,
        reason: Optional[str] = None,
        remark: Optional[str] = None,
    ) -> EquipmentStatusHistory:
        """
        创建状态历史记录（内部方法）

        Args:
            tenant_id: 租户ID
            equipment_id: 设备ID
            equipment_uuid: 设备UUID
            from_status: 原状态
            to_status: 新状态
            changed_by: 变更人ID
            changed_by_name: 变更人姓名
            reason: 变更原因
            remark: 备注

        Returns:
            EquipmentStatusHistory: 创建的历史记录对象
        """
        history = EquipmentStatusHistory(
            tenant_id=tenant_id,
            equipment_id=equipment_id,
            equipment_uuid=equipment_uuid,
            from_status=from_status,
            to_status=to_status,
            status_changed_at=datetime.now(),
            changed_by=changed_by,
            changed_by_name=changed_by_name,
            reason=reason,
            remark=remark,
        )
        await history.save()
        return history
