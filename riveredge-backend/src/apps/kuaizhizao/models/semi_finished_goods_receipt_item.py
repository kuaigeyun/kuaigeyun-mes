"""半成品入库单明细模型。"""

from tortoise import fields
from core.models.base import BaseModel


class SemiFinishedGoodsReceiptItem(BaseModel):
    """半成品入库单明细"""

    tenant_id = fields.IntField(description="租户ID")
    receipt_id = fields.IntField(description="入库单ID")
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="物料规格")
    material_unit = fields.CharField(max_length=20, description="物料单位")

    receipt_quantity = fields.DecimalField(max_digits=12, decimal_places=4, description="入库数量")
    qualified_quantity = fields.DecimalField(max_digits=12, decimal_places=4, description="合格数量")
    unqualified_quantity = fields.DecimalField(max_digits=12, decimal_places=4, description="不合格数量")

    location_id = fields.IntField(null=True, description="库位ID")
    location_code = fields.CharField(max_length=50, null=True, description="库位编码")

    batch_number = fields.CharField(max_length=50, null=True, description="批次号")
    expiry_date = fields.DateField(null=True, description="到期日期")

    quality_status = fields.CharField(max_length=20, default="合格", description="质量状态")
    quality_inspection_id = fields.IntField(null=True, description="质量检验单ID")

    status = fields.CharField(max_length=20, default="待入库", description="入库状态")
    receipt_time = fields.DatetimeField(null=True, description="实际入库时间")

    notes = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_semi_finished_goods_receipt_items"
        table_description = "快格轻制造 - 半成品入库单明细"
        indexes = [
            ("tenant_id", "receipt_id"),
            ("material_id",),
            ("location_id",),
        ]
