"""
票据台账模型（应收票据 / 应付票据）
"""

from tortoise import fields

from core.models.base import BaseModel


class FinanceNote(BaseModel):
    """银承/商承票据台账。"""

    class Meta:
        table = "apps_kuaicaiwu_notes"
        table_description = "管理会计 - 票据台账"
        indexes = [
            ("tenant_id", "direction", "status"),
            ("tenant_id", "due_date"),
            ("tenant_id", "note_code"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    direction = fields.CharField(max_length=20, description="方向 receivable/payable")
    bill_type = fields.CharField(max_length=30, description="bank_acceptance/commercial_acceptance")
    note_code = fields.CharField(max_length=50, description="系统单号")
    bill_no = fields.CharField(max_length=100, description="票号")
    amount = fields.DecimalField(max_digits=14, decimal_places=2, description="票面金额")
    issue_date = fields.DateField(description="出票日期")
    due_date = fields.DateField(description="到期日期")
    drawer_name = fields.CharField(max_length=200, null=True, description="出票人")
    acceptor_name = fields.CharField(max_length=200, null=True, description="承兑人")
    payee_name = fields.CharField(max_length=200, null=True, description="收款人")
    accepting_bank = fields.CharField(max_length=200, null=True, description="承兑行（银承）")
    customer_id = fields.IntField(null=True, description="客户ID")
    customer_name = fields.CharField(max_length=200, null=True, description="客户名称")
    supplier_id = fields.IntField(null=True, description="供应商ID")
    supplier_name = fields.CharField(max_length=200, null=True, description="供应商名称")
    receipt_id = fields.IntField(null=True, description="关联收款单")
    payment_id = fields.IntField(null=True, description="关联付款单")
    receivable_id = fields.IntField(null=True, description="关联应收单")
    payable_id = fields.IntField(null=True, description="关联应付单")
    status = fields.CharField(max_length=30, description="状态")
    endorse_to_name = fields.CharField(max_length=200, null=True, description="被背书人")
    discount_bank = fields.CharField(max_length=200, null=True, description="贴现银行")
    discount_date = fields.DateField(null=True, description="贴现日期")
    discount_interest = fields.DecimalField(
        max_digits=14, decimal_places=2, null=True, description="贴现利息"
    )
    settle_date = fields.DateField(null=True, description="兑付/托收日期")
    notes = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")
