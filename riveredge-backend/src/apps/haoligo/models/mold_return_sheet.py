"""好力GO — 模具还入单（对齐移动端：制令单、领用单、领出部门、模具与制造数量）。"""

from decimal import Decimal

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldReturnSheet(HaoligoTenantModel):
    """还入单：制令单、领用单引用、领出部门、模具/成品、本次制造数量。"""

    class Meta:
        table = "haoligo_mold_return_sheet"
        table_description = "好力GO - 模具还入单"
        indexes = [("tenant_id",), ("mold_code",), ("production_order_no",)]

    production_order_no = fields.CharField(max_length=128, null=True, description="制令单号")
    borrow_sheet_no = fields.CharField(max_length=128, null=True, description="领用单（号/引用）")
    issue_department_uuid = fields.CharField(max_length=36, null=True, description="领出部门 UUID")
    issue_department_name = fields.CharField(max_length=200, null=True, description="领出部门名称")
    mold_code = fields.CharField(max_length=64, description="模具代号")
    mold_name = fields.CharField(max_length=200, description="模具名称")
    finished_product_code = fields.CharField(max_length=128, null=True, description="成品代号")
    finished_product_name = fields.CharField(max_length=200, null=True, description="成品名称")
    manufacture_qty = fields.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0"),
        description="制造数量（还入）",
    )
