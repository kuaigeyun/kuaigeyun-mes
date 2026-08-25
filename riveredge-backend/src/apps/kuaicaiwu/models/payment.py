"""
付款单模型
"""

from tortoise import fields
from core.models.base import BaseModel

class Payment(BaseModel):
    """
    付款单 (Payment)
    
    记录向供应商付出的款项。多用于核销多笔应付单或作为预付款项。
    """
    
    class Meta:
        table = "apps_kuaicaiwu_payments"
        table_description = "管理会计 - 付款单"
        indexes = [
            ("tenant_id", "supplier_id"),
            ("payment_date",),
            ("status",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    payment_code = fields.CharField(max_length=50, db_index=True, description="付款单号")  # 租户内未删除唯一，见迁移 463

    supplier_id = fields.IntField(description="供应商ID")
    supplier_name = fields.CharField(max_length=200, description="供应商名称")

    # 金额
    total_amount = fields.DecimalField(max_digits=16, decimal_places=4, description="付款总额")
    settled_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="已核销金额")
    unsettled_amount = fields.DecimalField(max_digits=16, decimal_places=4, description="待核销金额")

    payment_date = fields.DateField(description="付款日期")
    payment_method = fields.CharField(max_length=50, description="付款方式 (银行转账/现金/票据等)")
    bank_account = fields.CharField(max_length=100, null=True, description="出款账号")
    bank_account_id = fields.IntField(null=True, description="银行账户ID")
    settlement_type = fields.CharField(
        max_length=20,
        default="normal",
        description="结算类型 normal/prepayment/refund",
    )

    refunded_amount = fields.DecimalField(
        max_digits=16, decimal_places=4, default=0, description="已确认退款合计"
    )
    refund_execution_status = fields.CharField(
        max_length=20, default="未退款", description="退款执行状态 未退款/部分退款/全部退款"
    )

    status = fields.CharField(max_length=20, default="Draft", description="状态 (Draft/Confirmed/Cancelled)")
    
    notes = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件列表")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    def __str__(self):
        return f"Payment: {self.payment_code} ({self.total_amount})"
