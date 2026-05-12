"""好力GO 模型基类：租户隔离 + 主键 + 软删除。"""

from tortoise import fields

from core.models.base import BaseModel as CoreBaseModel


class HaoligoTenantModel(CoreBaseModel):
    """好力GO 业务表公共字段。"""

    id = fields.IntField(pk=True)
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        abstract = True
