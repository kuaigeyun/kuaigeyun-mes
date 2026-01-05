"""
系统级基础Schema模块

提供统一的BaseSchema基类，用于应用级schema继承。
"""

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    """
    应用级schema基础类

    提供统一的配置和基础功能
    """
    model_config = ConfigDict(
        from_attributes=True,  # 支持从ORM模型转换
        validate_assignment=True,  # 赋值时验证
        arbitrary_types_allowed=True,  # 允许任意类型
    )















