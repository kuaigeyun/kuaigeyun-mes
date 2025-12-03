"""
接口模型模块

定义接口数据模型，用于接口管理。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel


class API(BaseModel):
    """
    接口模型
    
    用于定义和管理组织内的接口，支持接口定义、测试、文档生成等功能。
    支持多组织隔离，每个组织的接口相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="接口ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    name = fields.CharField(max_length=100, description="接口名称")
    code = fields.CharField(max_length=50, description="接口代码（唯一，用于程序识别）")
    description = fields.TextField(null=True, description="接口描述")
    path = fields.CharField(max_length=500, description="接口路径")
    method = fields.CharField(max_length=10, description="请求方法（GET、POST、PUT、DELETE等）")
    
    request_headers = fields.JSONField(null=True, description="请求头（JSON格式）")
    request_params = fields.JSONField(null=True, description="请求参数（JSON格式）")
    request_body = fields.JSONField(null=True, description="请求体（JSON格式）")
    
    response_format = fields.JSONField(null=True, description="响应格式（JSON格式）")
    response_example = fields.JSONField(null=True, description="响应示例（JSON格式）")
    
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_system = fields.BooleanField(default=False, description="是否系统接口（系统接口不可删除）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "root_apis"
        indexes = [
            ("tenant_id", "code"),  # 唯一索引
            ("method",),
            ("uuid",),
            ("code",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.method} {self.path})"

