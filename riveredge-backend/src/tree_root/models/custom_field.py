"""
自定义字段模型模块

定义自定义字段数据模型，用于自定义字段管理。
"""

from typing import Dict, Any
from tortoise import fields
from .base import BaseModel


class CustomField(BaseModel):
    """
    自定义字段模型
    
    用于定义动态字段，支持为不同表添加自定义字段。
    支持多组织隔离，每个组织可以定义自己的自定义字段。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 字段ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 字段名称
        code: 字段代码（唯一，用于程序识别）
        table_name: 关联表名
        field_type: 字段类型（text、number、date、select、textarea等）
        config: 字段配置（JSON，存储默认值、验证规则、选项等）
        label: 字段标签（显示名称）
        placeholder: 占位符
        is_required: 是否必填
        is_searchable: 是否可搜索
        is_sortable: 是否可排序
        sort_order: 排序顺序
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="字段ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    name = fields.CharField(max_length=100, description="字段名称")
    code = fields.CharField(max_length=50, description="字段代码（唯一，用于程序识别）")
    table_name = fields.CharField(max_length=50, description="关联表名")
    field_type = fields.CharField(max_length=20, description="字段类型：text、number、date、select、textarea等")
    
    # 使用 JSONField 存储配置（Tortoise ORM 支持）
    config = fields.JSONField(null=True, description="字段配置（JSON，存储默认值、验证规则、选项等）")
    
    label = fields.CharField(max_length=100, null=True, description="字段标签（显示名称）")
    placeholder = fields.CharField(max_length=200, null=True, description="占位符")
    is_required = fields.BooleanField(default=False, description="是否必填")
    is_searchable = fields.BooleanField(default=True, description="是否可搜索")
    is_sortable = fields.BooleanField(default=True, description="是否可排序")
    
    sort_order = fields.IntField(default=0, description="排序顺序")
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "sys_custom_fields"
        unique_together = [("tenant_id", "table_name", "code")]
        indexes = [
            ("tenant_id",),
            ("table_name",),
            ("created_at",),
        ]
    
    def get_config(self) -> Dict[str, Any]:
        """
        获取字段配置
        
        Returns:
            Dict[str, Any]: 字段配置字典
        """
        return self.config or {}
    
    def set_config(self, config: Dict[str, Any]) -> None:
        """
        设置字段配置
        
        Args:
            config: 字段配置字典
        """
        self.config = config
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code})"

