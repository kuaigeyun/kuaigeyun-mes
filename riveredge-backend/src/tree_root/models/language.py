"""
语言模型模块

定义语言数据模型，用于语言管理。
"""

from tortoise import fields
from .base import BaseModel


class Language(BaseModel):
    """
    语言模型
    
    用于定义系统支持的语言，每个组织可以配置自己的语言列表。
    支持多组织隔离，每个组织可以定义自己的语言。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 语言ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        code: 语言代码（ISO 639-1，如：zh、en、ja）
        name: 语言名称（如：中文、English、日本語）
        native_name: 本地名称（如：中文、English、日本語）
        translations: 翻译内容（JSON，存储所有翻译键值对）
        is_default: 是否默认语言
        is_active: 是否启用
        sort_order: 排序顺序
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="语言ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    code = fields.CharField(max_length=10, description="语言代码（ISO 639-1，如：zh、en、ja）")
    name = fields.CharField(max_length=50, description="语言名称（如：中文、English、日本語）")
    native_name = fields.CharField(max_length=50, null=True, description="本地名称（如：中文、English、日本語）")
    
    # 使用 JSONField 存储翻译内容（Tortoise ORM 支持）
    translations = fields.JSONField(default=dict, description="翻译内容（JSON，存储所有翻译键值对）")
    
    is_default = fields.BooleanField(default=False, description="是否默认语言")
    is_active = fields.BooleanField(default=True, description="是否启用")
    sort_order = fields.IntField(default=0, description="排序顺序")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "sys_languages"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id",),
            ("code",),
            ("created_at",),
        ]
    
    def get_translation(self, key: str, default: str = None) -> str:
        """
        获取翻译值
        
        Args:
            key: 翻译键
            default: 默认值
            
        Returns:
            str: 翻译值
        """
        if not self.translations:
            return default or key
        return self.translations.get(key, default or key)
    
    def set_translation(self, key: str, value: str) -> None:
        """
        设置翻译值
        
        Args:
            key: 翻译键
            value: 翻译值
        """
        if not self.translations:
            self.translations = {}
        self.translations[key] = value
    
    def update_translations(self, translations: dict) -> None:
        """
        批量更新翻译内容
        
        Args:
            translations: 翻译字典
        """
        if not self.translations:
            self.translations = {}
        self.translations.update(translations)
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code})"

