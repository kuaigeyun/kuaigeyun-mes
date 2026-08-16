"""
会计期间
"""

from tortoise import fields

from core.models.base import BaseModel


class AccountingPeriod(BaseModel):
    """会计期间。status: not_open / open / closed。"""

    class Meta:
        table = "apps_kuaicaiwu_accounting_periods"
        table_description = "总账 - 会计期间"
        unique_together = (("tenant_id", "period_year", "period_month"),)
        indexes = [
            ("tenant_id", "status"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    period_year = fields.IntField(description="会计年度")
    period_month = fields.IntField(description="会计月份")
    status = fields.CharField(max_length=20, default="not_open", description="not_open/open/closed")
    closed_at = fields.DatetimeField(null=True, description="结账时间")
    closed_by = fields.IntField(null=True, description="结账人")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
