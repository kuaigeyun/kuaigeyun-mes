"""
审批实例模型模块

定义审批实例数据模型，用于审批实例管理。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel
from .approval_process import ApprovalProcess


class ApprovalInstance(BaseModel):
    """
    审批实例模型
    
    用于定义和管理组织内的审批实例，每个实例对应一个审批流程的执行。
    支持多组织隔离，每个组织的审批实例相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="审批实例ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    process = fields.ForeignKeyField(
        "models.ApprovalProcess",
        related_name="instances",
        description="关联流程（外键）"
    )
    
    # 实例基本信息
    title = fields.CharField(max_length=200, description="审批标题")
    content = fields.TextField(null=True, description="审批内容")
    data = fields.JSONField(null=True, description="审批数据（JSON格式）")
    
    # 审批状态
    status = fields.CharField(max_length=20, default="pending", description="审批状态（pending、approved、rejected、cancelled）")
    current_node = fields.CharField(max_length=100, null=True, description="当前节点")
    current_approver_id = fields.IntField(null=True, description="当前审批人ID")
    
    # Inngest 关联
    inngest_run_id = fields.CharField(max_length=100, null=True, description="Inngest 运行ID（关联 Inngest 工作流实例）")
    
    # 审批信息
    submitter_id = fields.IntField(description="提交人ID")
    submitted_at = fields.DatetimeField(description="提交时间")
    completed_at = fields.DatetimeField(null=True, description="完成时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "root_approval_instances"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("process_id",),
            ("status",),
            ("current_approver_id",),
            ("submitter_id",),
            ("inngest_run_id",),
            ("created_at",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.title} ({self.status})"

