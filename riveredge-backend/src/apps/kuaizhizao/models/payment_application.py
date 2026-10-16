"""
付款申请单模型（采购请款 → 财务付款）
"""

from tortoise import fields
from core.models.base import BaseModel
from apps.kuaizhizao.constants import ReviewStatus


class PaymentApplication(BaseModel):
    """付款申请头"""

    tenant_id = fields.IntField(description="租户ID")
    application_code = fields.CharField(max_length=50, db_index=True, description="申请单号")

    supplier_id = fields.IntField(description="供应商ID")
    supplier_name = fields.CharField(max_length=200, description="供应商名称")

    application_kind = fields.CharField(
        max_length=20,
        default="goods",
        description="prepayment/goods/invoice/mixed",
    )
    application_date = fields.DateField(null=True, description="申请日期")
    expected_payment_date = fields.DateField(null=True, description="期望付款日")

    applicant_id = fields.IntField(null=True, description="申请人ID")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人姓名")

    total_request_amount = fields.DecimalField(
        max_digits=16, decimal_places=4, default=0, description="申请总额"
    )
    paid_amount = fields.DecimalField(
        max_digits=16, decimal_places=4, default=0, description="已付款累计"
    )
    remaining_amount = fields.DecimalField(
        max_digits=16, decimal_places=4, default=0, description="待付款余额"
    )

    status = fields.CharField(max_length=20, default="草稿", description="业务状态")
    review_status = fields.CharField(
        max_length=20, default=ReviewStatus.PENDING.value, description="审核状态"
    )
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_remarks = fields.TextField(null=True, description="审核备注")

    supplier_account_name = fields.CharField(max_length=200, null=True, description="收款户名")
    supplier_bank_name = fields.CharField(max_length=200, null=True, description="收款开户行")
    supplier_bank_account = fields.CharField(max_length=64, null=True, description="收款账号")

    payment_reason = fields.TextField(null=True, description="付款事由")
    payment_method = fields.CharField(max_length=50, null=True, description="付款方式")
    invoice_status = fields.CharField(max_length=50, null=True, description="发票情况")
    payment_terms = fields.CharField(max_length=200, null=True, description="付款条件")

    notes = fields.TextField(null=True, description="备注")
    require_payment_voucher = fields.BooleanField(
        default=False,
        description="是否要求后续付款单上传付款凭证",
    )
    attachments = fields.JSONField(null=True, description="附件")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    lines: fields.ReverseRelation["PaymentApplicationLine"]

    class Meta:
        table = "apps_kuaizhizao_payment_applications"
        table_description = "快格轻制造 - 付款申请单"


class PaymentApplicationLine(BaseModel):
    """付款申请行"""

    tenant_id = fields.IntField(description="租户ID")
    application_id = fields.IntField(description="付款申请ID")
    line_no = fields.IntField(default=1, description="行号")

    source_type = fields.CharField(max_length=50, description="来源单据类型")
    source_id = fields.IntField(null=True, description="来源单据ID")
    source_code = fields.CharField(max_length=50, null=True, description="来源单据编码")

    payable_id = fields.IntField(null=True, description="关联应付单ID")
    payable_code = fields.CharField(max_length=50, null=True, description="应付单编码")

    line_kind = fields.CharField(max_length=20, default="goods", description="行请款类型")
    request_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="申请金额")
    paid_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="已付金额")
    max_request_amount = fields.DecimalField(
        max_digits=16, decimal_places=4, default=0, description="最大可申请"
    )
    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_payment_application_lines"
        table_description = "快格轻制造 - 付款申请明细"
        indexes = [
            ("tenant_id", "application_id"),
            ("tenant_id", "payable_id"),
        ]
