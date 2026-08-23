"""
银行账户模型
"""

from tortoise import fields

from core.models.base import BaseModel


class BankAccount(BaseModel):
    """组织银行账户主数据。"""

    class Meta:
        table = "apps_kuaicaiwu_bank_accounts"
        table_description = "管理会计 - 银行账户"
        indexes = [
            ("tenant_id", "account_code"),
            ("tenant_id", "is_active"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    account_code = fields.CharField(max_length=50, description="账户编码")
    account_name = fields.CharField(max_length=200, description="账户名称")
    # bank=银行账户；cash=库存现金（现金收付款入账账户）
    account_type = fields.CharField(max_length=20, default="bank", description="账户类型 bank/cash")
    bank_name = fields.CharField(max_length=200, null=True, description="开户行")
    account_number = fields.CharField(max_length=64, null=True, description="银行账号")
    currency = fields.CharField(max_length=10, default="CNY", description="币种")
    opening_balance = fields.DecimalField(
        max_digits=16, decimal_places=4, default=0, description="期初余额"
    )
    current_balance = fields.DecimalField(
        max_digits=16, decimal_places=4, default=0, description="当前余额"
    )
    is_active = fields.BooleanField(default=True, description="是否启用")
    notes = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件列表")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    def __str__(self):
        return f"BankAccount: {self.account_code} ({self.account_name})"
