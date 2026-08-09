"""
物料单位与全局换算关系模型。

单位目录为物料可用单位的唯一真源；全局换算供料级多单位自动填充分子分母。
"""

from tortoise import fields

from core.models.base import BaseModel


class MaterialUnit(BaseModel):
    """物料单位主数据。"""

    class Meta:
        table = "apps_master_data_units"
        table_description = "基础数据 - 物料单位"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("is_active",),
            ("sort_order",),
        ]
        unique_together = [("tenant_id", "code")]

    id = fields.IntField(pk=True, description="单位ID")
    code = fields.CharField(max_length=50, description="单位编码（与单据/物料上存的文本一致）")
    name = fields.CharField(max_length=100, description="单位名称")
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_system = fields.BooleanField(default=False, description="系统内置（不可删除）")
    sort_order = fields.IntField(default=0, description="排序")
    description = fields.CharField(max_length=500, null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="软删除时间")


class MaterialUnitConversion(BaseModel):
    """
    全局单位换算：1 from_unit = (numerator/denominator) × to_unit。
    例：千克→克 = 1000/1。
    """

    class Meta:
        table = "apps_master_data_unit_conversions"
        table_description = "基础数据 - 单位换算关系"
        indexes = [
            ("tenant_id",),
            ("from_unit_code",),
            ("to_unit_code",),
        ]
        unique_together = [("tenant_id", "from_unit_code", "to_unit_code")]

    id = fields.IntField(pk=True, description="换算ID")
    from_unit_code = fields.CharField(max_length=50, description="源单位编码")
    to_unit_code = fields.CharField(max_length=50, description="目标单位编码")
    numerator = fields.IntField(description="分子（正整数）")
    denominator = fields.IntField(description="分母（正整数）")
    is_system = fields.BooleanField(default=False, description="系统内置（不可删除）")
    is_active = fields.BooleanField(default=True, description="是否启用")
    description = fields.CharField(max_length=500, null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="软删除时间")
