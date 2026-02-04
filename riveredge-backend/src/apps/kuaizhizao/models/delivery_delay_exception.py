"""
交期延期异常记录数据模型模块

定义交期延期异常记录数据模型，用于记录和处理工单交期延期异常。

Author: Luigi Lu
Date: 2025-01-15
"""

from tortoise import fields
from core.models.base import BaseModel


class DeliveryDelayException(BaseModel):
    """
    交期延期异常记录模型

    用于记录工单交期延期异常信息，包括延期天数、延期原因、处理状态等。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        work_order_id: 工单ID
        work_order_code: 工单编码
        planned_end_date: 计划结束日期
        actual_end_date: 实际结束日期（可选）
        delay_days: 延期天数
        delay_reason: 延期原因
        alert_level: 预警级别（low/medium/high/critical）
        status: 处理状态（pending/processing/resolved/cancelled）
        suggested_action: 建议操作（adjust_plan/increase_resources/expedite）
        handled_by: 处理人ID
        handled_by_name: 处理人姓名
        handled_at: 处理时间
        remarks: 备注
        created_at: 创建时间
        updated_at: 更新时间
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_delivery_delay_exceptions"
        table_description = "快格轻制造 - 交期延期异常"
        indexes = [
            ("tenant_id",),
            ("work_order_id",),
            ("alert_level",),
            ("status",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 工单信息
    work_order_id = fields.IntField(description="工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")

    # 日期信息
    planned_end_date = fields.DatetimeField(description="计划结束日期")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束日期（可选）")

    # 延期信息
    delay_days = fields.IntField(description="延期天数")
    delay_reason = fields.CharField(max_length=500, null=True, description="延期原因")

    # 预警和处理信息
    alert_level = fields.CharField(max_length=20, default="medium", description="预警级别")
    status = fields.CharField(max_length=20, default="pending", description="处理状态")

    # 建议操作
    suggested_action = fields.CharField(max_length=50, null=True, description="建议操作")

    # 处理信息
    handled_by = fields.IntField(null=True, description="处理人ID")
    handled_by_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    handled_at = fields.DatetimeField(null=True, description="处理时间")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.work_order_code} - 延期{self.delay_days}天"

