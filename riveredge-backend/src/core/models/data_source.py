"""
数据源模型模块

定义数据源数据模型，用于数据源管理。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel


class DataSource(BaseModel):
    """
    数据源模型
    
    用于定义和管理组织内的数据源，支持多种数据库类型和API数据源。
    支持多组织隔离，每个组织的数据源相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="数据源ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    name = fields.CharField(max_length=100, description="数据源名称")
    code = fields.CharField(max_length=50, description="数据源代码（唯一，用于程序识别）")
    description = fields.TextField(null=True, description="数据源描述")
    type = fields.CharField(max_length=20, description="数据源类型（postgresql、mysql、mongodb、api等）")
    
    config = fields.JSONField(description="连接配置（JSON格式）")
    
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_connected = fields.BooleanField(default=False, description="是否已连接")
    last_connected_at = fields.DatetimeField(null=True, description="最后连接时间")
    last_error = fields.TextField(null=True, description="最后连接错误信息")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_data_sources"
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

