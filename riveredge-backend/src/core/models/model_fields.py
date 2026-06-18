"""Tortoise 模型字段检测工具。"""

from __future__ import annotations

from tortoise.models import Model


def model_has_field(model: type[Model], field_name: str) -> bool:
    """检测模型是否定义某字段（含从 abstract BaseModel 继承的字段）。

    Tortoise 继承字段在模型类上 ``hasattr(model, field_name)`` 恒为 False，
    须通过 ``_meta.fields_map`` 判断。
    """
    return field_name in model._meta.fields_map
