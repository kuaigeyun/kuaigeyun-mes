"""
记账凭证分录模型
"""

from tortoise import fields

from core.models.base import BaseModel


class VoucherLine(BaseModel):
    """凭证分录行。"""

    class Meta:
        table = "apps_kuaicaiwu_voucher_lines"
        table_description = "管理会计 - 凭证分录"
        indexes = [
            ("tenant_id", "voucher_id"),
            ("tenant_id", "account_id"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    voucher_id = fields.IntField(description="凭证ID")
    line_no = fields.IntField(description="行号")
    account_id = fields.IntField(description="科目ID")
    account_code = fields.CharField(max_length=32, description="科目编码")
    account_name = fields.CharField(max_length=200, description="科目名称")
    summary = fields.CharField(max_length=500, null=True, description="摘要")
    debit_amount = fields.DecimalField(max_digits=14, decimal_places=2, default=0, description="借方金额")
    credit_amount = fields.DecimalField(max_digits=14, decimal_places=2, default=0, description="贷方金额")
    partner_id = fields.IntField(null=True, description="往来单位ID")
    partner_name = fields.CharField(max_length=200, null=True, description="往来单位名称")

    def __str__(self):
        return f"VoucherLine: {self.voucher_id}-{self.line_no}"
