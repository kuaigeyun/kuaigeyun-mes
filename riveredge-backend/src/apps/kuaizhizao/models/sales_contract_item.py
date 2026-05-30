"""
销售合同明细模型
"""

from tortoise import fields
from core.models.base import BaseModel


class SalesContractItem(BaseModel):
    """销售合同明细"""

    tenant_id = fields.IntField(description="租户ID")
    contract_id = fields.IntField(description="合同ID")

    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    contract_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="合同数量")
    released_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="已释放数量")
    unit_price = fields.DecimalField(max_digits=12, decimal_places=2, description="单价")
    tax_rate = fields.DecimalField(max_digits=6, decimal_places=2, default=0, description="税率（%）")
    total_amount = fields.DecimalField(max_digits=14, decimal_places=2, description="行金额")

    variant_attributes = fields.JSONField(null=True, description="属性组合")
    delivery_date = fields.DateField(null=True, description="交货日期")
    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_sales_contract_items"
        table_description = "快格轻制造 - 销售合同明细"
        indexes = [
            ("tenant_id", "contract_id"),
            ("material_id",),
        ]
