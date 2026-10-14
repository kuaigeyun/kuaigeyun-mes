"""其他收支类别主数据"""

from tortoise import fields
from core.models.base import BaseModel


class FinanceMiscIncomeCategory(BaseModel):
    """其他费用收入类别"""

    class Meta:
        table = "apps_kuaicaiwu_misc_income_categories"
        table_description = "快财务 - 其他收入类别"
        indexes = [("tenant_id", "code")]

    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, description="类别编码")
    name = fields.CharField(max_length=200, description="类别名称")
    is_active = fields.BooleanField(default=True, description="是否启用")
    default_gl_account_code = fields.CharField(max_length=20, null=True, description="默认科目")
    sort_order = fields.IntField(default=0, description="排序")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")


class FinanceMiscExpenseCategory(BaseModel):
    """其他费用支出类别"""

    class Meta:
        table = "apps_kuaicaiwu_misc_expense_categories"
        table_description = "快财务 - 其他支出类别"
        indexes = [("tenant_id", "code")]

    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, description="类别编码")
    name = fields.CharField(max_length=200, description="类别名称")
    is_active = fields.BooleanField(default=True, description="是否启用")
    default_gl_account_code = fields.CharField(max_length=20, null=True, description="默认科目")
    sort_order = fields.IntField(default=0, description="排序")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
