"""好力 GO — 设备保养项与保养方案。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoEquipmentUpkeepParamSet(HaoligoTenantModel):
    """设备保养方案。"""

    class Meta:
        table = "haoligo_equipment_upkeep_param_set"
        table_description = "好力GO - 设备保养方案"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    code = fields.CharField(max_length=64, description="方案编码")
    name = fields.CharField(max_length=200, description="方案名称")


class HaoligoEquipmentUpkeepParam(HaoligoTenantModel):
    """设备保养项。"""

    class Meta:
        table = "haoligo_equipment_upkeep_param"
        table_description = "好力GO - 设备保养项"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    code = fields.CharField(max_length=64, description="保养项编号")
    name = fields.CharField(max_length=200, description="保养项名称")
    requirement = fields.TextField(null=True, description="保养要求/作业说明")
    value_type = fields.CharField(
        max_length=32,
        default="text",
        description="取值类型：text 文本 / multiselect 多选",
    )
    default_value = fields.TextField(
        null=True,
        description="多选时为候选项（逗号分隔）；文本型可存默认提示（可选）",
    )


class HaoligoEquipmentUpkeepParamSetItem(HaoligoTenantModel):
    """设备保养方案明细。"""

    class Meta:
        table = "haoligo_equipment_upkeep_param_set_item"
        table_description = "好力GO - 设备保养方案明细"
        unique_together = [("set", "param")]
        indexes = [("tenant_id",), ("set_id",)]

    set = fields.ForeignKeyField(
        "models.HaoligoEquipmentUpkeepParamSet",
        related_name="items",
        on_delete=fields.CASCADE,
        description="所属保养方案",
    )
    param = fields.ForeignKeyField(
        "models.HaoligoEquipmentUpkeepParam",
        related_name="set_items",
        on_delete=fields.CASCADE,
        description="保养项",
    )
    sort_order = fields.IntField(default=0, description="排序")
    is_required = fields.BooleanField(default=True, description="是否必填")
