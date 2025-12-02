"""
字典项模型模块

定义字典项数据模型，用于数据字典项管理。
"""

from tortoise import fields
from .base import BaseModel


class DictionaryItem(BaseModel):
    """
    字典项模型
    
    用于定义数据字典的具体项，每个字典项属于一个字典。
    支持多组织隔离，每个组织可以定义自己的字典项。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 字典项ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        dictionary_id: 关联字典ID（内部使用自增ID）
        label: 字典项标签（显示名称）
        value: 字典项值（用于程序识别）
        description: 字典项描述
        color: 标签颜色（可选，用于前端显示）
        icon: 图标（可选）
        sort_order: 排序顺序
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="字典项ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    # 关联字典（外键）
    dictionary = fields.ForeignKeyField(
        "models.DataDictionary",
        related_name="items",
        description="关联字典（内部使用自增ID）"
    )
    
    label = fields.CharField(max_length=100, description="字典项标签（显示名称）")
    value = fields.CharField(max_length=100, description="字典项值（用于程序识别）")
    description = fields.TextField(null=True, description="字典项描述")
    color = fields.CharField(max_length=20, null=True, description="标签颜色（可选）")
    icon = fields.CharField(max_length=50, null=True, description="图标（可选）")
    
    sort_order = fields.IntField(default=0, description="排序顺序")
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "sys_dictionary_items"
        unique_together = [("tenant_id", "dictionary_id", "value")]
        indexes = [
            ("tenant_id",),
            ("dictionary_id",),
            ("sort_order",),
            ("created_at",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.label} ({self.value})"

