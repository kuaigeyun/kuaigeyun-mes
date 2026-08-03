"""
设备运营扩展模型：点检/巡检/保养主数据与业务单据。

Author: RiverEdge
Date: 2026-06-29
"""

from tortoise import fields
from core.models.base import BaseModel


class EquipmentInspectionItem(BaseModel):
    """点检项"""

    class Meta:
        table = "apps_kuaizhizao_equipment_inspection_items"
        table_description = "快格轻制造 - 点检项"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64, description="点检项编码")
    name = fields.CharField(max_length=200, description="点检项名称")
    requirement = fields.TextField(null=True, description="点检要求")
    value_type = fields.CharField(max_length=32, default="boolean", description="取值类型")
    unit = fields.CharField(max_length=32, null=True, description="单位")
    numeric_min = fields.DecimalField(max_digits=20, decimal_places=6, null=True)
    numeric_max = fields.DecimalField(max_digits=20, decimal_places=6, null=True)
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class EquipmentInspectionScheme(BaseModel):
    """点检方案"""

    class Meta:
        table = "apps_kuaizhizao_equipment_inspection_schemes"
        table_description = "快格轻制造 - 点检方案"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64, description="方案编码")
    name = fields.CharField(max_length=200, description="方案名称")
    description = fields.TextField(null=True)
    # 每班 / 每天 / 每周 / 每月 / 每季度
    cycle_type = fields.CharField(max_length=32, null=True, description="点检周期")
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class EquipmentInspectionSchemeLine(BaseModel):
    """点检方案行"""

    class Meta:
        table = "apps_kuaizhizao_equipment_inspection_scheme_lines"
        table_description = "快格轻制造 - 点检方案行"
        indexes = [("tenant_id",), ("scheme_id",)]

    id = fields.IntField(pk=True)
    scheme_id = fields.IntField(description="方案ID")
    item_id = fields.IntField(description="点检项ID")
    sort_order = fields.IntField(default=0)
    item_code = fields.CharField(max_length=64, null=True)
    item_name = fields.CharField(max_length=200, null=True)
    requirement = fields.TextField(null=True)
    value_type = fields.CharField(max_length=32, null=True)
    unit = fields.CharField(max_length=32, null=True)
    numeric_min = fields.DecimalField(max_digits=20, decimal_places=6, null=True)
    numeric_max = fields.DecimalField(max_digits=20, decimal_places=6, null=True)
    is_critical = fields.BooleanField(default=False, description="是否关键项（不合格即停用）")
    deleted_at = fields.DatetimeField(null=True)


class EquipmentSchemeBinding(BaseModel):
    """设备与方案绑定"""

    class Meta:
        table = "apps_kuaizhizao_equipment_scheme_bindings"
        table_description = "快格轻制造 - 设备方案绑定"
        indexes = [("tenant_id",), ("equipment_id",), ("scheme_type",)]

    id = fields.IntField(pk=True)
    equipment_id = fields.IntField(description="设备ID")
    equipment_uuid = fields.CharField(max_length=36)
    scheme_id = fields.IntField(description="方案ID")
    scheme_type = fields.CharField(max_length=32, default="spot_check", description="spot_check/maintenance")
    deleted_at = fields.DatetimeField(null=True)


