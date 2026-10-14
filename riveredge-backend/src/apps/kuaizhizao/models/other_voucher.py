"""其他费用收入 / 其他费用支出单据"""

from tortoise import fields
from core.models.base import BaseModel


class OtherIncome(BaseModel):
    """其他费用收入头"""

    class Meta:
        table = "apps_kuaicaiwu_other_incomes"
        table_description = "快财务 - 其他费用收入"
        indexes = [
            ("tenant_id", "income_code"),
            ("tenant_id", "status"),
            ("business_date",),
        ]

    tenant_id = fields.IntField(description="租户ID")
    income_code = fields.CharField(max_length=50, db_index=True, description="单号")

    business_date = fields.DateField(description="业务日期")
    counterparty_kind = fields.CharField(
        max_length=20, default="none", description="none/customer/supplier/employee/other"
    )
    counterparty_id = fields.IntField(null=True, description="往来ID")
    counterparty_name = fields.CharField(max_length=200, null=True, description="往来名称快照")

    total_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="合计")
    payment_method = fields.CharField(max_length=50, description="收付方式")
    bank_account_id = fields.IntField(null=True, description="银行账户ID")
    bank_account = fields.CharField(max_length=100, null=True, description="账户快照")

    status = fields.CharField(
        max_length=20,
        default="Draft",
        description="Draft/PendingReview/Approved/Rejected/Confirmed/Cancelled",
    )
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_remarks = fields.TextField(null=True, description="审核备注")

    department_id = fields.IntField(null=True, description="部门ID")
    department_name = fields.CharField(max_length=200, null=True, description="部门名称")
    project_id = fields.IntField(null=True, description="项目ID")
    project_name = fields.CharField(max_length=200, null=True, description="项目名称")

    notes = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")


class OtherIncomeLine(BaseModel):
    class Meta:
        table = "apps_kuaicaiwu_other_income_lines"
        table_description = "快财务 - 其他费用收入明细"
        indexes = [("tenant_id", "other_income_id")]

    tenant_id = fields.IntField(description="租户ID")
    other_income_id = fields.IntField(description="头表ID")
    line_no = fields.IntField(default=1, description="行号")
    category_code = fields.CharField(max_length=50, description="类别编码")
    category_name = fields.CharField(max_length=200, description="类别名称")
    amount = fields.DecimalField(max_digits=16, decimal_places=4, description="金额")
    description = fields.TextField(null=True, description="行摘要")
    gl_account_code = fields.CharField(max_length=20, null=True, description="科目")


class OtherExpense(BaseModel):
    """其他费用支出头"""

    class Meta:
        table = "apps_kuaicaiwu_other_expenses"
        table_description = "快财务 - 其他费用支出"
        indexes = [
            ("tenant_id", "expense_code"),
            ("tenant_id", "status"),
            ("business_date",),
        ]

    tenant_id = fields.IntField(description="租户ID")
    expense_code = fields.CharField(max_length=50, db_index=True, description="单号")

    business_date = fields.DateField(description="业务日期")
    counterparty_kind = fields.CharField(
        max_length=20, default="none", description="none/customer/supplier/employee/other"
    )
    counterparty_id = fields.IntField(null=True, description="往来ID")
    counterparty_name = fields.CharField(max_length=200, null=True, description="往来名称快照")

    total_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="合计")
    payment_method = fields.CharField(max_length=50, description="收付方式")
    bank_account_id = fields.IntField(null=True, description="银行账户ID")
    bank_account = fields.CharField(max_length=100, null=True, description="账户快照")

    status = fields.CharField(
        max_length=20,
        default="Draft",
        description="Draft/PendingReview/Approved/Rejected/Confirmed/Cancelled",
    )
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_remarks = fields.TextField(null=True, description="审核备注")

    department_id = fields.IntField(null=True, description="部门ID")
    department_name = fields.CharField(max_length=200, null=True, description="部门名称")
    project_id = fields.IntField(null=True, description="项目ID")
    project_name = fields.CharField(max_length=200, null=True, description="项目名称")

    notes = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")


class OtherExpenseLine(BaseModel):
    class Meta:
        table = "apps_kuaicaiwu_other_expense_lines"
        table_description = "快财务 - 其他费用支出明细"
        indexes = [("tenant_id", "other_expense_id")]

    tenant_id = fields.IntField(description="租户ID")
    other_expense_id = fields.IntField(description="头表ID")
    line_no = fields.IntField(default=1, description="行号")
    category_code = fields.CharField(max_length=50, description="类别编码")
    category_name = fields.CharField(max_length=200, description="类别名称")
    amount = fields.DecimalField(max_digits=16, decimal_places=4, description="金额")
    description = fields.TextField(null=True, description="行摘要")
    gl_account_code = fields.CharField(max_length=20, null=True, description="科目")
