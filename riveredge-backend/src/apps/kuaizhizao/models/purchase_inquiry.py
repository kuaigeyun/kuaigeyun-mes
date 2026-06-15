"""
采购询价单模型

提供询价单、受邀供应商、供应商报价数据模型。

Author: RiverEdge Team
Date: 2026-05-28
"""

from tortoise import fields

from core.models.base import BaseModel
from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus
from apps.kuaizhizao.constants.purchase_inquiry import (
    PurchaseInquiryStatus,
    PurchaseInquiryVendorStatus,
    PurchaseSupplierQuoteStatus,
    PurchaseSupplierQuoteChannel,
)


class PurchaseInquiry(BaseModel):
    """采购询价单头"""

    tenant_id = fields.IntField(description="租户ID")
    inquiry_code = fields.CharField(max_length=50, db_index=True, description="询价单编码")

    inquiry_name = fields.CharField(max_length=200, null=True, description="询价单名称")
    inquiry_date = fields.DateField(null=True, description="询价日期")
    quote_deadline = fields.DateField(null=True, description="报价截止日期")
    status = fields.CharField(
        max_length=30,
        default=PurchaseInquiryStatus.DRAFT.value,
        description="状态",
    )

    buyer_id = fields.IntField(null=True, description="采购员ID")
    buyer_name = fields.CharField(max_length=100, null=True, description="采购员姓名")

    source_type = fields.CharField(max_length=50, null=True, description="来源类型")
    source_id = fields.IntField(null=True, description="来源ID")
    source_code = fields.CharField(max_length=50, null=True, description="来源编码")

    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default=ReviewStatus.PENDING.value, description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    total_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总数量")
    notes = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件列表")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_purchase_inquiries"
        table_description = "快格轻制造 - 采购询价单"
        indexes = [
            ("tenant_id",),
            ("inquiry_code",),
            ("status",),
            ("source_type", "source_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class PurchaseInquiryItem(BaseModel):
    """采购询价明细"""

    tenant_id = fields.IntField(description="租户ID")
    inquiry_id = fields.IntField(description="询价单ID")

    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    unit = fields.CharField(max_length=20, default="件", description="单位")
    quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="询价数量")
    required_date = fields.DateField(null=True, description="要求交期")

    source_requisition_item_id = fields.IntField(null=True, description="来源采购申请行ID")
    awarded_supplier_id = fields.IntField(null=True, description="定标供应商ID")
    awarded_quote_item_id = fields.IntField(null=True, description="定标报价行ID")
    purchase_order_id = fields.IntField(null=True, description="转单后采购订单ID")
    purchase_order_item_id = fields.IntField(null=True, description="转单后采购订单行ID")
    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_purchase_inquiry_items"
        table_description = "快格轻制造 - 采购询价明细"
        indexes = [
            ("tenant_id", "inquiry_id"),
            ("source_requisition_item_id",),
        ]


class PurchaseInquiryVendor(BaseModel):
    """询价单受邀供应商"""

    tenant_id = fields.IntField(description="租户ID")
    inquiry_id = fields.IntField(description="询价单ID")
    supplier_id = fields.IntField(description="供应商ID")
    supplier_name = fields.CharField(max_length=200, description="供应商名称")
    status = fields.CharField(
        max_length=30,
        default=PurchaseInquiryVendorStatus.INVITED.value,
        description="邀请状态",
    )
    portal_token = fields.CharField(max_length=64, null=True, description="供应商门户令牌（二期）")
    portal_expires_at = fields.DatetimeField(null=True, description="门户令牌过期时间")
    quoted_at = fields.DatetimeField(null=True, description="报价时间")
    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_purchase_inquiry_vendors"
        table_description = "快格轻制造 - 询价受邀供应商"
        unique_together = (("tenant_id", "inquiry_id", "supplier_id"),)
        indexes = [
            ("tenant_id", "inquiry_id"),
        ]


class PurchaseSupplierQuote(BaseModel):
    """供应商报价头"""

    tenant_id = fields.IntField(description="租户ID")
    inquiry_id = fields.IntField(description="询价单ID")
    supplier_id = fields.IntField(description="供应商ID")
    supplier_name = fields.CharField(max_length=200, description="供应商名称")
    quote_code = fields.CharField(max_length=50, null=True, description="报价单号")
    quote_date = fields.DateField(null=True, description="报价日期")
    valid_until = fields.DateField(null=True, description="报价有效期")
    status = fields.CharField(
        max_length=20,
        default=PurchaseSupplierQuoteStatus.DRAFT.value,
        description="报价状态",
    )
    submission_channel = fields.CharField(
        max_length=20,
        default=PurchaseSupplierQuoteChannel.INTERNAL.value,
        description="提交渠道 internal/portal",
    )
    entered_by = fields.IntField(null=True, description="录入人ID")
    total_amount = fields.DecimalField(max_digits=14, decimal_places=2, default=0, description="报价总金额")
    notes = fields.TextField(null=True, description="备注")
    created_by = fields.IntField(null=True)
    updated_by = fields.IntField(null=True)
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaizhizao_purchase_supplier_quotes"
        table_description = "快格轻制造 - 供应商报价"
        indexes = [
            ("tenant_id", "inquiry_id"),
            ("tenant_id", "supplier_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class PurchaseSupplierQuoteItem(BaseModel):
    """供应商报价行"""

    tenant_id = fields.IntField(description="租户ID")
    quote_id = fields.IntField(description="报价头ID")
    inquiry_item_id = fields.IntField(description="询价明细ID")
    quoted_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="报价数量")
    unit_price = fields.DecimalField(max_digits=12, decimal_places=4, default=0, description="报价单价")
    delivery_date = fields.DateField(null=True, description="承诺交期")
    lead_time_days = fields.IntField(null=True, description="交期天数")
    is_awarded = fields.BooleanField(default=False, description="是否中标")
    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_purchase_supplier_quote_items"
        table_description = "快格轻制造 - 供应商报价明细"
        indexes = [
            ("tenant_id", "quote_id"),
            ("inquiry_item_id",),
        ]
