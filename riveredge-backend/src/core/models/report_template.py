"""
报表模板数据模型模块

定义报表模板数据模型，用于存储自定义报表模板配置。

Author: Luigi Lu
Date: 2025-01-15
"""

from tortoise import fields
from core.models.base import BaseModel


class ReportTemplate(BaseModel):
    """
    报表模板模型

    用于存储报表模板配置，支持JSON格式的报表设计配置。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        name: 模板名称
        code: 模板编码
        type: 报表类型（inventory/production/quality/custom）
        category: 分类（system/department/personal）
        config: 报表配置（JSON格式，存储报表设计配置）
        status: 状态（draft/published/archived）
        is_default: 是否默认模板
        description: 描述
        created_by: 创建人ID
        created_by_name: 创建人姓名
        updated_by: 更新人ID
        updated_by_name: 更新人姓名
        created_at: 创建时间
        updated_at: 更新时间
    """

    class Meta:
        """
        模型元数据
        """
        table = "core_report_templates"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("type",),
            ("category",),
            ("status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 基本信息
    name = fields.CharField(max_length=200, description="模板名称")
    code = fields.CharField(max_length=100, description="模板编码")
    type = fields.CharField(max_length=50, description="报表类型")
    category = fields.CharField(max_length=50, default="personal", description="分类")
    
    # 配置信息
    config = fields.JSONField(description="报表配置（JSON格式）")
    status = fields.CharField(max_length=20, default="draft", description="状态")
    is_default = fields.BooleanField(default=False, description="是否默认模板")
    
    # 描述信息
    description = fields.TextField(null=True, description="描述")
    
    # 创建和更新信息
    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code})"

