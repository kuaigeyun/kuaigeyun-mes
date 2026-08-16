"""摊销 / 预提台账"""

from tortoise import fields

from core.models.base import BaseModel


class GlAccrualItem(BaseModel):
    class Meta:
        table = "apps_kuaicaiwu_gl_accrual_items"
        table_description = "总账 - 摊销预提台账"
        unique_together = (("tenant_id", "item_code"),)

    id = fields.IntField(pk=True)
    tenant_id = fields.IntField(description="租户ID")
    item_code = fields.CharField(max_length=64, description="台账编码")
    item_name = fields.CharField(max_length=200, description="名称")
    # accrual=预提 deferred=待摊
    accrual_type = fields.CharField(max_length=20, default="accrual", description="类型")
    total_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="总额")
    amortized_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="已摊/已提")
    period_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="每期金额")
    start_year = fields.IntField(description="起始年")
    start_month = fields.IntField(description="起始月")
    periods = fields.IntField(default=1, description="期数")
    debit_account_code = fields.CharField(max_length=32, description="借方科目")
    credit_account_code = fields.CharField(max_length=32, description="贷方科目")
    summary = fields.CharField(max_length=500, null=True, description="摘要")
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
