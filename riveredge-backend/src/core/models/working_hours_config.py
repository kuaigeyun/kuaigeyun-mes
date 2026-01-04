"""
工作时间段配置数据模型模块

定义工作时间段配置数据模型，用于配置组织的工作时间段，支持计算排除非工作时间的耗时。

Author: Luigi Lu
Date: 2025-01-15
"""

from tortoise import fields
from core.models.base import BaseModel


class WorkingHoursConfig(BaseModel):
    """
    工作时间段配置模型

    用于配置组织的工作时间段，支持按周几、日期范围等配置不同的工作时间段。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        name: 配置名称
        scope_type: 适用范围类型（warehouse/work_center/department/all）
        scope_id: 适用范围ID（可选，如果scope_type为all则为空）
        scope_name: 适用范围名称
        day_of_week: 星期几（0=周一，6=周日，null表示所有工作日）
        start_date: 生效开始日期（可选）
        end_date: 生效结束日期（可选）
        working_hours: 工作时间段配置（JSON格式，如：[{"start": "09:00", "end": "12:00"}, {"start": "13:00", "end": "18:00"}]）
        is_enabled: 是否启用
        priority: 优先级（数字越大优先级越高）
        remarks: 备注
        created_at: 创建时间
        updated_at: 更新时间
    """

    class Meta:
        """
        模型元数据
        """
        table = "core_working_hours_configs"
        indexes = [
            ("tenant_id",),
            ("scope_type",),
            ("scope_id",),
            ("is_enabled",),
            ("priority",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 配置信息
    name = fields.CharField(max_length=200, description="配置名称")
    scope_type = fields.CharField(max_length=50, description="适用范围类型")
    scope_id = fields.IntField(null=True, description="适用范围ID（可选）")
    scope_name = fields.CharField(max_length=200, null=True, description="适用范围名称")

    # 时间配置
    day_of_week = fields.IntField(null=True, description="星期几（0=周一，6=周日，null表示所有工作日）")
    start_date = fields.DateField(null=True, description="生效开始日期（可选）")
    end_date = fields.DateField(null=True, description="生效结束日期（可选）")

    # 工作时间段配置（JSON格式）
    working_hours = fields.JSONField(description="工作时间段配置（JSON格式）")

    # 状态
    is_enabled = fields.BooleanField(default=True, description="是否启用")
    priority = fields.IntField(default=0, description="优先级（数字越大优先级越高）")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.name} - {self.scope_name or '全部'}"

