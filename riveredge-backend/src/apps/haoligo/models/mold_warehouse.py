"""好力 GO — 模具仓库。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldWarehouse(HaoligoTenantModel):
    """模具仓库（内部 / 外部；外部关联主数据供应商）。"""

    class Meta:
        table = "haoligo_mold_warehouse"
        table_description = "好力GO - 模具仓库"
        unique_together = [("tenant_id", "warehouse_code")]
        indexes = [("tenant_id",), ("warehouse_code",), ("warehouse_type",), ("workshop_id",)]

    warehouse_code = fields.CharField(max_length=64, description="仓库编号")
    warehouse_name = fields.CharField(max_length=200, description="仓库名称")
    warehouse_type = fields.CharField(max_length=16, description="仓库类型：内部/外部")
    workshop = fields.ForeignKeyField(
        "models.HaoligoWorkshop",
        related_name="mold_warehouses",
        null=True,
        on_delete=fields.RESTRICT,
        description="所属车间",
    )
    workshop_code = fields.CharField(max_length=64, null=True, description="车间代号（冗余）")
    workshop_name = fields.CharField(max_length=200, null=True, description="车间名称（冗余）")
    supplier_uuid = fields.CharField(max_length=36, null=True, description="外部仓库关联供应商 UUID")
    supplier_code = fields.CharField(max_length=64, null=True, description="供应商编码（冗余）")
    supplier_name = fields.CharField(max_length=200, null=True, description="供应商名称（冗余）")
