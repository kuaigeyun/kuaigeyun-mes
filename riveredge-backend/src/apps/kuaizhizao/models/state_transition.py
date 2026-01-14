"""
状态流转模型

提供状态流转数据模型定义，支持状态机模式管理需求状态。

Author: Luigi Lu
Date: 2025-01-14
"""

from tortoise import fields
from core.models.base import BaseModel


class StateTransitionRule(BaseModel):
    """
    状态流转规则模型
    
    定义状态之间的流转规则，包括流转条件、权限控制等。
    """
    entity_type = fields.CharField(max_length=50, description="实体类型（如：demand）")
    from_state = fields.CharField(max_length=50, description="源状态")
    to_state = fields.CharField(max_length=50, description="目标状态")
    
    # 流转条件（JSON格式，存储流转条件规则）
    transition_conditions = fields.JSONField(null=True, description="流转条件（JSON格式）")
    
    # 权限控制
    required_permission = fields.CharField(max_length=100, null=True, description="所需权限")
    required_role = fields.CharField(max_length=100, null=True, description="所需角色")
    
    # 是否启用
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 描述
    description = fields.TextField(null=True, description="规则描述")
    
    class Meta:
        table = "apps_kuaizhizao_state_transition_rules"
        table_description = "快格轻制造 - 状态流转规则"
        indexes = [
            ("tenant_id", "entity_type", "from_state"),
            ("tenant_id", "entity_type", "to_state"),
            ("tenant_id", "is_active"),
        ]


class StateTransitionLog(BaseModel):
    """
    状态流转日志模型
    
    记录每次状态流转的详细信息，支持状态流转历史追溯。
    """
    entity_type = fields.CharField(max_length=50, description="实体类型（如：demand）")
    entity_id = fields.IntField(description="实体ID")
    
    # 状态信息
    from_state = fields.CharField(max_length=50, description="源状态")
    to_state = fields.CharField(max_length=50, description="目标状态")
    
    # 流转信息
    transition_reason = fields.CharField(max_length=200, null=True, description="流转原因")
    transition_comment = fields.TextField(null=True, description="流转备注")
    
    # 操作人信息
    operator_id = fields.IntField(description="操作人ID")
    operator_name = fields.CharField(max_length=100, description="操作人姓名")
    transition_time = fields.DatetimeField(description="流转时间")
    
    # 关联信息
    related_entity_type = fields.CharField(max_length=50, null=True, description="关联实体类型")
    related_entity_id = fields.IntField(null=True, description="关联实体ID")
    
    class Meta:
        table = "apps_kuaizhizao_state_transition_logs"
        table_description = "快格轻制造 - 状态流转日志"
        indexes = [
            ("tenant_id", "entity_type", "entity_id"),
            ("tenant_id", "operator_id"),
            ("transition_time",),
        ]
