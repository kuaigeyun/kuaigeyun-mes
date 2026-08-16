"""税务设置（纳税人身份、税率目录、附加税、科目绑定）。"""

from tortoise import fields

from core.models.base import BaseModel


class GlTaxSettings(BaseModel):
    """租户级税务参数。"""

    class Meta:
        table = "apps_kuaicaiwu_gl_tax_settings"
        table_description = "快财务 - 税务设置"
        unique_together = (("tenant_id",),)

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    taxpayer_type = fields.CharField(
        max_length=20,
        default="general",
        description="纳税人类型 general/small_scale",
    )
    tax_rates = fields.JSONField(default=list, description="税率目录")
    surcharge_rates = fields.JSONField(default=dict, description="附加税税率")
    account_bindings = fields.JSONField(default=dict, description="科目绑定 account_id 映射")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
