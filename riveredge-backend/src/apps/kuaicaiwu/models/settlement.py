"""
往来核销记录模型
"""

from tortoise import fields
from core.models.base import BaseModel

class SettlementRecord(BaseModel):
    """
    往来核销记录
    
    用于记录收付款单与应收应付单、发票之间的核销关系。
    支持多对多核销：一笔收款核销多张发票，或一张发票由多笔收款核销。
    """
    
    class Meta:
        table = "apps_kuaicaiwu_settlements"
        table_description = "管理会计 - 往来核销记录"
        indexes = [
            ("tenant_id", "partner_id"),
            ("debit_doc_type", "debit_doc_id"),
            ("credit_doc_type", "credit_doc_id"),
            ("settlement_date",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    settlement_code = fields.CharField(max_length=50, db_index=True, description="核销单号")  # 租户内未删除唯一，见迁移 463

    partner_id = fields.IntField(description="往来单位ID")
    partner_name = fields.CharField(max_length=200, description="往来单位名称")

    # 借方单据 (通常为应收/发票/借报)
    debit_doc_type = fields.CharField(max_length=50, description="借方单据类型 (Receivable/Payable/Invoice)")
    debit_doc_id = fields.IntField(description="借方单据ID")
    debit_doc_code = fields.CharField(max_length=50, description="借方单据编号")

    # 贷方单据 (通常为收款/预收/贷报/对冲单)
    credit_doc_type = fields.CharField(max_length=50, description="贷方单据类型 (Receipt/Payment/AdvancePayment)")
    credit_doc_id = fields.IntField(description="贷方单据ID")
    credit_doc_code = fields.CharField(max_length=50, description="贷方单据编号")

    # 金额
    amount = fields.DecimalField(max_digits=14, decimal_places=2, description="本次核销金额")
    currency = fields.CharField(max_length=10, default="CNY", description="币种")

    settlement_date = fields.DateField(description="核销日期")
    operator_id = fields.IntField(null=True, description="核销人ID")
    operator_name = fields.CharField(max_length=100, null=True, description="核销人姓名")

    notes = fields.TextField(null=True, description="核销备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    
    created_at = fields.DatetimeField(auto_now_add=True, description="审核时间")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    def __str__(self):
        return f"Settlement: {self.settlement_code} ({self.amount})"
