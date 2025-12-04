"""
消息配置模型模块

定义消息配置数据模型，用于消息管理。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel


class MessageConfig(BaseModel):
    """
    消息配置模型
    
    用于定义和管理组织内的消息发送配置（邮件、短信、站内信、推送通知）。
    支持多组织隔离，每个组织的消息配置相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="消息配置ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    name = fields.CharField(max_length=100, description="配置名称")
    code = fields.CharField(max_length=50, description="配置代码（唯一，用于程序识别）")
    type = fields.CharField(max_length=20, description="消息类型（email、sms、internal、push）")
    description = fields.TextField(null=True, description="配置描述")
    
    config = fields.JSONField(description="配置信息（JSON格式）")
    
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_default = fields.BooleanField(default=False, description="是否默认配置")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_message_configs"
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

