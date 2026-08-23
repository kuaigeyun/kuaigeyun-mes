"""出纳支票（轻量，无银企）"""

from tortoise import fields

from core.models.base import BaseModel


class GlCheque(BaseModel):
    class Meta:
        table = "apps_kuaicaiwu_gl_cheques"
        table_description = "总账 - 支票台账"
        unique_together = (("tenant_id", "cheque_no"),)

    id = fields.IntField(pk=True)
    tenant_id = fields.IntField(description="租户ID")
    cheque_no = fields.CharField(max_length=64, description="支票号")
    gl_account_id = fields.IntField(description="银行科目ID")
    issue_date = fields.DateField(description="签发日期")
    payee = fields.CharField(max_length=200, null=True, description="收款人")
    amount = fields.DecimalField(max_digits=20, decimal_places=4, default=0, description="金额")
    # issued / cleared / void
    status = fields.CharField(max_length=20, default="issued", description="状态")
    cleared_date = fields.DateField(null=True, description="核销日期")
    voucher_id = fields.IntField(null=True, description="关联凭证")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