class EquipmentPatrolRoute(BaseModel):
    """巡检路线"""

    class Meta:
        table = "apps_kuaizhizao_equipment_patrol_routes"
        table_description = "快格轻制造 - 巡检路线"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64)
    name = fields.CharField(max_length=200)
    workshop_id = fields.IntField(null=True)
    workshop_name = fields.CharField(max_length=200, null=True)
    description = fields.TextField(null=True)
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class EquipmentPatrolRouteStep(BaseModel):
    """巡检路线步骤"""

    class Meta:
        table = "apps_kuaizhizao_equipment_patrol_route_steps"
        table_description = "快格轻制造 - 巡检路线步骤"
        indexes = [("tenant_id",), ("route_id",)]

    id = fields.IntField(pk=True)
    route_id = fields.IntField()
    sort_order = fields.IntField(default=0)
    equipment_id = fields.IntField()
    equipment_uuid = fields.CharField(max_length=36)
    equipment_code = fields.CharField(max_length=50, null=True)
    equipment_name = fields.CharField(max_length=200, null=True)
    scheme_id = fields.IntField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class EquipmentMaintenanceItem(BaseModel):
    """保养项"""

    class Meta:
        table = "apps_kuaizhizao_equipment_maintenance_items"
        table_description = "快格轻制造 - 保养项"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64)
    name = fields.CharField(max_length=200)
    requirement = fields.TextField(null=True)
    standard_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class EquipmentMaintenanceScheme(BaseModel):
    """保养方案"""

    class Meta:
        table = "apps_kuaizhizao_equipment_maintenance_schemes"
        table_description = "快格轻制造 - 保养方案"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64)
    name = fields.CharField(max_length=200)
    description = fields.TextField(null=True)
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class EquipmentMaintenanceSchemeLine(BaseModel):
    """保养方案行"""

    class Meta:
        table = "apps_kuaizhizao_equipment_maintenance_scheme_lines"
        table_description = "快格轻制造 - 保养方案行"
        indexes = [("tenant_id",), ("scheme_id",)]

    id = fields.IntField(pk=True)
    scheme_id = fields.IntField()
    item_id = fields.IntField()
    sort_order = fields.IntField(default=0)
    item_code = fields.CharField(max_length=64, null=True)
    item_name = fields.CharField(max_length=200, null=True)
    requirement = fields.TextField(null=True)
    standard_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    deleted_at = fields.DatetimeField(null=True)


class EquipmentSpotCheck(BaseModel):
    """设备点检单"""

    class Meta:
        table = "apps_kuaizhizao_equipment_spot_checks"
        table_description = "快格轻制造 - 设备点检单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("equipment_id",), ("status",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    equipment_id = fields.IntField()
    equipment_uuid = fields.CharField(max_length=36)
    equipment_code = fields.CharField(max_length=50, null=True)
    equipment_name = fields.CharField(max_length=200, null=True)
    scheme_id = fields.IntField(null=True)
    check_date = fields.DateField()
    inspector_id = fields.IntField(null=True)
    inspector_name = fields.CharField(max_length=100, null=True)
    status = fields.CharField(max_length=32, default="已完成")
    has_abnormality = fields.BooleanField(default=False)
    abnormality_description = fields.TextField(null=True)
    fault_report_uuid = fields.CharField(max_length=36, null=True)
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class EquipmentSpotCheckLine(BaseModel):
    """设备点检单行"""

    class Meta:
        table = "apps_kuaizhizao_equipment_spot_check_lines"
        table_description = "快格轻制造 - 设备点检单行"
        indexes = [("tenant_id",), ("spot_check_id",)]

    id = fields.IntField(pk=True)
    spot_check_id = fields.IntField()
    line_no = fields.IntField(default=1)
    item_id = fields.IntField(null=True)
    item_code = fields.CharField(max_length=64, null=True)
    item_name = fields.CharField(max_length=200, null=True)
    requirement = fields.TextField(null=True)
    value_type = fields.CharField(max_length=32, null=True)
    unit = fields.CharField(max_length=32, null=True)
    measured_value = fields.TextField(null=True)
    is_pass = fields.BooleanField(default=True)
    remark = fields.TextField(null=True)
    attachments = fields.JSONField(null=True, description="行级附件（问题/对比照片）")
    deleted_at = fields.DatetimeField(null=True)


