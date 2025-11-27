"""
组织配置模型模块

定义组织配置数据模型，用于存储组织的详细配置信息
"""

from typing import Optional, Dict, Any

from tortoise import fields

from models.base import BaseModel


class TenantConfig(BaseModel):
    """
    组织配置模型
    
    用于存储组织的详细配置信息。
    注意：此模型包含 tenant_id，用于关联到具体的组织。
    
    Attributes:
        id: 配置 ID（主键）
        tenant_id: 组织 ID（外键，关联到 core_tenants 表）
        config_key: 配置键（唯一标识配置项）
        config_value: 配置值（JSONB 存储，支持复杂数据结构）
        description: 配置描述（可选）
        created_at: 创建时间
        updated_at: 更新时间
    """

    id = fields.IntField(primary_key=True, description="配置 ID（主键）")
        tenant_id = fields.IntField(description="组织 ID（外键，关联到 tree_tenants 表）")
    config_key = fields.CharField(max_length=100, description="配置键（唯一标识配置项）")
    config_value = fields.JSONField(default=dict, description="配置值（JSONB 存储）")
    description = fields.TextField(null=True, description="配置描述（可选）")
    
    class Meta:
        """
        模型元数据
        """
        table = "tree_tenant_configs"  # 表名必须包含模块前缀（tree_ - 租户管理）
        indexes = [
            ("tenant_id",),      # 组织 ID 索引
            ("config_key",),     # 配置键索引
            ("tenant_id", "config_key"),  # 组织 ID + 配置键联合索引（唯一性）
        ]
        unique_together = [("tenant_id", "config_key")]  # 同一组织下配置键唯一
    
    def __str__(self) -> str:
        """
        返回配置的字符串表示
        
        Returns:
            str: 配置字符串表示
        """
        return f"<TenantConfig(id={self.id}, tenant_id={self.tenant_id}, config_key={self.config_key})>"

