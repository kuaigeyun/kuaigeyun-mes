"""订单评审单明细"""

from tortoise import fields
from core.models.base import BaseModel


class SalesReviewItem(BaseModel):
    """订单评审明细行"""

    tenant_id = fields.IntField(description="租户ID")
    sales_review_id = fields.IntField(description="订单评审单ID")
    line_no = fields.IntField(default=1, description="行号")

    material_id = fields.IntField(null=True, description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="规格")
    material_unit = fields.CharField(max_length=20, null=True, description="单位")

    quantity = fields.DecimalField(max_digits=14, decimal_places=4, description="数量")
    unit_price = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="单价")
    amount = fields.DecimalField(max_digits=14, decimal_places=2, default=0, description="金额")
    tech_requirements = fields.TextField(null=True, description="技术要求")
    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_sales_review_items"
        table_description = "快格轻制造 - 订单评审明细"
        indexes = [
            ("tenant_id", "sales_review_id"),
        ]
