"""好力GO — 现场巡查 / 隐患单（主实体，图表与版本化后续迭代）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoHazardReport(HaoligoTenantModel):
    """检查隐患单（简化字段，后续按客户表单 01～08 扩展）。"""

    class Meta:
        table = "haoligo_hazard_report"
        table_description = "好力GO - 检查隐患单"
        indexes = [("tenant_id",), ("status",), ("workshop_id",), ("reported_at",)]

    workshop = fields.ForeignKeyField(
        "models.HaoligoWorkshop",
        related_name="hazard_reports",
        null=True,
        on_delete=fields.SET_NULL,
        description="关联车间",
    )
    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name="hazard_reports",
        null=True,
        on_delete=fields.SET_NULL,
        description="关联设备（可选）",
    )
    workshop_area = fields.CharField(max_length=200, null=True, description="车间区域")
    reported_at = fields.DatetimeField(null=True, description="巡查/反馈时间")
    issue_type_code = fields.CharField(max_length=64, null=True, description="问题类型编码")
    problem_summary = fields.TextField(null=True, description="问题描述")
    solution_note = fields.TextField(null=True, description="解决方案")
    status = fields.CharField(
        max_length=32,
        default="检查中",
        description="处理状态：检查中/维修中/已完成",
    )
    before_image_file_ids = fields.JSONField(null=True, description="处理前附件（core 文件 id 列表）")
    after_image_file_ids = fields.JSONField(null=True, description="处理后附件")
    handler_name = fields.CharField(max_length=100, null=True, description="处理人")
    handled_at = fields.DatetimeField(null=True, description="处理完成时间")
    registrant_user_id = fields.IntField(null=True, description="登记人用户 ID")
    registrant_name = fields.CharField(max_length=100, null=True, description="登记人显示名")
    responsible_user_id = fields.IntField(null=True, description="责任人用户 ID")
    responsible_name = fields.CharField(max_length=100, null=True, description="责任人显示名")
