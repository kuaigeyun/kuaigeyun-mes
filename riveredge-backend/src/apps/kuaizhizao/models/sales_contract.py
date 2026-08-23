"""
销售合同模型

单次合同 / 框架合同，可来自报价单，下推销售订单（含释放单）。

Author: RiverEdge Team
Date: 2026-05-30
"""

from tortoise import fields
from core.models.base import BaseModel
from apps.kuaizhizao.constants.price_type import DEFAULT_SALES_PRICE_TYPE


class SalesContract(BaseModel):
    """销售合同"""

    tenant_id = fields.IntField(description="租户ID")
    contract_code = fields.CharField(max_length=50, db_index=True, description="合同编码")

    contract_type = fields.CharField(
        max_length=20,
        default="single",
        description="合同类型：single 单次 / framework 框架",
    )
    party_type = fields.CharField(
        max_length=20,
        default="customer",
        description="往来类型：customer 客户（预留 supplier 采购对称）",
    )

    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")
    customer_contact = fields.CharField(max_length=100, null=True, description="客户联系人")
    customer_phone = fields.CharField(max_length=20, null=True, description="客户电话")

    contract_date = fields.DateField(description="签订日期")
    valid_from = fields.DateField(null=True, description="生效日期")
    valid_to = fields.DateField(null=True, description="终止日期")

    total_quantity = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="合同总数量")
    total_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="合同总金额")
    discount_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="整单优惠金额")
    released_quantity = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="已释放数量")
    released_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="已释放金额")

    price_type = fields.CharField(
        max_length=20,
        default=DEFAULT_SALES_PRICE_TYPE,
        description="价格类型：tax_inclusive / tax_exclusive",
    )
    currency_code = fields.CharField(max_length=20, null=True, default="CNY", description="币种")

    status = fields.CharField(max_length=20, default="草稿", description="合同状态")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_remarks = fields.TextField(null=True, description="审核备注")

    salesman_id = fields.IntField(null=True, description="销售员ID")
    salesman_name = fields.CharField(max_length=100, null=True, description="销售员姓名")

    shipping_address = fields.TextField(null=True, description="收货地址")
    shipping_method = fields.CharField(max_length=50, null=True, description="发货方式")
    payment_terms = fields.CharField(max_length=100, null=True, description="付款条件")

    quotation_id = fields.IntField(null=True, description="来源报价单ID")
    quotation_code = fields.CharField(max_length=120, null=True, description="来源报价单编码")

    root_contract_id = fields.IntField(null=True, description="根合同ID（变更链）")
    version_no = fields.IntField(default=1, description="版本号")
    previous_contract_id = fields.IntField(null=True, description="上一版本合同ID")

    notes = fields.TextField(null=True, description="备注")
    term_group_id = fields.IntField(null=True, description="条款组ID")
    term_group_name = fields.CharField(max_length=200, null=True, description="条款组名称（快照）")
    contract_terms = fields.JSONField(null=True, description="合同条款快照")
    attachments = fields.JSONField(null=True, description="附件列表")

    is_active = fields.BooleanField(default=True, description="是否有效")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_sales_contracts"
        table_description = "快格轻制造 - 销售合同"
        indexes = [
            ("tenant_id", "customer_id"),
            ("tenant_id", "status"),
            ("tenant_id", "contract_type"),
            ("contract_date",),
            ("valid_to",),
            ("quotation_id",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
