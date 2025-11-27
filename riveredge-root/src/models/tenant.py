"""
组织模型模块

定义组织数据模型，用于多组织系统的组织管理
"""

from enum import Enum
from typing import Optional, Dict, Any

from tortoise import fields

from models.base import BaseModel


class TenantStatus(str, Enum):
    """
    组织状态枚举
    
    定义组织的可用状态
    """
    ACTIVE = "active"          # 激活状态
    INACTIVE = "inactive"      # 未激活状态
    EXPIRED = "expired"        # 已过期状态
    SUSPENDED = "suspended"    # 已暂停状态


class TenantPlan(str, Enum):
    """
    组织套餐枚举
    
    定义组织的套餐类型
    """
    TRIAL = "trial"                    # 体验套餐
    BASIC = "basic"                    # 基础套餐
    PROFESSIONAL = "professional"     # 专业套餐
    ENTERPRISE = "enterprise"          # 企业套餐


class Tenant(BaseModel):
    """
    组织模型

    用于管理 SaaS 多组织系统中的组织信息。
    组织表本身不包含 tenant_id（因为组织本身就是组织的定义），
    但继承 BaseModel 以保持一致性（tenant_id 为 None）。

    Attributes:
        id: 组织 ID（主键）
        name: 组织名称
        domain: 组织域名（用于子域名访问）
        status: 组织状态（active, inactive, expired, suspended）
        plan: 组织套餐（basic, professional, enterprise）
        settings: 组织配置（JSONB 存储）
        max_users: 最大用户数限制
        max_storage: 最大存储空间限制（MB）
        expires_at: 过期时间（可选）
        created_at: 创建时间
        updated_at: 更新时间
    """

    id = fields.IntField(primary_key=True, description="组织 ID（主键）")
    name = fields.CharField(max_length=100, description="组织名称")
    domain = fields.CharField(max_length=100, unique=True, description="组织域名（用于子域名访问）")
    status = fields.CharEnumField(
        enum_type=TenantStatus,
        default=TenantStatus.INACTIVE,
        description="组织状态"
    )
    plan = fields.CharEnumField(
        enum_type=TenantPlan,
        default=TenantPlan.BASIC,
        description="组织套餐"
    )
    settings = fields.JSONField(default=dict, description="组织配置（JSONB 存储）")
    max_users = fields.IntField(default=10, description="最大用户数限制")
    max_storage = fields.IntField(default=1024, description="最大存储空间限制（MB）")
    expires_at = fields.DatetimeField(null=True, description="过期时间（可选）")

    class Meta:
        """
        模型元数据
        """
        table = "tree_tenants"  # 表名必须包含模块前缀（tree_ - 租户管理）
        indexes = [
            ("domain",),  # 域名索引
            ("status",),  # 状态索引
            ("plan",),    # 套餐索引
        ]
    
    def __str__(self) -> str:
        """
        返回组织的字符串表示
        
        Returns:
            str: 组织字符串表示
        """
        return f"<Tenant(id={self.id}, name={self.name}, domain={self.domain})>"
    
    async def is_active(self) -> bool:
        """
        检查组织是否处于激活状态
        
        Returns:
            bool: 如果组织状态为 active 则返回 True，否则返回 False
        """
        return self.status == TenantStatus.ACTIVE
    
    async def is_expired(self) -> bool:
        """
        检查组织是否已过期
        
        Returns:
            bool: 如果组织已过期则返回 True，否则返回 False
        """
        if self.expires_at is None:
            return False
        from datetime import datetime
        return datetime.now() > self.expires_at

