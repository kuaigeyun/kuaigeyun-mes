"""好力GO — 维保完修单（来源单号、维修/保养、是否清空总产量、模具信息）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldMaintenanceCompleteSheet(HaoligoTenantModel):
    """维保完修：关联厂内维保单来源单号、维修/保养、是否清空总产量、头附件与模具行。"""

    class Meta:
        table = "haoligo_mold_maintenance_complete_sheet"
        table_description = "好力GO - 维保完修单"
        indexes = [("tenant_id",), ("source_order_no",), ("source_maintenance_sheet_id",)]

    source_maintenance_sheet_id = fields.IntField(null=True, description="关联厂内维保单 id（可选）")
    source_order_no = fields.CharField(max_length=128, description="来源单号（展示/检索）")
    service_type = fields.CharField(max_length=16, description="维修/保养")
    clear_total_production = fields.BooleanField(default=False, description="是否清空总产量")
    header_attachment_file_uuids = fields.JSONField(null=True, description="附件照片（文件 UUID 列表）")
    line_items = fields.JSONField(description="模具信息行")
