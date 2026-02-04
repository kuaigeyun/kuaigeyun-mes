"""
设备维护提醒模型模块

定义设备维护提醒数据模型，用于记录维护计划到期提醒。

Author: Luigi Lu
Date: 2026-01-16
"""

from tortoise import fields
from core.models.base import BaseModel


class MaintenanceReminder(BaseModel):
    """
    设备维护提醒模型

    用于记录设备维护计划到期提醒，支持多组织隔离。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        maintenance_plan_id: 维护计划ID（关联MaintenancePlan）
        maintenance_plan_uuid: 维护计划UUID
        equipment_id: 设备ID
        equipment_uuid: 设备UUID
        equipment_code: 设备编码
        equipment_name: 设备名称
        reminder_type: 提醒类型（due_soon/overdue）
        reminder_date: 提醒日期
        planned_maintenance_date: 计划维护日期
        days_until_due: 距离到期天数（负数表示已过期）
        is_read: 是否已读
        read_at: 已读时间
        read_by: 已读人ID
        is_handled: 是否已处理
        handled_at: 处理时间
        handled_by: 处理人ID
        handled_by_name: 处理人姓名
        reminder_message: 提醒消息
        created_at: 创建时间
        updated_at: 更新时间
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_maintenance_reminders"
        table_description = "快格轻制造 - 保养提醒"
        indexes = [
            ("tenant_id",),
            ("maintenance_plan_id",),
            ("equipment_id",),
            ("reminder_type",),
            ("reminder_date",),
            ("is_read",),
            ("is_handled",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 关联维护计划
    maintenance_plan_id = fields.IntField(null=True, description="维护计划ID")
    maintenance_plan_uuid = fields.CharField(max_length=36, null=True, description="维护计划UUID")

    # 关联设备
    equipment_id = fields.IntField(description="设备ID")
    equipment_uuid = fields.CharField(max_length=36, description="设备UUID")
    equipment_code = fields.CharField(max_length=50, description="设备编码")
    equipment_name = fields.CharField(max_length=200, description="设备名称")

    # 提醒信息
    reminder_type = fields.CharField(max_length=50, description="提醒类型（due_soon/overdue）")
    reminder_date = fields.DatetimeField(description="提醒日期")
    planned_maintenance_date = fields.DatetimeField(description="计划维护日期")
    days_until_due = fields.IntField(description="距离到期天数（负数表示已过期）")
    reminder_message = fields.TextField(null=True, description="提醒消息")

    # 已读状态
    is_read = fields.BooleanField(default=False, description="是否已读")
    read_at = fields.DatetimeField(null=True, description="已读时间")
    read_by = fields.IntField(null=True, description="已读人ID")

    # 处理状态
    is_handled = fields.BooleanField(default=False, description="是否已处理")
    handled_at = fields.DatetimeField(null=True, description="处理时间")
    handled_by = fields.IntField(null=True, description="处理人ID")
    handled_by_name = fields.CharField(max_length=100, null=True, description="处理人姓名")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.equipment_code} - {self.reminder_type} ({self.reminder_date})"
