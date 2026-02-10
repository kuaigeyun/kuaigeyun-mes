"""
审批任务模型模块

定义审批任务数据模型，用于记录单个用户的审批任务。
"""

from tortoise import fields
from core.models.base import BaseModel


class ApprovalTask(BaseModel):
    """
    审批任务模型
    
    用于记录审批实例中的具体任务，支持多用户审批（会签/或签）。
    每个任务对应一个具体的审批人。
    
    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        approval_instance: 关联的审批实例
        node_id: 节点ID（对应流程定义中的节点ID）
        approver_id: 审批人ID（用户ID）
        status: 任务状态（pending、approved、rejected、cancelled、transferred）
        action_at: 操作时间
        comment: 审批意见
        read_at: 阅读时间
    """
    
    class Meta:
        table = "core_approval_tasks"
        indexes = [
            ("tenant_id", "approver_id", "status"),  # 用户查询待办任务
            ("tenant_id", "approval_instance_id"),   # 实例查询任务
            ("uuid",),
        ]
        
    id = fields.IntField(pk=True, description="主键ID")
    
    approval_instance = fields.ForeignKeyField(
        "models.ApprovalInstance",
        related_name="tasks",
        description="关联审批实例"
    )
    
    node_id = fields.CharField(max_length=100, description="节点ID")
    approver_id = fields.IntField(description="审批人ID")
    
    status = fields.CharField(max_length=20, default="pending", description="任务状态")
    action_at = fields.DatetimeField(null=True, description="操作时间")
    comment = fields.TextField(null=True, description="审批意见")
    read_at = fields.DatetimeField(null=True, description="阅读时间")
    
    def __str__(self):
        return f"Task {self.id} - {self.status}"
