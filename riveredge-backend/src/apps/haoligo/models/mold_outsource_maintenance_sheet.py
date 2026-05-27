"""好力GO — 外协维保单（基础信息 + 模具明细 JSON）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldOutsourceMaintenanceSheet(HaoligoTenantModel):
    """外协维保：外协单位、维修/保养、来源单号、头附件；明细含模具、原因、费用、附件。"""

    class Meta:
        table = "haoligo_mold_outsource_maintenance_sheet"
        table_description = "好力GO - 外协维保单"
        indexes = [
            ("tenant_id",),
            ("outsourced_unit_name",),
            ("service_type",),
            ("department_uuid",),
        ]

    sheet_no = fields.CharField(max_length=64, null=True, description="外协维保单单号（系统编码规则生成）")
    applicant_user_id = fields.IntField(null=True, description="申请人用户 ID（core_users）")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人显示名（冗余）")
    department_uuid = fields.CharField(max_length=36, null=True, description="申请部门 UUID（末级）")
    department_name = fields.CharField(max_length=200, null=True, description="申请部门名称")
    outsourced_unit_code = fields.CharField(max_length=64, null=True, description="外协单位代号")
    outsourced_unit_name = fields.CharField(max_length=200, description="外协单位名称")
    service_type = fields.CharField(max_length=16, description="维修/保养")
    source_order_no = fields.CharField(max_length=128, null=True, description="来源单号")
    header_attachment_file_uuids = fields.JSONField(null=True, description="基础信息附件（文件 UUID 列表）")
    line_items = fields.JSONField(description="模具明细列表")
    sheet_status = fields.CharField(
        max_length=32,
        default="待审核",
        description="审核状态：待审核/已通过/已驳回",
    )
    audited_at = fields.DatetimeField(null=True, description="审核时间")
    audited_by_user_id = fields.IntField(null=True, description="审核人用户 ID")
