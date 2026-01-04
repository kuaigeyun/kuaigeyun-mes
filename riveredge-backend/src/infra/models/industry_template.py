"""
行业模板模型模块

定义行业模板数据模型，用于存储行业模板配置。

Author: Luigi Lu
Date: 2025-01-15
"""

from tortoise import fields
from infra.models.base import BaseModel


class IndustryTemplate(BaseModel):
    """
    行业模板模型
    
    用于定义和管理行业模板，提供快速配置功能。
    模板包含：编码规则、系统参数、默认角色、默认菜单配置等。
    
    注意：行业模板是平台级的，不归属于特定租户（tenant_id 为 None）。
    但继承 BaseModel 以保持一致性（tenant_id 为 None）。
    """
    id = fields.IntField(pk=True, description="模板ID（主键，自增ID）")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供（行业模板为平台级，tenant_id 为 None）
    
    # 模板基本信息
    name = fields.CharField(max_length=100, description="模板名称")
    code = fields.CharField(max_length=50, unique=True, description="模板代码（唯一）")
    industry = fields.CharField(max_length=50, description="行业类型（manufacturing、retail、service等）")
    description = fields.TextField(null=True, description="模板描述")
    
    # 模板配置（JSON格式）
    # 包含：编码规则、系统参数、默认角色、默认菜单配置等
    config = fields.JSONField(description="模板配置（JSON格式）")
    
    # 模板状态
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_default = fields.BooleanField(default=False, description="是否默认模板")
    
    # 使用统计
    usage_count = fields.IntField(default=0, description="使用次数")
    last_used_at = fields.DatetimeField(null=True, description="最后使用时间")
    
    # 排序
    sort_order = fields.IntField(default=0, description="排序顺序")
    
    class Meta:
        """
        模型元数据
        """
        table = "infra_industry_templates"
        indexes = [
            ("code",),
            ("industry",),
            ("is_active",),
            ("sort_order",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.industry})"
