"""
科目余额表（记账真源）
"""

from tortoise import fields

from core.models.base import BaseModel


class AccountBalance(BaseModel):
    """按期间+科目+辅助组合的余额。"""

    class Meta:
        table = "apps_kuaicaiwu_account_balances"
        table_description = "总账 - 科目余额"
        unique_together = (
            (
                "tenant_id",
                "period_year",
                "period_month",
                "account_id",
                "customer_id",
                "supplier_id",
                "department_id",
                "employee_id",
                "project_id",
            ),
        )
        indexes = [
            ("tenant_id", "period_year", "period_month"),
            ("tenant_id", "account_id"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    period_year = fields.IntField(description="会计年度")
    period_month = fields.IntField(description="会计月份")
    account_id = fields.IntField(description="科目ID")
    account_code = fields.CharField(max_length=32, description="科目编码")
    customer_id = fields.IntField(default=0, description="客户ID，无辅助为0")
    supplier_id = fields.IntField(default=0, description="供应商ID，无辅助为0")
    department_id = fields.IntField(default=0, description="部门ID，无辅助为0")
    employee_id = fields.IntField(default=0, description="职员ID，无辅助为0")
    project_id = fields.IntField(default=0, description="项目ID，无辅助为0")
    opening_debit = fields.DecimalField(max_digits=20, decimal_places=4, default=0, description="期初借方")
    opening_credit = fields.DecimalField(max_digits=20, decimal_places=4, default=0, description="期初贷方")
    period_debit = fields.DecimalField(max_digits=20, decimal_places=4, default=0, description="本期借方")
    period_credit = fields.DecimalField(max_digits=20, decimal_places=4, default=0, description="本期贷方")
    year_debit = fields.DecimalField(max_digits=20, decimal_places=4, default=0, description="本年累计借方")
    year_credit = fields.DecimalField(max_digits=20, decimal_places=4, default=0, description="本年累计贷方")
    ending_debit = fields.DecimalField(max_digits=20, decimal_places=4, default=0, description="期末借方")
    ending_credit = fields.DecimalField(max_digits=20, decimal_places=4, default=0, description="期末贷方")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
