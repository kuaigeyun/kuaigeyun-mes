"""好力GO — 厂内维保单（申请部门 + 维修/保养 + 模具明细 JSON）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldMaintenanceSheet(HaoligoTenantModel):
    """厂内维保：申请部门、维修/保养、来源单号、头附件；明细与外协维保单行结构一致。"""

    class Meta:
        table = "haoligo_mold_maintenance_sheet"
        table_description = "好力GO - 维保单"
        indexes = [("tenant_id",), ("service_type",), ("department_uuid",)]

    sheet_no = fields.CharField(max_length=64, null=True, description="维保单单号（系统编码规则生成）")
    applicant_user_id = fields.IntField(null=True, description="申请人用户 ID（core_users）")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人显示名（冗余）")
    department_uuid = fields.CharField(max_length=36, null=True, description="申请部门 UUID")
    department_name = fields.CharField(max_length=200, null=True, description="申请部门名称")
    service_type = fields.CharField(max_length=16, description="维修/保养")
    source_order_no = fields.CharField(max_length=128, null=True, description="来源单号")
    header_attachment_file_uuids = fields.JSONField(
        null=True,
        description="基础信息附件·维护保养前（文件 UUID 列表）",
    )
    line_items = fields.JSONField(description="模具明细列表")
