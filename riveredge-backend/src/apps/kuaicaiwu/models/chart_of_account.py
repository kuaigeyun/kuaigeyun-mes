"""
会计科目表模型
"""

from tortoise import fields

from core.models.base import BaseModel


class ChartOfAccount(BaseModel):
    """总账科目。"""

    class Meta:
        table = "apps_kuaicaiwu_chart_of_accounts"
        table_description = "管理会计 - 会计科目"
        unique_together = (("tenant_id", "account_code"),)
        indexes = [
            ("tenant_id", "account_type"),
            ("tenant_id", "is_active"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    account_code = fields.CharField(max_length=32, description="科目编码")
    account_name = fields.CharField(max_length=200, description="科目名称")
    account_type = fields.CharField(
        max_length=20,
        description="科目类型 asset/liability/equity/revenue/expense",
    )
    parent_id = fields.IntField(null=True, description="上级科目ID")
    level = fields.IntField(default=1, description="科目级次")
    is_leaf = fields.BooleanField(default=True, description="是否末级科目")
    balance_direction = fields.CharField(max_length=10, default="debit", description="余额方向 debit/credit")
    is_active = fields.BooleanField(default=True, description="是否启用")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    def __str__(self):
        return f"ChartOfAccount: {self.account_code} {self.account_name}"
