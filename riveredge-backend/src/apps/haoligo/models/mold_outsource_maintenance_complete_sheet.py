"""好力GO — 外协维保完修单（关联外协维保单、外协单位、头附件与模具行含费用与行附件）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoMoldOutsourceMaintenanceCompleteSheet(HaoligoTenantModel):
    """外协维保完修：来源外协维保单、外协单位、维修/保养、是否清空总产量、头附件与模具行。"""

    class Meta:
        table = "haoligo_mold_outsource_maintenance_complete_sheet"
        table_description = "好力GO - 外协维保完修单"
        indexes = [
            ("tenant_id",),
            ("source_order_no",),
            ("source_outsource_maintenance_sheet_id",),
            ("outsourced_unit_name",),
        ]

    source_outsource_maintenance_sheet_id = fields.IntField(
        null=True,
        description="关联外协维保单 id（可选）",
    )
    source_order_no = fields.CharField(max_length=128, description="来源单号（展示/检索）")
    outsourced_unit_code = fields.CharField(max_length=64, null=True, description="外协单位代号")
    outsourced_unit_name = fields.CharField(max_length=200, description="外协单位名称")
    service_type = fields.CharField(max_length=16, description="维修/保养")
    clear_total_production = fields.BooleanField(default=False, description="是否清空总产量")
    header_attachment_file_uuids = fields.JSONField(null=True, description="基础信息附件照片（文件 UUID 列表）")
    line_items = fields.JSONField(description="模具信息行（含维修费用、行附件）")
