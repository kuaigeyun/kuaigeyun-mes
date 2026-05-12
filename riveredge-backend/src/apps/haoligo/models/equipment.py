"""
好力GO — 设备场景（独立表，不复用 kuaizhizao equipment）。

车间 / 类别 / 制造商 / 点检参数与参数集 / 设备台账 / 巡检路线。
"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoWorkshop(HaoligoTenantModel):
    """车间（代号 + 名称，好力侧自建）。"""

    class Meta:
        table = "haoligo_workshop"
        table_description = "好力GO - 车间"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    code = fields.CharField(max_length=64, description="车间代号")
    name = fields.CharField(max_length=200, description="车间名称")


class HaoligoManufacturer(HaoligoTenantModel):
    """制造商。"""

    class Meta:
        table = "haoligo_manufacturer"
        table_description = "好力GO - 制造商"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    code = fields.CharField(max_length=64, description="制造商代号")
    name = fields.CharField(max_length=200, description="制造商名称")


class HaoligoInspectionParamSet(HaoligoTenantModel):
    """点检参数集。"""

    class Meta:
        table = "haoligo_inspection_param_set"
        table_description = "好力GO - 点检参数集"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    code = fields.CharField(max_length=64, description="参数集编码")
    name = fields.CharField(max_length=200, description="参数集名称")


class HaoligoInspectionParam(HaoligoTenantModel):
    """点检参数项。"""

    class Meta:
        table = "haoligo_inspection_param"
        table_description = "好力GO - 点检参数"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    code = fields.CharField(max_length=64, description="参数编码")
    name = fields.CharField(max_length=200, description="参数名称")
    unit = fields.CharField(max_length=32, null=True, description="单位")
    value_type = fields.CharField(max_length=32, default="numeric", description="取值类型：numeric/text/boolean")


class HaoligoInspectionParamSetItem(HaoligoTenantModel):
    """参数集明细（参数 + 顺序）。"""

    class Meta:
        table = "haoligo_inspection_param_set_item"
        table_description = "好力GO - 点检参数集明细"
        unique_together = [("set", "param")]
        indexes = [("tenant_id",), ("set_id",)]

    set = fields.ForeignKeyField(
        "models.HaoligoInspectionParamSet",
        related_name="items",
        on_delete=fields.CASCADE,
        description="所属参数集",
    )
    param = fields.ForeignKeyField(
        "models.HaoligoInspectionParam",
        related_name="set_items",
        on_delete=fields.CASCADE,
        description="点检参数",
    )
    sort_order = fields.IntField(default=0, description="排序")
    is_required = fields.BooleanField(default=True, description="是否必检")


class HaoligoEquipmentCategory(HaoligoTenantModel):
    """设备类别；可绑定默认点检参数集。"""

    class Meta:
        table = "haoligo_equipment_category"
        table_description = "好力GO - 设备类别"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    code = fields.CharField(max_length=64, description="类别编码")
    name = fields.CharField(max_length=200, description="类别名称")
    default_inspection_param_set = fields.ForeignKeyField(
        "models.HaoligoInspectionParamSet",
        related_name="categories_default",
        null=True,
        on_delete=fields.SET_NULL,
        description="默认点检参数集",
    )


class HaoligoEquipment(HaoligoTenantModel):
    """设备台账（代号、名称、类别、车间、制造商、出厂日期、点检参数集）。"""

    class Meta:
        table = "haoligo_equipment"
        table_description = "好力GO - 设备台账"
        unique_together = [("tenant_id", "asset_code")]
        indexes = [("tenant_id",), ("asset_code",), ("category_id",), ("workshop_id",)]

    asset_code = fields.CharField(max_length=64, description="设备代号")
    name = fields.CharField(max_length=200, description="设备名称")
    category = fields.ForeignKeyField(
        "models.HaoligoEquipmentCategory",
        related_name="equipments",
        on_delete=fields.RESTRICT,
        description="设备类别",
    )
    workshop = fields.ForeignKeyField(
        "models.HaoligoWorkshop",
        related_name="equipments",
        on_delete=fields.RESTRICT,
        description="所属车间",
    )
    manufacturer = fields.ForeignKeyField(
        "models.HaoligoManufacturer",
        related_name="equipments",
        null=True,
        on_delete=fields.SET_NULL,
        description="制造商",
    )
    manufacture_date = fields.DateField(null=True, description="出厂日期")
    inspection_param_set = fields.ForeignKeyField(
        "models.HaoligoInspectionParamSet",
        related_name="equipments",
        null=True,
        on_delete=fields.SET_NULL,
        description="点检参数集（为空时可按类别默认解析）",
    )
    remark = fields.TextField(null=True, description="备注")


class HaoligoPatrolRoute(HaoligoTenantModel):
    """设备巡检路线（电脑端配置）。"""

    class Meta:
        table = "haoligo_patrol_route"
        table_description = "好力GO - 设备巡检路线"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("workshop_id",)]

    code = fields.CharField(max_length=64, description="路线编码")
    name = fields.CharField(max_length=200, description="路线名称")
    workshop = fields.ForeignKeyField(
        "models.HaoligoWorkshop",
        related_name="patrol_routes",
        null=True,
        on_delete=fields.SET_NULL,
        description="关联车间（可选）",
    )


class HaoligoPatrolRouteStep(HaoligoTenantModel):
    """路线上的设备顺序。"""

    class Meta:
        table = "haoligo_patrol_route_step"
        table_description = "好力GO - 巡检路线步骤"
        unique_together = [("route", "equipment")]
        indexes = [("tenant_id",), ("route_id",)]

    route = fields.ForeignKeyField(
        "models.HaoligoPatrolRoute",
        related_name="steps",
        on_delete=fields.CASCADE,
        description="路线",
    )
    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name="patrol_steps",
        on_delete=fields.CASCADE,
        description="设备",
    )
    sequence = fields.IntField(default=0, description="顺序号")
