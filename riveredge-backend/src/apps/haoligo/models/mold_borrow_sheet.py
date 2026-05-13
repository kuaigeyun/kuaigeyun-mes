"""好力GO — 模具领用单。"""

from decimal import Decimal

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldBorrowSheet(HaoligoTenantModel):
    """领用单：来源制令、领用部门、模具与成品计划数量。"""

    class Meta:
        table = "haoligo_mold_borrow_sheet"
        table_description = "好力GO - 模具领用单"
        indexes = [("tenant_id",), ("mold_code",), ("source_order_no",)]

    source_order_no = fields.CharField(max_length=128, null=True, description="来源单号（制令单等）")
    department_uuid = fields.CharField(max_length=36, null=True, description="领用部门 UUID")
    department_name = fields.CharField(max_length=200, description="领用部门名称")
    mold_code = fields.CharField(max_length=64, description="模具代号")
    mold_name = fields.CharField(max_length=200, description="模具名称")
    finished_product_code = fields.CharField(max_length=128, null=True, description="成品代号")
    finished_product_name = fields.CharField(max_length=200, null=True, description="成品名称")
    planned_qty = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="计划数量")
