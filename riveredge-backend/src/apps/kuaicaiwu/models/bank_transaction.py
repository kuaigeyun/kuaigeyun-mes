"""
银行账户流水模型
"""

from tortoise import fields

from core.models.base import BaseModel


class BankTransaction(BaseModel):
    """银行账户收付流水（与收付款单勾稽）。"""

    class Meta:
        table = "apps_kuaicaiwu_bank_transactions"
        table_description = "管理会计 - 银行流水"
        indexes = [
            ("tenant_id", "bank_account_id"),
            ("tenant_id", "transaction_date"),
            ("source_doc_type", "source_doc_id"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    bank_account_id = fields.IntField(description="银行账户ID")
    transaction_date = fields.DateField(description="交易日期")
    direction = fields.CharField(max_length=10, description="方向 in/out")
    amount = fields.DecimalField(max_digits=16, decimal_places=4, description="交易金额")
    balance_after = fields.DecimalField(max_digits=16, decimal_places=4, description="交易后余额")
    source_doc_type = fields.CharField(max_length=50, null=True, description="来源单据类型")
    source_doc_id = fields.IntField(null=True, description="来源单据ID")
    source_doc_code = fields.CharField(max_length=50, null=True, description="来源单据编号")
    summary = fields.CharField(max_length=500, null=True, description="摘要")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    def __str__(self):
        return f"BankTransaction: {self.direction} {self.amount} ({self.source_doc_code})"
