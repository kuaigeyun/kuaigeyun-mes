"""好力GO — 模具主数据（独立表，与 kuaizhizao 模具无关）。"""

from decimal import Decimal

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMold(HaoligoTenantModel):
    """模具资料：编码、名称、状态、总制造数量等。"""

    class Meta:
        table = "haoligo_mold"
        table_description = "好力GO - 模具主数据"
        unique_together = [("tenant_id", "mold_code")]
        indexes = [("tenant_id",), ("mold_code",), ("status",)]

    mold_code = fields.CharField(max_length=64, description="模具编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="模具名称")
    status = fields.CharField(
        max_length=32,
        default="待用",
        description="状态：在用/在修/停用/待用/报废",
    )
    total_manufacture_qty = fields.DecimalField(
        max_digits=18,
        decimal_places=0,
        default=Decimal("0"),
        description="总制造数量（累计）",
    )
    outsource_vendor_code = fields.CharField(max_length=64, null=True, description="外协厂商代号")
    outsource_vendor_name = fields.CharField(max_length=200, null=True, description="外协厂商名称")
    erp_material_code = fields.CharField(max_length=64, null=True, description="ERP 物料编码（同步引用）")
    remark = fields.TextField(null=True, description="备注")
