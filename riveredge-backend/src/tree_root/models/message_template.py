"""
消息模板模型模块

定义消息模板数据模型，用于消息管理。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel


class MessageTemplate(BaseModel):
    """
    消息模板模型
    
    用于定义和管理组织内的消息模板。
    支持多组织隔离，每个组织的消息模板相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="消息模板ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    name = fields.CharField(max_length=100, description="模板名称")
    code = fields.CharField(max_length=50, description="模板代码（唯一，用于程序识别）")
    type = fields.CharField(max_length=20, description="消息类型（email、sms、internal、push）")
    description = fields.TextField(null=True, description="模板描述")
    
    subject = fields.CharField(max_length=200, null=True, description="主题（邮件、推送通知）")
    content = fields.TextField(description="模板内容（支持变量）")
    variables = fields.JSONField(null=True, description="模板变量定义（JSON格式）")
    
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "root_message_templates"
        indexes = [
            ("tenant_id", "code"),  # 唯一索引
            ("type",),
            ("uuid",),
            ("code",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.type})"

