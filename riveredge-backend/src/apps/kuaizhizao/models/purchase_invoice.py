"""
采购发票模型

提供采购发票数据模型定义。

Author: Luigi Lu
Date: 2025-12-30
"""

from tortoise import fields
from core.models.base import BaseModel


class PurchaseInvoice(BaseModel):
    """
    采购发票

    用于记录采购业务的发票信息，支持多张发票关联同一个采购订单
    """
    tenant_id = fields.IntField(description="租户ID")
    invoice_code = fields.CharField(max_length=50, unique=True, description="发票编码")

    # 关联采购订单
    purchase_order_id = fields.IntField(description="采购订单ID")
    purchase_order_code = fields.CharField(max_length=50, description="采购订单编码")

    # 供应商信息
    supplier_id = fields.IntField(description="供应商ID")
    supplier_name = fields.CharField(max_length=200, description="供应商名称")

    # 发票基本信息
    invoice_number = fields.CharField(max_length=100, description="发票号码")
    invoice_date = fields.DateField(description="发票日期")
    invoice_type = fields.CharField(max_length=20, description="发票类型")
    tax_rate = fields.DecimalField(max_digits=5, decimal_places=2, description="税率")

    # 金额信息
    invoice_amount = fields.DecimalField(max_digits=12, decimal_places=2, description="发票金额")
    tax_amount = fields.DecimalField(max_digits=12, decimal_places=2, description="税额")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, description="价税合计")

    # 状态
    status = fields.CharField(max_length=20, default="未审核", description="发票状态")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    # 关联应付单（可选）
    payable_id = fields.IntField(null=True, description="应付单ID")
    payable_code = fields.CharField(max_length=50, null=True, description="应付单编码")

    # 附件信息
    attachment_path = fields.CharField(max_length=500, null=True, description="附件路径")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_purchase_invoices"
        table_description = "快格轻制造 - 采购发票"
        indexes = [
            ("tenant_id", "purchase_order_id"),
            ("tenant_id", "supplier_id"),
            ("invoice_number",),
            ("status",),
            ("payable_id",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
