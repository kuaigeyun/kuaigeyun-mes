"""
报价单模型

提供报价单数据模型定义，销售前报价，可转销售订单。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel
from apps.kuaizhizao.constants.price_type import DEFAULT_SALES_PRICE_TYPE


class Quotation(BaseModel):
    """
    报价单

    用于记录销售前报价信息，结构与销售订单类似，可转销售订单
    """
    tenant_id = fields.IntField(description="租户ID")
    # 租户内未删除行唯一，见迁移 partial unique index；勿再使用表级 UNIQUE
    quotation_code = fields.CharField(max_length=120, db_index=True, description="报价单编码（含修订后缀）")

    # 版本与系列（同一商务谈判多条版本共用 quotation_series_code）
    quotation_series_code = fields.CharField(max_length=120, db_index=True, description="报价系列编码")
    root_quotation_id = fields.IntField(null=True, description="系列根报价单 ID")
    version_no = fields.IntField(default=1, description="系列内版本号")
    previous_quotation_id = fields.IntField(null=True, description="上一版本报价单 ID")
    is_latest_in_series = fields.BooleanField(default=True, description="是否为系列最新版本")
    superseded_by_id = fields.IntField(null=True, description="被替代为的新版本 ID")
    formal_document_generated_at = fields.DatetimeField(null=True, description="首次正式报价 PDF 生成时间")

    # 客户信息
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")
    customer_contact = fields.CharField(max_length=100, null=True, description="客户联系人")
    customer_phone = fields.CharField(max_length=20, null=True, description="客户电话")

    # 报价基本信息
    quotation_date = fields.DateField(description="报价日期")
    valid_until = fields.DateField(null=True, description="有效期至")
    delivery_date = fields.DateField(null=True, description="预计交货日期")

    # 金额信息
    total_quantity = fields.DecimalField(max_digits=12, decimal_places=4, default=0, description="总数量")
    total_amount = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="总金额")
    discount_amount = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="整单优惠金额")
    price_type = fields.CharField(
        max_length=20,
        default=DEFAULT_SALES_PRICE_TYPE,
        description="价格类型：含税单价(tax_inclusive)/不含税单价(tax_exclusive)",
    )

    # 状态：草稿/已发送/已接受/已拒绝/已转订单
    status = fields.CharField(max_length=20, default="草稿", description="报价状态")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    # 销售信息
    salesman_id = fields.IntField(null=True, description="销售员ID")
    salesman_name = fields.CharField(max_length=100, null=True, description="销售员姓名")

    # 物流信息
    shipping_address = fields.TextField(null=True, description="收货地址")
    shipping_method = fields.CharField(max_length=50, null=True, description="发货方式")
    payment_terms = fields.CharField(max_length=100, null=True, description="付款条件")
    currency_code = fields.CharField(max_length=20, null=True, default="CNY", description="币种（如 CNY 人民币）")

    # 转订单后关联
    sales_order_id = fields.IntField(null=True, description="关联销售订单ID（转订单后）")
    sales_order_code = fields.CharField(max_length=50, null=True, description="关联销售订单编码")
    contract_id = fields.IntField(null=True, description="关联销售合同ID")
    contract_code = fields.CharField(max_length=50, null=True, description="关联销售合同编码")
    sales_review_id = fields.IntField(null=True, description="关联订单评审ID")
    sales_review_code = fields.CharField(max_length=120, null=True, description="关联订单评审编码")

    notes = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件列表")
    is_active = fields.BooleanField(default=True, description="是否有效")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_quotations"
        table_description = "快格轻制造 - 报价单"
        indexes = [
            ("tenant_id",),
            ("quotation_code",),
            ("tenant_id", "quotation_series_code"),
            ("customer_id",),
            ("status",),
            ("quotation_date",),
            ("sales_order_id",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
