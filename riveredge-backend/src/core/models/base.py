"""
系统级基础数据模型模块

定义所有系统级数据模型的基类，包含通用字段和组织隔离字段。
继承自 infra.models.base.BaseModel，确保与平台级模型保持一致。
"""

import uuid as uuid_module
from tortoise import fields
from tortoise.models import Model

from infra.models.base import BaseModel as SoilBaseModel


def _generate_uuid() -> str:
    """生成 UUID 字符串"""
    return str(uuid_module.uuid4())


class LogBaseModel(Model):
    """
    日志类模型基类（无 updated_at）

    用于登录日志、操作日志等只增不改的模型。
    数据库表仅有 created_at，无 updated_at。
    子类可覆盖 tenant_id 为必填（如 OperationLog）。
    """

    uuid = fields.CharField(max_length=36, description="业务ID", default=_generate_uuid)
    tenant_id = fields.IntField(null=True, db_index=True, description="组织 ID（登录失败时可为空）")
    created_at = fields.DatetimeField(auto_now_add=True, description="创建时间")

    class Meta:
        abstract = True


class BaseModel(SoilBaseModel):
    """
    系统级基础数据模型类
    
    继承自 infra.models.base.BaseModel，自动获得以下字段：
    - id: 主键（自增ID，内部使用，性能优先）
    - uuid: 业务ID（UUID，对外暴露，安全且唯一）
    - tenant_id: 组织 ID（多组织隔离，关键字段）
    - created_at: 创建时间
    - updated_at: 更新时间
    
    所有系统级模型都继承此类，确保与平台级模型保持一致。
    
    Attributes:
        id: 主键 ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织 ID（用于多组织数据隔离）
        created_at: 创建时间（时区感知的 datetime）
        updated_at: 更新时间（时区感知的 datetime）
    """
    
    class Meta:
        """
        模型元数据
        """
        abstract = True  # 抽象模型，不会创建对应的数据库表

