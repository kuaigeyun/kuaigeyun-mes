"""
站点设置模型模块

定义站点设置数据模型，用于站点配置管理。
"""

from typing import Dict, Any
from tortoise import fields
from .base import BaseModel


class SiteSetting(BaseModel):
    """
    站点设置模型
    
    用于存储组织的站点配置信息，每个组织只有一个设置记录。
    支持多组织隔离，每个组织可以配置自己的站点设置。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    但这里 tenant_id 是唯一的，每个组织只有一个设置记录。
    
    Attributes:
        id: 设置ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（唯一，每个组织只有一个设置记录）
        settings: 设置项（JSON，存储所有配置）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="设置ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，但需要唯一约束
    
    # 使用 JSONField 存储设置（Tortoise ORM 支持）
    settings = fields.JSONField(default=dict, description="设置项（JSON，存储所有配置）")

    # 软删除字段（站点设置通常不删除，但保持一致性）
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_site_settings"
        unique_together = [("tenant_id",)]
        indexes = [
            ("tenant_id",),
            ("created_at",),
        ]
    
    def get_setting(self, key: str, default: Any = None) -> Any:
        """
        获取设置项
        
        Args:
            key: 设置键
            default: 默认值
            
        Returns:
            设置值
        """
        return self.settings.get(key, default) if self.settings else default
    
    def set_setting(self, key: str, value: Any) -> None:
        """
        设置设置项
        
        Args:
            key: 设置键
            value: 设置值
        """
        if not self.settings:
            self.settings = {}
        self.settings[key] = value
    
    def update_settings(self, settings: Dict[str, Any]) -> None:
        """
        批量更新设置项
        
        Args:
            settings: 设置字典
        """
        if not self.settings:
            self.settings = {}
        self.settings.update(settings)
    
    def __str__(self):
        """字符串表示"""
        return f"SiteSetting(tenant_id={self.tenant_id})"

