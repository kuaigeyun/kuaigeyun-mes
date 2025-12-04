"""
套餐模型模块

定义套餐数据模型，用于套餐管理
"""

from typing import Optional, List
from tortoise import fields

from infra.models.base import BaseModel
from infra.models.tenant import TenantPlan


class Package(BaseModel):
    """
    套餐模型
    
    用于管理 SaaS 多组织系统中的套餐配置。
    套餐表本身不包含 tenant_id（因为套餐是平台级配置），
    但继承 BaseModel 以保持一致性（tenant_id 为 None）。
    
    Attributes:
        id: 套餐 ID（主键）
        name: 套餐名称
        plan: 套餐类型（TenantPlan 枚举）
        max_users: 最大用户数限制
        max_storage_mb: 最大存储空间限制（MB）
        allow_pro_apps: 是否允许使用 PRO 应用
        description: 套餐描述
        price: 套餐价格（可选）
        features: 套餐功能列表（JSON 存储）
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="套餐 ID（主键）")
    name = fields.CharField(max_length=100, description="套餐名称")
    plan = fields.CharEnumField(
        enum_type=TenantPlan,
        description="套餐类型"
    )
    max_users = fields.IntField(description="最大用户数限制")
    max_storage_mb = fields.IntField(description="最大存储空间限制（MB）")
    allow_pro_apps = fields.BooleanField(default=False, description="是否允许使用 PRO 应用")
    description = fields.TextField(null=True, description="套餐描述")
    price = fields.FloatField(null=True, description="套餐价格（可选）")
    features = fields.JSONField(default=list, description="套餐功能列表（JSON 存储）")
    
    class Meta:
        """
        模型元数据
        """
        table = "platform_packages"  # 表名必须包含模块前缀（soil_ - 平台级）
        indexes = [
            ("plan",),  # 套餐类型索引
        ]
    
    def __str__(self) -> str:
        """
        返回套餐的字符串表示
        
        Returns:
            str: 套餐字符串表示
        """
        return f"<Package(id={self.id}, name={self.name}, plan={self.plan})>"

