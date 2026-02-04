"""
工艺路线变更记录模型模块

定义工艺路线变更记录数据模型，用于记录工艺路线的变更历史。

Author: Luigi Lu
Date: 2026-01-27
"""

from datetime import datetime
from tortoise import fields
from core.models.base import BaseModel


class ProcessRouteChange(BaseModel):
    """
    工艺路线变更记录模型
    
    用于记录工艺路线的变更历史，支持变更申请、审批、执行等流程。
    
    Attributes:
        id: 变更记录ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        process_route_id: 工艺路线ID（外键，关联工艺路线）
        change_type: 变更类型（operation_change:工序变更, time_change:标准工时变更, sop_change:SOP变更, other:其他）
        change_content: 变更内容（JSON格式，详细记录变更内容）
        change_reason: 变更原因
        change_impact: 变更影响分析（JSON格式，记录影响的工单、影响程度等）
        status: 变更状态（pending:待审批, approved:已审批, rejected:已拒绝, executed:已执行, cancelled:已取消）
        applicant_id: 申请人ID
        approver_id: 审批人ID（可选）
        approval_comment: 审批意见（可选）
        applied_at: 应用时间（变更执行时间）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_master_data_process_route_changes"
        table_description = "基础数据管理 - 工艺路线变更"
        indexes = [
            ("tenant_id",),
            ("process_route_id",),
            ("status",),
            ("change_type",),
            ("applicant_id",),
            ("created_at",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="变更记录ID（主键，自增ID，内部使用）")
    
    # 关联工艺路线（ForeignKeyField 会自动创建 process_route_id 字段）
    process_route = fields.ForeignKeyField(
        "models.ProcessRoute",
        related_name="changes",
        description="关联工艺路线（内部使用自增ID）"
    )
    
    # 变更信息
    change_type = fields.CharField(
        max_length=50,
        description="变更类型（operation_change:工序变更, time_change:标准工时变更, sop_change:SOP变更, other:其他）"
    )
    change_content = fields.JSONField(
        null=True,
        description="变更内容（JSON格式，详细记录变更内容）"
    )
    change_reason = fields.TextField(null=True, description="变更原因")
    change_impact = fields.JSONField(
        null=True,
        description="变更影响分析（JSON格式，记录影响的工单、影响程度等）"
    )
    
    # 变更状态
    STATUS_CHOICES = [
        ("pending", "待审批"),
        ("approved", "已审批"),
        ("rejected", "已拒绝"),
        ("executed", "已执行"),
        ("cancelled", "已取消"),
    ]
    status = fields.CharField(
        max_length=20,
        default="pending",
        description="变更状态（pending:待审批, approved:已审批, rejected:已拒绝, executed:已执行, cancelled:已取消）"
    )
    
    # 申请人和审批人
    applicant_id = fields.IntField(description="申请人ID")
    approver_id = fields.IntField(null=True, description="审批人ID（可选）")
    approval_comment = fields.TextField(null=True, description="审批意见（可选）")
    applied_at = fields.DatetimeField(null=True, description="应用时间（变更执行时间）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.process_route.code if self.process_route else 'N/A'} - {self.change_type} ({self.status})"
