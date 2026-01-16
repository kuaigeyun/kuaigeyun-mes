"""
设备维护提醒服务模块

提供设备维护提醒相关的业务逻辑，包括检查维护计划到期、创建提醒等。

Author: Luigi Lu
Date: 2026-01-16
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from loguru import logger

from apps.kuaizhizao.models.maintenance_plan import MaintenancePlan
from apps.kuaizhizao.models.maintenance_reminder import MaintenanceReminder
from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.equipment_service import EquipmentService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MaintenanceReminderService:
    """
    设备维护提醒服务类

    提供设备维护提醒相关的业务逻辑。
    """

    def __init__(self):
        self.work_order_service = WorkOrderService()

    async def check_maintenance_plans(
        self,
        tenant_id: int,
        advance_days: int = 7,  # 提前提醒天数，默认7天
    ) -> Dict[str, Any]:
        """
        检查维护计划，创建到期提醒

        Args:
            tenant_id: 租户ID
            advance_days: 提前提醒天数（默认7天）

        Returns:
            Dict[str, Any]: 检查结果，包含创建的提醒数量
        """
        now = datetime.now()
        reminder_count = 0

        # 获取所有已发布且未完成的维护计划
        maintenance_plans = await MaintenancePlan.filter(
            tenant_id=tenant_id,
            status__in=["已发布", "执行中"],
            deleted_at__isnull=True
        ).all()

        for plan in maintenance_plans:
            try:
                # 检查计划开始日期
                if not plan.planned_start_date:
                    continue

                # 计算距离到期天数
                days_until_due = (plan.planned_start_date - now).days

                # 判断是否需要提醒
                reminder_type = None
                if days_until_due < 0:
                    # 已过期
                    reminder_type = "overdue"
                elif 0 <= days_until_due <= advance_days:
                    # 即将到期
                    reminder_type = "due_soon"
                else:
                    # 未到提醒时间
                    continue

                # 检查是否已存在未处理的提醒
                existing_reminder = await MaintenanceReminder.filter(
                    tenant_id=tenant_id,
                    maintenance_plan_id=plan.id,
                    is_handled=False,
                    deleted_at__isnull=True
                ).order_by("-reminder_date").first()

                # 如果已存在相同类型的未处理提醒，跳过
                if existing_reminder and existing_reminder.reminder_type == reminder_type:
                    continue

                # 获取设备信息（获取设备编码）
                equipment_code = plan.equipment_name  # 默认使用设备名称
                equipment = await Equipment.filter(
                    tenant_id=tenant_id,
                    id=plan.equipment_id,
                    deleted_at__isnull=True
                ).first()
                if equipment:
                    equipment_code = equipment.code

                # 创建提醒
                reminder_message = self._generate_reminder_message(plan, days_until_due, reminder_type)

                reminder = MaintenanceReminder(
                    tenant_id=tenant_id,
                    maintenance_plan_id=plan.id,
                    maintenance_plan_uuid=plan.uuid,
                    equipment_id=plan.equipment_id,
                    equipment_uuid=plan.equipment_uuid,
                    equipment_code=equipment_code,
                    equipment_name=plan.equipment_name,
                    reminder_type=reminder_type,
                    reminder_date=now,
                    planned_maintenance_date=plan.planned_start_date,
                    days_until_due=days_until_due,
                    reminder_message=reminder_message,
                )
                await reminder.save()
                reminder_count += 1

                logger.info(f"创建维护提醒: {plan.plan_no} - {reminder_type}, 距离到期: {days_until_due}天")

            except Exception as e:
                logger.error(f"检查维护计划失败: {plan.uuid}, 错误: {e}")
                continue

        return {
            "success": True,
            "checked_count": len(maintenance_plans),
            "reminder_count": reminder_count,
            "timestamp": now.isoformat(),
        }

    def _generate_reminder_message(
        self,
        plan: MaintenancePlan,
        days_until_due: int,
        reminder_type: str
    ) -> str:
        """
        生成提醒消息（内部方法）

        Args:
            plan: 维护计划
            days_until_due: 距离到期天数
            reminder_type: 提醒类型

        Returns:
            str: 提醒消息
        """
        if reminder_type == "overdue":
            return f"设备 {plan.equipment_name} 的维护计划 {plan.plan_name} 已过期 {abs(days_until_due)} 天，请尽快处理。"
        else:
            return f"设备 {plan.equipment_name} 的维护计划 {plan.plan_name} 将在 {days_until_due} 天后到期，请提前准备。"

    async def list_reminders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        reminder_type: Optional[str] = None,
        is_read: Optional[bool] = None,
        is_handled: Optional[bool] = None,
        equipment_uuid: Optional[str] = None,
    ) -> tuple[List[MaintenanceReminder], int]:
        """
        获取维护提醒列表

        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            reminder_type: 提醒类型（可选）
            is_read: 是否已读（可选）
            is_handled: 是否已处理（可选）
            equipment_uuid: 设备UUID（可选）

        Returns:
            tuple[List[MaintenanceReminder], int]: 提醒记录列表和总数量
        """
        query = MaintenanceReminder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if reminder_type:
            query = query.filter(reminder_type=reminder_type)
        if is_read is not None:
            query = query.filter(is_read=is_read)
        if is_handled is not None:
            query = query.filter(is_handled=is_handled)
        if equipment_uuid:
            query = query.filter(equipment_uuid=equipment_uuid)

        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by("-reminder_date", "-created_at")

        return items, total

    async def get_unread_count(
        self,
        tenant_id: int,
    ) -> int:
        """
        获取未读提醒数量

        Args:
            tenant_id: 租户ID

        Returns:
            int: 未读提醒数量
        """
        return await MaintenanceReminder.filter(
            tenant_id=tenant_id,
            is_read=False,
            deleted_at__isnull=True
        ).count()

    async def mark_as_read(
        self,
        tenant_id: int,
        reminder_uuids: List[str],
        read_by: Optional[int] = None,
    ) -> int:
        """
        标记提醒为已读

        Args:
            tenant_id: 租户ID
            reminder_uuids: 提醒UUID列表
            read_by: 已读人ID（可选）

        Returns:
            int: 标记为已读的数量
        """
        now = datetime.now()
        count = 0

        for reminder_uuid in reminder_uuids:
            reminder = await MaintenanceReminder.filter(
                tenant_id=tenant_id,
                uuid=reminder_uuid,
                deleted_at__isnull=True
            ).first()

            if reminder and not reminder.is_read:
                reminder.is_read = True
                reminder.read_at = now
                reminder.read_by = read_by
                await reminder.save()
                count += 1

        return count

    async def mark_as_handled(
        self,
        tenant_id: int,
        reminder_uuid: str,
        handled_by: Optional[int] = None,
        remark: Optional[str] = None,
    ) -> MaintenanceReminder:
        """
        标记提醒为已处理

        Args:
            tenant_id: 租户ID
            reminder_uuid: 提醒UUID
            handled_by: 处理人ID（可选）
            remark: 处理备注（可选）

        Returns:
            MaintenanceReminder: 更新后的提醒记录

        Raises:
            NotFoundError: 当提醒不存在时抛出
        """
        reminder = await MaintenanceReminder.filter(
            tenant_id=tenant_id,
            uuid=reminder_uuid,
            deleted_at__isnull=True
        ).first()

        if not reminder:
            raise NotFoundError(f"维护提醒不存在: {reminder_uuid}")

        # 获取用户信息
        user_name = None
        if handled_by:
            try:
                user_info = await self.work_order_service.get_user_info(handled_by)
                user_name = user_info.get("name") if user_info else None
            except:
                pass

        reminder.is_handled = True
        reminder.handled_at = datetime.now()
        reminder.handled_by = handled_by
        reminder.handled_by_name = user_name
        await reminder.save()

        return reminder
