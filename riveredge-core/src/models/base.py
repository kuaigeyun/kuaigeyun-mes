"""
基础数据模型模块

定义所有数据模型的基类，包含通用字段和租户隔离字段
"""

from datetime import datetime
from typing import Optional

from tortoise.models import Model
from tortoise import fields


class BaseModel(Model):
    """
    基础数据模型类

    所有数据模型都继承此类，自动获得以下字段：
    - id: 主键
    - tenant_id: 租户 ID（多租户隔离，关键字段）
    - created_at: 创建时间
    - updated_at: 更新时间

    Attributes:
        id: 主键 ID
        tenant_id: 租户 ID（用于多租户数据隔离）
        created_at: 创建时间
        updated_at: 更新时间
    """

    # 注意：不在基类中定义 id 字段，避免 Tortoise ORM 兼容性问题
    # 每个模型类需要自己定义 id = fields.IntField(primary_key=True)
    tenant_id = fields.IntField(null=True, db_index=True, description="租户 ID（用于多租户数据隔离）")
    created_at = fields.DatetimeField(auto_now_add=True, description="创建时间")
    updated_at = fields.DatetimeField(auto_now=True, description="更新时间")

    class Meta:
        """
        模型元数据
        """
        abstract = True  # 抽象模型，不会创建对应的数据库表

    def __str__(self) -> str:
        """
        返回模型的字符串表示

        Returns:
            str: 模型字符串表示
        """
        return f"<{self.__class__.__name__}(id={self.id})>"
