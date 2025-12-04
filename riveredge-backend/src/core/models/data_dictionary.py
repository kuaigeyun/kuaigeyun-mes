"""
数据字典模型模块

定义数据字典数据模型，用于数据字典管理。
"""

from tortoise import fields
from .base import BaseModel


class DataDictionary(BaseModel):
    """
    数据字典模型
    
    用于定义系统中的数据字典类型，每个字典可以包含多个字典项。
    支持多组织隔离，每个组织可以定义自己的字典。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 字典ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 字典名称
        code: 字典代码（唯一，用于程序识别）
        description: 字典描述
        is_system: 是否系统字典（系统字典不可删除）
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="字典ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    name = fields.CharField(max_length=100, description="字典名称")
    code = fields.CharField(max_length=50, description="字典代码（唯一，用于程序识别）")
    description = fields.TextField(null=True, description="字典描述")
    is_system = fields.BooleanField(default=False, description="是否系统字典（系统字典不可删除）")
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_data_dictionaries"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id",),
            ("code",),
            ("created_at",),
            # 复合索引：优化常用组合查询
            ("tenant_id", "code"),  # 按组织+代码查询（已包含在 unique_together 中，但显式声明有助于查询优化）
            ("tenant_id", "is_active"),  # 按组织+启用状态查询
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code})"

