"""
往来对账单模型
"""

from tortoise import fields
from core.models.base import BaseModel


class PartnerStatement(BaseModel):
    """
    往来对账单 (Partner Statement)

    用于记录与客户或供应商在特定时间段内的所有往来交易摘要，作为双方对账的正式凭据。
    包含：期初余额、本期发生额、期末余额。
    """

    class Meta:
        table = "apps_kuaicaiwu_partner_statements"
        table_description = "管理会计 - 往来对账单"
        indexes = [
            ("tenant_id", "partner_id"),
            ("statement_period",),
            ("status",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    statement_code = fields.CharField(max_length=50, unique=True, description="对账单号")

    partner_id = fields.IntField(description="往来单位ID")
    partner_name = fields.CharField(max_length=200, description="往来单位名称")
    partner_type = fields.CharField(max_length=20, description="单位类型 (Customer/Supplier)")

    statement_period = fields.CharField(max_length=20, description="对账周期 (YYYY-MM)")
    start_date = fields.DateField(description="开始日期")
    end_date = fields.DateField(description="结束日期")

    opening_balance = fields.DecimalField(max_digits=14, decimal_places=2, description="期初余额")
    debit_total = fields.DecimalField(max_digits=14, decimal_places=2, description="本期借方总额")
    credit_total = fields.DecimalField(max_digits=14, decimal_places=2, description="本期贷方总额")
    closing_balance = fields.DecimalField(max_digits=14, decimal_places=2, description="期末余额")

    status = fields.CharField(max_length=20, default="Draft", description="状态 (Draft/Confirmed/Sent/Disputed)")

    transaction_details = fields.JSONField(null=True, description="往来明细快照")
    company_name = fields.CharField(max_length=200, null=True, description="我司名称快照")

    confirmed_at = fields.DatetimeField(null=True, description="内部确认时间")
    confirmed_by = fields.IntField(null=True, description="确认人ID")

    sent_at = fields.DatetimeField(null=True, description="发送时间")
    sent_by = fields.IntField(null=True, description="发送操作人ID")
    sent_channel = fields.CharField(max_length=30, null=True, description="发送渠道")

    dispute_reason = fields.TextField(null=True, description="异议说明")
    disputed_at = fields.DatetimeField(null=True, description="异议记录时间")

    notes = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件列表")
    created_by = fields.IntField(null=True, description="创建人ID")
    created_at = fields.DatetimeField(auto_now_add=True, description="创建时间")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    def __str__(self):
        return f"Statement: {self.partner_name} - {self.statement_period}"
