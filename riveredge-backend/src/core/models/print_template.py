"""
打印模板模型模块

定义打印模板数据模型，用于打印模板管理。
"""

from tortoise import fields
from typing import Optional, Dict, Any
from .base import BaseModel


class PrintTemplate(BaseModel):
    """
    打印模板模型
    
    用于定义和管理组织内的打印模板，支持多种模板类型（PDF、HTML、Word等）。
    打印任务可以通过 Inngest 异步执行（可选）。
    支持多组织隔离，每个组织的打印模板相互独立。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    """
    id = fields.IntField(pk=True, description="打印模板ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供
    
    # 模板基本信息
    name = fields.CharField(max_length=200, description="模板名称")
    code = fields.CharField(max_length=50, description="模板代码（唯一，用于程序识别）")
    type = fields.CharField(max_length=50, description="模板类型（pdf、html、word等）")
    description = fields.TextField(null=True, description="模板描述")
    
    # 模板内容
    content = fields.TextField(description="模板内容（HTML、XML等格式）")
    
    # 模板配置
    config = fields.JSONField(null=True, description="模板配置（JSON格式，如页面设置、样式等）")
    
    # Inngest 关联（可选）
    inngest_function_id = fields.CharField(max_length=100, null=True, description="Inngest 函数ID（如果通过 Inngest 执行打印）")
    
    # 模板状态
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_default = fields.BooleanField(default=False, description="是否默认模板")
    
    # 使用统计
    usage_count = fields.IntField(default=0, description="使用次数")
    last_used_at = fields.DatetimeField(null=True, description="最后使用时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_print_templates"
        indexes = [
            ("tenant_id", "code"),  # 唯一索引
            ("uuid",),
            ("code",),
            ("type",),
            ("is_active",),
            ("is_default",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.type})"

