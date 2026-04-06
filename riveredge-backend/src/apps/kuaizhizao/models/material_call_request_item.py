"""
叫料单明细模型：一张叫料单可含多行物料需求。
"""

from tortoise import fields
from core.models.base import BaseModel


class MaterialCallRequestItem(BaseModel):
    """
    叫料单明细

    与 MaterialCallRequest（单头）一对多；数量以明细为准，单头 requested/delivered 为汇总。
    """

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    request_id = fields.IntField(description="叫料单头ID")
    line_no = fields.IntField(default=1, description="行号")

    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_unit = fields.CharField(max_length=20, null=True, description="单位")

    requested_quantity = fields.DecimalField(max_digits=12, decimal_places=4, description="需求数量")
    delivered_quantity = fields.DecimalField(
        max_digits=12, decimal_places=4, default=0, description="已送达数量"
    )

    class Meta:
        table = "apps_kuaizhizao_material_call_request_items"
        table_description = "快格轻制造 - 叫料单明细"
        indexes = [
            ("tenant_id", "request_id"),
            ("tenant_id", "material_id"),
        ]
