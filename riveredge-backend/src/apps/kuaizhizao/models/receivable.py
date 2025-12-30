"""
应收单模型

提供应收单数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class Receivable(BaseModel):
    """
    应收单

    用于记录企业销售货物或服务后产生的应收账款
    """
    tenant_id = fields.IntField(description="租户ID")
    receivable_code = fields.CharField(max_length=50, unique=True, description="应收单编码")

    # 来源单据关联
    source_type = fields.CharField(max_length=20, description="来源单据类型")
    source_id = fields.IntField(description="来源单据ID")
    source_code = fields.CharField(max_length=50, description="来源单据编码")

    # 客户信息
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")

    # 应收金额
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, description="应收总金额")
    received_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="已收金额")
    remaining_amount = fields.DecimalField(max_digits=12, decimal_places=2, description="剩余金额")

    # 账期信息
    due_date = fields.DateField(description="到期日期")
    payment_terms = fields.CharField(max_length=100, null=True, description="收款条件")

    # 状态
    status = fields.CharField(max_length=20, default="未收款", description="收款状态")

    # 业务信息
    business_date = fields.DateField(description="业务日期")
    invoice_issued = fields.BooleanField(default=False, description="是否开具发票")
    invoice_number = fields.CharField(max_length=100, null=True, description="发票号")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_receivables"
        table_description = "快格轻制造 - 应收单"
        indexes = [
            ("tenant_id", "customer_id"),
            ("tenant_id", "source_id"),
            ("status",),
            ("due_date",),
            ("business_date",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
