"""
记账凭证模型
"""

from tortoise import fields

from core.models.base import BaseModel


class Voucher(BaseModel):
    """总账记账凭证（草稿/已过账）。"""

    class Meta:
        table = "apps_kuaicaiwu_vouchers"
        table_description = "管理会计 - 记账凭证"
        indexes = [
            ("tenant_id", "voucher_date"),
            ("tenant_id", "status"),
            ("tenant_id", "period_year", "period_month"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    voucher_code = fields.CharField(max_length=50, unique=True, description="凭证号")
    voucher_date = fields.DateField(description="凭证日期")
    period_year = fields.IntField(description="会计年度")
    period_month = fields.IntField(description="会计月份")
    status = fields.CharField(max_length=20, default="draft", description="draft/posted/cancelled")
    summary = fields.CharField(max_length=500, null=True, description="摘要")
    source_event_id = fields.IntField(null=True, description="来源会计事件ID")
    source_doc_type = fields.CharField(max_length=50, null=True, description="来源单据类型")
    source_doc_id = fields.IntField(null=True, description="来源单据ID")
    total_debit = fields.DecimalField(max_digits=14, decimal_places=2, default=0, description="借方合计")
    total_credit = fields.DecimalField(max_digits=14, decimal_places=2, default=0, description="贷方合计")
    posted_at = fields.DatetimeField(null=True, description="过账时间")
    posted_by = fields.IntField(null=True, description="过账人")
    created_by = fields.IntField(null=True, description="创建人")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    def __str__(self):
        return f"Voucher: {self.voucher_code} ({self.status})"
