"""好力 GO — 设备保养单 / 设备保养完成单（仅保养，与模具维保单+完修单两段式对齐）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoEquipmentUpkeepSheet(HaoligoTenantModel):
    """设备保养单：申请部门、保养前附件、单台设备、保养说明。"""

    class Meta:
        table = "haoligo_equipment_upkeep_sheet"
        table_description = "好力GO - 设备保养单"
        indexes = [("tenant_id",), ("equipment_id",), ("sheet_no",), ("department_uuid",)]

    sheet_no = fields.CharField(max_length=64, null=True, description="保养单单号（编码规则生成）")
    applicant_user_id = fields.IntField(null=True, description="申请人用户 ID")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人显示名")
    department_uuid = fields.CharField(max_length=36, null=True, description="申请部门 UUID")
    department_name = fields.CharField(max_length=200, null=True, description="申请部门名称")
    header_attachment_file_uuids = fields.JSONField(
        null=True,
        description="保养前附件（文件 UUID 列表）",
    )
    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name="upkeep_sheets",
        on_delete=fields.RESTRICT,
        description="设备",
    )
    description = fields.TextField(description="保养说明/计划")
    reporter_user_id = fields.IntField(description="填报人用户 ID")


class HaoligoEquipmentUpkeepCompleteSheet(HaoligoTenantModel):
    """设备保养完成单：关联保养单、保养后附件、完成说明。"""

    class Meta:
        table = "haoligo_equipment_upkeep_complete_sheet"
        table_description = "好力GO - 设备保养完成单"
        indexes = [("tenant_id",), ("source_upkeep_sheet_id",), ("sheet_no",), ("source_order_no",)]

    sheet_no = fields.CharField(max_length=64, null=True, description="保养完成单单号")
    source_upkeep_sheet = fields.ForeignKeyField(
        "models.HaoligoEquipmentUpkeepSheet",
        related_name="complete_sheets",
        null=True,
        on_delete=fields.SET_NULL,
        description="关联设备保养单",
    )
    source_order_no = fields.CharField(max_length=128, description="来源单号（展示/检索）")
    applicant_user_id = fields.IntField(null=True, description="申请人用户 ID")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人显示名")
    department_uuid = fields.CharField(max_length=36, null=True, description="申请部门 UUID")
    department_name = fields.CharField(max_length=200, null=True, description="申请部门名称")
    header_attachment_file_uuids = fields.JSONField(
        null=True,
        description="保养后附件（文件 UUID 列表）",
    )
    completion_content = fields.TextField(description="保养完成说明")
    reporter_user_id = fields.IntField(description="填报人用户 ID")
