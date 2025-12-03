"""
用户偏好模型模块

定义用户偏好数据模型，用于用户偏好设置管理。
"""

from tortoise import fields
from typing import Dict, Any
from .base import BaseModel


class UserPreference(BaseModel):
    """
    用户偏好模型
    
    用于存储用户的偏好设置，包括主题、语言、通知设置等。
    支持多组织隔离，每个组织的用户偏好相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="用户偏好ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    # 关联用户（一对一）
    user_id = fields.IntField(unique=True, description="关联用户ID（外键，一对一）")
    
    # 偏好设置
    preferences = fields.JSONField(default={}, description="偏好设置（JSON格式）")
    
    class Meta:
        """
        模型元数据
        """
        table = "root_user_preferences"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("user_id",),
            ("created_at",),
        ]
        unique_together = [("user_id",)]
    
    def __str__(self):
        """字符串表示"""
        return f"UserPreference(user_id={self.user_id})"