class EquipmentRoutePatrol(BaseModel):
    """设备巡检单"""

    class Meta:
        table = "apps_kuaizhizao_equipment_route_patrols"
        table_description = "快格轻制造 - 设备巡检单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("route_id",), ("status",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    route_id = fields.IntField()
    route_code = fields.CharField(max_length=64, null=True)
    route_name = fields.CharField(max_length=200, null=True)
    patrol_date = fields.DateField()
    inspector_id = fields.IntField(null=True)
    inspector_name = fields.CharField(max_length=100, null=True)
    status = fields.CharField(max_length=32, default="已完成")
    has_abnormality = fields.BooleanField(default=False)
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class EquipmentRoutePatrolLine(BaseModel):
    """设备巡检单行"""

    class Meta:
        table = "apps_kuaizhizao_equipment_route_patrol_lines"
        table_description = "快格轻制造 - 设备巡检单行"
        indexes = [("tenant_id",), ("route_patrol_id",)]

    id = fields.IntField(pk=True)
    route_patrol_id = fields.IntField()
    step_no = fields.IntField(default=1)
    equipment_id = fields.IntField()
    equipment_uuid = fields.CharField(max_length=36)
    equipment_code = fields.CharField(max_length=50, null=True)
    equipment_name = fields.CharField(max_length=200, null=True)
    item_id = fields.IntField(null=True)
    item_code = fields.CharField(max_length=64, null=True)
    item_name = fields.CharField(max_length=200, null=True)
    measured_value = fields.TextField(null=True)
    is_pass = fields.BooleanField(default=True)
    fault_report_uuid = fields.CharField(max_length=36, null=True)
    remark = fields.TextField(null=True)
    attachments = fields.JSONField(null=True, description="行级附件（问题/对比照片）")
    deleted_at = fields.DatetimeField(null=True)


class EquipmentScrapApplication(BaseModel):
    """设备报废申请"""

    class Meta:
        table = "apps_kuaizhizao_equipment_scrap_applications"
        table_description = "快格轻制造 - 设备报废申请"
        unique_together = [("tenant_id", "application_no")]
        indexes = [("tenant_id",), ("equipment_id",), ("status",)]

    id = fields.IntField(pk=True)
    application_no = fields.CharField(max_length=64)
    equipment_id = fields.IntField()
    equipment_uuid = fields.CharField(max_length=36)
    equipment_code = fields.CharField(max_length=50, null=True)
    equipment_name = fields.CharField(max_length=200, null=True)
    reason = fields.TextField()
    scrap_date = fields.DateField(null=True)
    applicant_id = fields.IntField(null=True)
    applicant_name = fields.CharField(max_length=100, null=True)
    status = fields.CharField(max_length=32, default="草稿")
    approver_id = fields.IntField(null=True)
    approver_name = fields.CharField(max_length=100, null=True)
    approved_at = fields.DatetimeField(null=True)
    reject_reason = fields.TextField(null=True)
    attachments = fields.JSONField(null=True)
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class EquipmentTransferApplication(BaseModel):
    """设备调拨单"""

    class Meta:
        table = "apps_kuaizhizao_equipment_transfer_applications"
        table_description = "快格轻制造 - 设备调拨单"
        unique_together = [("tenant_id", "application_no")]
        indexes = [("tenant_id",), ("equipment_id",), ("status",)]

    id = fields.IntField(pk=True)
    application_no = fields.CharField(max_length=64)
    equipment_id = fields.IntField()
    equipment_uuid = fields.CharField(max_length=36)
    equipment_code = fields.CharField(max_length=50, null=True)
    equipment_name = fields.CharField(max_length=200, null=True)
    from_workshop_id = fields.IntField(null=True)
    from_workshop_name = fields.CharField(max_length=200, null=True)
    from_workstation_id = fields.IntField(null=True)
    from_workstation_name = fields.CharField(max_length=200, null=True)
    to_workshop_id = fields.IntField(null=True)
    to_workshop_name = fields.CharField(max_length=200, null=True)
    to_workstation_id = fields.IntField(null=True)
    to_workstation_name = fields.CharField(max_length=200, null=True)
    to_status = fields.CharField(max_length=50, null=True, description="调拨后设备状态")
    reason = fields.TextField()
    transfer_date = fields.DateField(null=True)
    applicant_id = fields.IntField(null=True)
    applicant_name = fields.CharField(max_length=100, null=True)
    status = fields.CharField(max_length=32, default="草稿")
    approver_id = fields.IntField(null=True)
    approver_name = fields.CharField(max_length=100, null=True)
    approved_at = fields.DatetimeField(null=True)
    reject_reason = fields.TextField(null=True)
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)
