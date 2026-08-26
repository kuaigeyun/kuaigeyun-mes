"""
资源分类模型模块

用于接口管理、数据集管理等模块的平铺分类。
"""

from tortoise import fields
from typing import TYPE_CHECKING

from .base import BaseModel

if TYPE_CHECKING:
    from .api import API
    from .dataset import Dataset

RESOURCE_TYPE_API = "api"
RESOURCE_TYPE_DATASET = "dataset"
RESOURCE_TYPES = (RESOURCE_TYPE_API, RESOURCE_TYPE_DATASET)


class ResourceCategory(BaseModel):
    """
    资源分类模型

    按 resource_type 区分接口分类与数据集分类，租户内 code 唯一。
    """

    id = fields.IntField(pk=True, description="分类ID")
    name = fields.CharField(max_length=100, description="分类名称")
    code = fields.CharField(max_length=50, description="分类代码")
    description = fields.TextField(null=True, description="分类描述")
    resource_type = fields.CharField(max_length=20, description="资源类型：api/dataset")
    sort_order = fields.IntField(default=0, description="排序")
    is_active = fields.BooleanField(default=True, description="是否启用")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    apis: fields.ReverseRelation["API"]
    datasets: fields.ReverseRelation["Dataset"]

    class Meta:
        table = "core_resource_categories"
        indexes = [
            ("tenant_id", "resource_type"),
            ("uuid",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "resource_type", "code")]

    def __str__(self) -> str:
        return f"{self.name} ({self.resource_type})"
