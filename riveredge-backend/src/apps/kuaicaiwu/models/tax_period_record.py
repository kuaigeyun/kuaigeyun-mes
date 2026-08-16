"""税务属期记录：计提凭证引用与属期锁定。"""

from tortoise import fields

from core.models.base import BaseModel


class TaxPeriodRecord(BaseModel):
    """按年月的税务属期状态。"""

    class Meta:
        table = "apps_kuaicaiwu_tax_period_records"
        table_description = "快财务 - 税务属期"
        unique_together = (("tenant_id", "period_year", "period_month"),)

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    period_year = fields.IntField(description="属期年")
    period_month = fields.IntField(description="属期月")
    locked = fields.BooleanField(default=False, description="属期已锁定")
    locked_at = fields.DatetimeField(null=True, description="锁定时间")
    locked_by = fields.IntField(null=True, description="锁定操作人")
    vat_transfer_voucher_id = fields.IntField(null=True, description="增值税结转凭证ID")
    surcharge_voucher_id = fields.IntField(null=True, description="附加税计提凭证ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
