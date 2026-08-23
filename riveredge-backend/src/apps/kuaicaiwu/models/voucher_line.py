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
    debit_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="借方金额")
    credit_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="贷方金额")
    partner_id = fields.IntField(null=True, description="往来单位ID（兼容）")
    partner_name = fields.CharField(max_length=200, null=True, description="往来单位名称（兼容）")
    customer_id = fields.IntField(null=True, description="辅助-客户ID")
    customer_name = fields.CharField(max_length=200, null=True, description="辅助-客户名称")
    supplier_id = fields.IntField(null=True, description="辅助-供应商ID")
    supplier_name = fields.CharField(max_length=200, null=True, description="辅助-供应商名称")
    department_id = fields.IntField(null=True, description="辅助-部门ID")
    department_name = fields.CharField(max_length=200, null=True, description="辅助-部门名称")
    employee_id = fields.IntField(null=True, description="辅助-职员ID")
    employee_name = fields.CharField(max_length=200, null=True, description="辅助-职员名称")
    project_id = fields.IntField(null=True, description="辅助-项目ID")
    project_name = fields.CharField(max_length=200, null=True, description="辅助-项目名称")
    cash_flow_item_id = fields.IntField(null=True, description="现金流量项目ID")

    def __str__(self):
        return f"VoucherLine: {self.voucher_id}-{self.line_no}"
