"""好力GO — 维保完修单（来源单号、维修/保养、是否清空总产量、模具信息）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldMaintenanceCompleteSheet(HaoligoTenantModel):
    """维保完修：关联厂内维保单来源单号、维修/保养、是否清空总产量、头附件与模具行。"""

    class Meta:
        table = "haoligo_mold_maintenance_complete_sheet"
        table_description = "好力GO - 维保完修单"
        indexes = [("tenant_id",), ("source_order_no",), ("source_maintenance_sheet_id",), ("department_uuid",)]

    sheet_no = fields.CharField(max_length=64, null=True, description="维保完修单单号（系统编码规则生成）")
    source_maintenance_sheet_id = fields.IntField(null=True, description="关联厂内维保单 id（可选）")
    source_order_no = fields.CharField(max_length=128, description="来源单号（展示/检索）")
    applicant_user_id = fields.IntField(null=True, description="申请人用户 ID（core_users）")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人显示名（冗余）")
    department_uuid = fields.CharField(max_length=36, null=True, description="申请部门 UUID")
    department_name = fields.CharField(max_length=200, null=True, description="申请部门名称")
    service_type = fields.CharField(max_length=16, description="维修/保养")
    clear_total_production = fields.BooleanField(default=False, description="是否清空总产量（行级聚合缓存）")
    header_attachment_file_uuids = fields.JSONField(
        null=True,
        description="附件照片·维护保养后（文件 UUID 列表）",
    )
    line_items = fields.JSONField(description="模具信息行")
    complete_notify_user_ids = fields.JSONField(
        default=list,
        description="完修提交时抄送通知用户 ID 列表",
    )
