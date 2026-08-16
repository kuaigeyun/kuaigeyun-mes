"""
自定义转账 / 结转模板
"""

from tortoise import fields

from core.models.base import BaseModel


class GlTransferTemplate(BaseModel):
    """期末转账模板。template_type: custom / profit_loss。"""

    class Meta:
        table = "apps_kuaicaiwu_gl_transfer_templates"
        table_description = "总账 - 转账模板"

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    template_code = fields.CharField(max_length=50, description="模板编码")
    template_name = fields.CharField(max_length=200, description="模板名称")
    template_type = fields.CharField(max_length=30, default="custom", description="custom/profit_loss")
    # [{side, account_code, summary, amount_mode: fixed|balance|formula, amount?}]
    lines = fields.JSONField(default=list, description="分录模板行")
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
