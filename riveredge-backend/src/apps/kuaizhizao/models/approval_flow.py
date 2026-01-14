"""
审核流程模型

提供审核流程数据模型定义，支持多级审核、会签、或签等审核模式。

Author: Luigi Lu
Date: 2025-01-14
"""

from tortoise import fields
from core.models.base import BaseModel


class ApprovalFlow(BaseModel):
    """
    审核流程模型
    
    用于定义审核流程规则，支持多级审核、会签、或签等模式。
    
    审核模式：
    - sequential: 顺序审核（必须按顺序审核）
    - parallel_all: 会签（所有审核人都必须通过）
    - parallel_any: 或签（任意一个审核人通过即可）
    """
    flow_code = fields.CharField(max_length=50, description="流程编码")
    flow_name = fields.CharField(max_length=200, description="流程名称")
    
    # 适用范围
    entity_type = fields.CharField(max_length=50, description="实体类型（如：demand）")
    business_mode = fields.CharField(max_length=20, null=True, description="业务模式（MTS/MTO，可选）")
    demand_type = fields.CharField(max_length=20, null=True, description="需求类型（sales_forecast/sales_order，可选）")
    
    # 流程配置
    is_active = fields.BooleanField(default=True, description="是否启用")
    description = fields.TextField(null=True, description="流程描述")
    
    # 创建信息
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    
    class Meta:
        table = "apps_kuaizhizao_approval_flows"
        table_description = "快格轻制造 - 审核流程"
        indexes = [
            ("tenant_id", "entity_type"),
            ("tenant_id", "is_active"),
            ("flow_code",),
        ]


class ApprovalFlowStep(BaseModel):
    """
    审核流程步骤模型
    
    定义审核流程的每个步骤，支持多级审核。
    """
    flow_id = fields.IntField(description="流程ID")
    step_order = fields.IntField(description="步骤顺序（从1开始）")
    step_name = fields.CharField(max_length=200, description="步骤名称")
    
    # 审核模式
    approval_mode = fields.CharField(
        max_length=20, 
        default="sequential",
        description="审核模式：sequential(顺序), parallel_all(会签), parallel_any(或签)"
    )
    
    # 审核人配置（JSON格式，存储审核人ID列表或角色配置）
    approver_config = fields.JSONField(description="审核人配置（JSON格式）")
    
    # 审核条件（可选，JSON格式，存储审核条件规则）
    approval_conditions = fields.JSONField(null=True, description="审核条件（JSON格式）")
    
    # 是否必填
    is_required = fields.BooleanField(default=True, description="是否必填")
    
    # 描述
    description = fields.TextField(null=True, description="步骤描述")
    
    class Meta:
        table = "apps_kuaizhizao_approval_flow_steps"
        table_description = "快格轻制造 - 审核流程步骤"
        indexes = [
            ("flow_id", "step_order"),
            ("tenant_id", "flow_id"),
        ]


class ApprovalRecord(BaseModel):
    """
    审核记录模型
    
    记录每次审核的详细信息，支持多级审核历史追溯。
    """
    entity_type = fields.CharField(max_length=50, description="实体类型（如：demand）")
    entity_id = fields.IntField(description="实体ID")
    
    # 流程信息
    flow_id = fields.IntField(null=True, description="流程ID")
    flow_code = fields.CharField(max_length=50, null=True, description="流程编码")
    step_order = fields.IntField(null=True, description="步骤顺序")
    step_name = fields.CharField(max_length=200, null=True, description="步骤名称")
    
    # 审核信息
    approver_id = fields.IntField(description="审核人ID")
    approver_name = fields.CharField(max_length=100, description="审核人姓名")
    approval_result = fields.CharField(max_length=20, description="审核结果：通过/驳回")
    approval_comment = fields.TextField(null=True, description="审核意见")
    approval_time = fields.DatetimeField(description="审核时间")
    
    # 流程状态
    flow_status = fields.CharField(max_length=20, description="流程状态：进行中/已完成/已驳回")
    
    class Meta:
        table = "apps_kuaizhizao_approval_records"
        table_description = "快格轻制造 - 审核记录"
        indexes = [
            ("tenant_id", "entity_type", "entity_id"),
            ("tenant_id", "flow_id"),
            ("approver_id",),
            ("approval_time",),
        ]
