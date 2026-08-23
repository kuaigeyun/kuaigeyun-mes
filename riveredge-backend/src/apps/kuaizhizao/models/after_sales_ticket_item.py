"""
售后服务工单明细
"""

from tortoise import fields
from core.models.base import BaseModel


class AfterSalesTicketItem(BaseModel):
    """售后服务工单明细行"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    ticket_id = fields.IntField(description="售后服务工单ID")

    material_id = fields.IntField(null=True, description="物料ID")
    material_code = fields.CharField(max_length=100, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="规格")
    material_unit = fields.CharField(max_length=20, null=True, description="单位")

    sales_order_item_id = fields.IntField(null=True, description="来源销售订单明细ID")
    sales_delivery_item_id = fields.IntField(null=True, description="来源销售出库明细ID")

    batch_no = fields.CharField(max_length=100, null=True, description="批次号")
    quantity = fields.DecimalField(max_digits=14, decimal_places=4, null=True, description="数量")
    claim_amount = fields.DecimalField(max_digits=16, decimal_places=4, null=True, description="行索赔金额")
    notes = fields.TextField(null=True, description="行备注")
    line_no = fields.IntField(default=1, description="行号")

    class Meta:
        table = "apps_kuaizhizao_after_sales_ticket_items"
        table_description = "快格轻制造 - 售后服务工单明细"
        indexes = [
            ("tenant_id", "ticket_id"),
            ("material_id",),
            ("sales_order_item_id",),
            ("sales_delivery_item_id",),
        ]
