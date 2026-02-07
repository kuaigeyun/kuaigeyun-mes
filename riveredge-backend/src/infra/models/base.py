"""
基础数据模型模块

定义所有数据模型的基类，包含通用字段和组织隔离字段
"""

from datetime import datetime
from typing import Optional
import uuid

from tortoise.models import Model
from tortoise import fields
from tortoise import timezone as tz


def _generate_uuid() -> str:
    """生成 UUID 字符串（用于 BaseModel 的 uuid 字段默认值）"""
    return str(uuid.uuid4())


class BaseModel(Model):
    """
    基础数据模型类

    所有数据模型都继承此类，自动获得以下字段：
    - id: 主键（自增ID，内部使用，性能优先）
    - uuid: 业务ID（UUID，对外暴露，安全且唯一）
    - tenant_id: 组织 ID（多组织隔离，关键字段）
    - created_at: 创建时间
    - updated_at: 更新时间

    Attributes:
        id: 主键 ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织 ID（用于多组织数据隔离）
        created_at: 创建时间（时区感知的 datetime）
        updated_at: 更新时间（时区感知的 datetime）
    """

    # 注意：不在基类中定义 id 字段，避免 Tortoise ORM 兼容性问题
    # 每个模型类需要自己定义 id = fields.IntField(pk=True)
    
    # UUID 字段：用于对外暴露，保证安全性和全局唯一性
    # 使用混合策略：内部查询使用自增ID（性能好），对外API使用UUID（安全性好）
    # 数据库迁移已完成，uuid 字段已添加到所有表中
    # 注意：unique 和 db_index 在迁移文件中通过 SQL 添加，避免 Tortoise ORM 模型检查问题
    uuid = fields.CharField(
        max_length=36,
        default=_generate_uuid,
        description="业务ID（UUID，对外暴露，安全且唯一）"
    )
    
    tenant_id = fields.IntField(null=True, db_index=True, description="组织 ID（用于多组织数据隔离）")
    # 使用原生datetime.now()，避免Tortoise ORM时区处理的复杂性
    created_at = fields.DatetimeField(auto_now_add=True, description="创建时间")
    updated_at = fields.DatetimeField(auto_now=True, description="更新时间")

    class Meta:
        """
        模型元数据
        """
        abstract = True  # 抽象模型，不会创建对应的数据库表

