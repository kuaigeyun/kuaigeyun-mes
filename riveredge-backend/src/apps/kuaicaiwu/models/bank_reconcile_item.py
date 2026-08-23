"""
银行对账（轻量出纳）
"""

from tortoise import fields

from core.models.base import BaseModel


class BankReconcileItem(BaseModel):
    """银行对账条目：企业账或银行账未达/已勾对。"""

    class Meta:
        table = "apps_kuaicaiwu_bank_reconcile_items"
        table_description = "总账 - 银行对账条目"
        indexes = [
            ("tenant_id", "gl_account_id", "is_matched"),
            ("tenant_id", "period_year", "period_month"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    gl_account_id = fields.IntField(description="总账银行科目ID")
    period_year = fields.IntField(description="期间年")
    period_month = fields.IntField(description="期间月")
    # enterprise = 企业账（来自凭证日记账）；bank = 银行对账单
    side = fields.CharField(max_length=20, description="enterprise/bank")
    txn_date = fields.DateField(description="日期")
    summary = fields.CharField(max_length=500, null=True, description="摘要")
    debit_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="借方")
    credit_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="贷方")
    is_opening = fields.BooleanField(default=False, description="是否期初未达")
    is_matched = fields.BooleanField(default=False, description="是否已勾对")
    match_group = fields.CharField(max_length=36, null=True, description="勾对组")
    voucher_id = fields.IntField(null=True, description="关联凭证ID")
    voucher_line_id = fields.IntField(null=True, description="关联分录ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
