"""
订单评审单模型

接单前多部门（技术/工艺/采购/生产/质量）可行性评审，通过后可下推销售订单。
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesReview(BaseModel):
    """订单评审单头"""

    tenant_id = fields.IntField(description="租户ID")
    review_code = fields.CharField(max_length=120, db_index=True, description="评审单编码")

    customer_id = fields.IntField(description="客户ID")
    customer_code = fields.CharField(max_length=50, null=True, description="客户编码")
    customer_name = fields.CharField(max_length=200, description="客户名称")
    customer_contact = fields.CharField(max_length=100, null=True, description="联系人")
    customer_phone = fields.CharField(max_length=50, null=True, description="联系电话")

    project_name = fields.CharField(max_length=200, description="项目名称")
    review_date = fields.DateField(null=True, description="评审日期")
    delivery_date = fields.DateField(null=True, description="交付日期")
    urgency = fields.CharField(max_length=20, default="normal", description="紧急程度 normal/urgent")
    risk_level = fields.CharField(max_length=20, default="medium", description="风险等级 low/medium/high")
    settlement_method = fields.CharField(max_length=100, null=True, description="结算方式")
    payment_cycle = fields.CharField(max_length=100, null=True, description="付款周期")
    delivery_location = fields.CharField(max_length=200, null=True, description="送货地点")
    transport_method = fields.CharField(max_length=100, null=True, description="运输方式")

    material_desc = fields.TextField(null=True, description="材质要求")
    spec_desc = fields.TextField(null=True, description="规格要求")
    process_desc = fields.TextField(null=True, description="工艺说明")
    packaging_req = fields.TextField(null=True, description="包装要求")
    production_notes = fields.TextField(null=True, description="生产过程备注")

    # draft / reviewing / rejected / passed / closed / cancelled
    status = fields.CharField(max_length=20, default="draft", description="状态")
    review_round = fields.IntField(default=0, description="下达轮次")

    sales_opinion = fields.TextField(null=True, description="销售意见")
    final_conclusion = fields.TextField(null=True, description="最终结论")
    remarks = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件列表")

    quotation_id = fields.IntField(null=True, description="关联报价单ID")
    quotation_code = fields.CharField(max_length=120, null=True, description="关联报价单编码")
    customer_follow_up_id = fields.IntField(null=True, description="关联客户跟进ID")
    sales_order_id = fields.IntField(null=True, description="下推销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="下推销售订单编码")

    salesman_id = fields.IntField(null=True, description="业务员ID")
    salesman_name = fields.CharField(max_length=100, null=True, description="业务员姓名")

    total_quantity = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="明细总数量")
    total_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="明细总金额")

    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_sales_reviews"
        table_description = "快格轻制造 - 订单评审单"
        indexes = [
            ("tenant_id",),
            ("review_code",),
            ("customer_id",),
            ("status",),
            ("sales_order_id",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
