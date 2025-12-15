"""
审批历史记录模型模块

定义审批历史记录数据模型，用于记录审批操作的详细历史。
"""

from tortoise import fields
from core.models.base import BaseModel


class ApprovalHistory(BaseModel):
    """
    审批历史记录模型
    
    用于记录审批实例的每次操作历史，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        action: 操作类型（approve、reject、cancel、transfer）
        action_by: 操作人ID（用户ID）
        action_at: 操作时间
        comment: 审批意见
        from_node: 来源节点
        to_node: 目标节点
        from_approver_id: 原审批人ID
        to_approver_id: 新审批人ID
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "core_approval_histories"
        indexes = [
            ("tenant_id",),
            ("approval_instance_id",),
            ("uuid",),
            ("action",),
            ("action_by",),
            ("action_at",),
        ]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 关联审批实例
    approval_instance_id = fields.IntField(description="审批实例ID（关联ApprovalInstance）")
    
    # 操作信息
    action = fields.CharField(max_length=20, description="操作类型（approve、reject、cancel、transfer）")
    action_by = fields.IntField(description="操作人ID（用户ID）")
    action_at = fields.DatetimeField(description="操作时间")
    comment = fields.TextField(null=True, description="审批意见")
    
    # 节点流转信息
    from_node = fields.CharField(max_length=100, null=True, description="来源节点")
    to_node = fields.CharField(max_length=100, null=True, description="目标节点")
    from_approver_id = fields.IntField(null=True, description="原审批人ID")
    to_approver_id = fields.IntField(null=True, description="新审批人ID")
    
    def __str__(self):
        """字符串表示"""
        return f"ApprovalHistory {self.id} - {self.action}"
