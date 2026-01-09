"""
变体属性定义模型模块

提供变体属性定义的数据模型，包括属性定义和版本历史。

Author: Luigi Lu
Date: 2026-01-08
"""

from typing import Dict, Any, Optional
from tortoise import fields
from .base import BaseModel


class MaterialVariantAttributeDefinition(BaseModel):
    """
    变体属性定义模型
    
    用于定义物料变体的属性配置，支持自定义属性类型、枚举值、验证规则等。
    支持多组织隔离，每个组织可以定义自己的变体属性配置。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 属性定义ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        attribute_name: 属性名称（唯一标识，如：颜色、尺寸）
        attribute_type: 属性类型（enum/text/number/date/boolean）
        display_name: 显示名称（如：产品颜色）
        description: 属性描述
        is_required: 是否必填
        display_order: 显示顺序
        enum_values: 枚举值列表（JSON数组，如果type=enum）
        validation_rules: 验证规则（JSON格式）
        default_value: 默认值
        dependencies: 依赖关系（JSON格式）
        is_active: 是否启用
        version: 版本号
        created_by: 创建人ID
        updated_by: 更新人ID
    """
    
    id = fields.IntField(pk=True, description="属性定义ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    attribute_name = fields.CharField(max_length=50, description="属性名称（唯一标识，如：颜色、尺寸）")
    attribute_type = fields.CharField(max_length=20, description="属性类型（enum/text/number/date/boolean）")
    display_name = fields.CharField(max_length=100, description="显示名称（如：产品颜色）")
    description = fields.TextField(null=True, description="属性描述")
    is_required = fields.BooleanField(default=False, description="是否必填")
    display_order = fields.IntField(default=0, description="显示顺序")
    
    # 使用 JSONField 存储配置
    enum_values = fields.JSONField(null=True, description="枚举值列表（JSON数组，如果type=enum）")
    validation_rules = fields.JSONField(null=True, description="验证规则（JSON格式，如：{'max_length': 50, 'min': 0, 'max': 100}）")
    default_value = fields.CharField(max_length=200, null=True, description="默认值")
    dependencies = fields.JSONField(null=True, description="依赖关系（JSON格式，如：{'depends_on': '颜色', 'rules': {...}}）")
    
    is_active = fields.BooleanField(default=True, description="是否启用")
    version = fields.IntField(default=1, description="版本号")
    
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_material_variant_attribute_definitions"
        unique_together = [("tenant_id", "attribute_name")]
        indexes = [
            ("tenant_id",),
            ("attribute_type",),
            ("is_active",),
            ("display_order",),
            ("created_at",),
        ]
    
    def get_enum_values(self) -> list:
        """
        获取枚举值列表
        
        Returns:
            list: 枚举值列表
        """
        if self.attribute_type == "enum" and self.enum_values:
            return self.enum_values if isinstance(self.enum_values, list) else []
        return []
    
    def get_validation_rules(self) -> Dict[str, Any]:
        """
        获取验证规则
        
        Returns:
            Dict[str, Any]: 验证规则字典
        """
        return self.validation_rules or {}
    
    def get_dependencies(self) -> Dict[str, Any]:
        """
        获取依赖关系
        
        Returns:
            Dict[str, Any]: 依赖关系字典
        """
        return self.dependencies or {}
    
    def __str__(self):
        """字符串表示"""
        return f"{self.display_name} ({self.attribute_name})"


class MaterialVariantAttributeHistory(BaseModel):
    """
    变体属性定义版本历史模型
    
    用于记录变体属性定义的版本变更历史，支持版本对比和回滚。
    
    Attributes:
        id: 历史记录ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        attribute_definition_id: 关联的属性定义ID
        version: 版本号
        attribute_config: 完整的属性配置（JSON格式）
        change_description: 变更说明
        changed_by: 变更人ID
        changed_at: 变更时间
    """
    
    id = fields.IntField(pk=True, description="历史记录ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    attribute_definition_id = fields.IntField(description="关联的属性定义ID")
    version = fields.IntField(description="版本号")
    attribute_config = fields.JSONField(description="完整的属性配置（JSON格式）")
    change_description = fields.TextField(null=True, description="变更说明")
    changed_by = fields.IntField(null=True, description="变更人ID")
    changed_at = fields.DatetimeField(null=True, description="变更时间")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_material_variant_attribute_history"
        unique_together = [("attribute_definition_id", "version")]
        indexes = [
            ("tenant_id",),
            ("attribute_definition_id",),
            ("version",),
            ("changed_at",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"AttributeDefinition {self.attribute_definition_id} v{self.version}"
