"""好力 GO — 设备维保单 / 设备维保完成单（维修+保养，与模具厂内维保两段式对齐；一单一台设备）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoEquipmentUpkeepSheet(HaoligoTenantModel):
    """设备维保单：申请部门、维保前附件、单台设备、维修原因/保养要求。"""

    class Meta:
        table = "haoligo_equipment_upkeep_sheet"
        table_description = "好力GO - 设备维保单"
        indexes = [("tenant_id",), ("equipment_id",), ("sheet_no",), ("department_uuid",), ("service_type",)]

    sheet_no = fields.CharField(max_length=64, null=True, description="维保单单号（编码规则生成）")
    service_type = fields.CharField(max_length=16, default="保养", description="维修/保养")
    applicant_user_id = fields.IntField(null=True, description="申请人用户 ID")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人显示名")
    department_uuid = fields.CharField(max_length=36, null=True, description="申请部门 UUID")
    department_name = fields.CharField(max_length=200, null=True, description="申请部门名称")
    header_attachment_file_uuids = fields.JSONField(
        null=True,
        description="维保前附件（文件 UUID 列表）",
    )
    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name="upkeep_sheets",
        on_delete=fields.RESTRICT,
        description="设备",
    )
    description = fields.TextField(null=True, description="维修原因/保养要求（可选）")
    reporter_user_id = fields.IntField(description="填报人用户 ID")


class HaoligoEquipmentUpkeepCompleteSheet(HaoligoTenantModel):
    """设备维保完成单：关联维保单、维保后附件、保养内容或维修完修信息。"""

    class Meta:
        table = "haoligo_equipment_upkeep_complete_sheet"
        table_description = "好力GO - 设备维保完成单"
        indexes = [("tenant_id",), ("source_upkeep_sheet_id",), ("sheet_no",), ("source_order_no",), ("service_type",)]

    sheet_no = fields.CharField(max_length=64, null=True, description="维保完成单单号")
    service_type = fields.CharField(max_length=16, default="保养", description="维修/保养（与来源维保单一致）")
    source_upkeep_sheet = fields.ForeignKeyField(
        "models.HaoligoEquipmentUpkeepSheet",
        related_name="complete_sheets",
        null=True,
        on_delete=fields.SET_NULL,
        description="关联设备维保单",
    )
    source_order_no = fields.CharField(max_length=128, description="来源单号（展示/检索）")
    applicant_user_id = fields.IntField(null=True, description="申请人用户 ID")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人显示名")
    department_uuid = fields.CharField(max_length=36, null=True, description="申请部门 UUID")
    department_name = fields.CharField(max_length=200, null=True, description="申请部门名称")
    header_attachment_file_uuids = fields.JSONField(
        null=True,
        description="维保后附件（文件 UUID 列表）",
    )
    completion_content = fields.TextField(null=True, description="保养完修内容")
    repair_content = fields.TextField(null=True, description="维修完修内容")
    repair_result = fields.CharField(max_length=32, null=True, description="维修完修结果")
    clear_total_production = fields.BooleanField(default=False, description="保养完修是否清空累计产量")
    reporter_user_id = fields.IntField(description="填报人用户 ID")
