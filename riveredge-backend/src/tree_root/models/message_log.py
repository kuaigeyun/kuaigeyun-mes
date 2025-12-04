"""
消息发送记录模型模块

定义消息发送记录数据模型，用于消息管理。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel


class MessageLog(BaseModel):
    """
    消息发送记录模型
    
    用于记录消息发送历史，关联 Inngest 工作流实例。
    支持多组织隔离，每个组织的消息记录相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="消息记录ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    template_uuid = fields.CharField(max_length=36, null=True, description="关联模板UUID")
    config_uuid = fields.CharField(max_length=36, null=True, description="关联配置UUID")
    type = fields.CharField(max_length=20, description="消息类型")
    recipient = fields.CharField(max_length=200, description="接收者（邮箱、手机号、用户ID等）")
    
    subject = fields.CharField(max_length=200, null=True, description="主题")
    content = fields.TextField(description="消息内容")
    variables = fields.JSONField(null=True, description="模板变量值（JSON格式）")
    
    status = fields.CharField(max_length=20, description="发送状态（pending、sending、success、failed）")
    inngest_run_id = fields.CharField(max_length=100, null=True, description="Inngest 运行ID（关联 Inngest 工作流实例）")
    error_message = fields.TextField(null=True, description="错误信息")
    sent_at = fields.DatetimeField(null=True, description="发送时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "root_message_logs"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("template_uuid",),
            ("config_uuid",),
            ("type",),
            ("status",),
            ("inngest_run_id",),
            ("created_at",),
            # 复合索引：优化常用组合查询
            ("tenant_id", "status"),  # 按组织+状态查询
            ("tenant_id", "type", "status"),  # 按组织+类型+状态查询
            ("tenant_id", "recipient", "status"),  # 按组织+收件人+状态查询（用户消息查询）
            ("tenant_id", "created_at"),  # 按组织+创建时间查询（时间范围查询）
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.type} to {self.recipient} ({self.status})"

