"""
排程配置模型

提供排程约束配置的持久化，支持多套排程方案（如交期优先、产能优先、简化模式）。
含 4M 人机料法可配置开关。

Author: Plan - 排程管理增强
Date: 2026-02-26
"""

from tortoise import fields
from core.models.base import BaseModel


class SchedulingConfig(BaseModel):
    """
    排程配置模型

    存储排程约束条件，含 4M 人机料法开关及权重配置。
    """
    config_code = fields.CharField(max_length=50, description="配置编码")
    config_name = fields.CharField(max_length=200, description="配置名称")

    # 约束条件（JSON格式）
    # 含：priority_weight, due_date_weight, capacity_weight, setup_time_weight,
    #     optimize_objective, consider_human, consider_equipment, consider_material, consider_mold_tool
    constraints = fields.JSONField(description="排程约束（JSON格式）")

    # 是否为默认配置
    is_default = fields.BooleanField(default=False, description="是否为默认配置")

    # 是否启用
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 描述
    description = fields.TextField(null=True, description="配置描述")

    # 创建信息
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")

    class Meta:
        table = "apps_kuaizhizao_scheduling_configs"
        table_description = "快格轻制造 - 排程配置"
        indexes = [
            ("tenant_id", "is_default"),
            ("tenant_id", "is_active"),
            ("config_code",),
        ]
        unique_together = [
            ("tenant_id", "config_code"),
        ]
