"""好力 GO — 设备验收单（头 + 多轮调试/试产明细）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoEquipmentAcceptanceSheet(HaoligoTenantModel):
    """设备验收单头：进场信息、工作流状态、台账关联。"""

    class Meta:
        table = "haoligo_equipment_acceptance_sheet"
        table_description = "好力GO - 设备验收单"
        indexes = [
            ("tenant_id",),
            ("sheet_no",),
            ("workflow_status",),
            ("equipment_id",),
            ("manufacturer_id",),
        ]

    sheet_no = fields.CharField(max_length=64, null=True, description="验收单单号")
    manufacturer_id = fields.IntField(null=True, description="制造商 ID")
    manufacturer_name = fields.CharField(max_length=200, null=True, description="制造商名称快照")
    arrived_at = fields.DatetimeField(null=True, description="设备进场时间")
    install_location = fields.CharField(max_length=500, null=True, description="安装位置")
    equipment_name = fields.CharField(max_length=200, null=True, description="设备名称")
    commissioning_user_ids = fields.JSONField(default=list, description="调试人员用户 ID 列表")
    submitted_notify_user_ids = fields.JSONField(
        default=list,
        description="提交试产时抄送通知用户 ID 列表",
    )
    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name="acceptance_sheets",
        null=True,
        on_delete=fields.SET_NULL,
        description="关联设备台账",
    )
    workflow_status = fields.CharField(max_length=32, default="draft", description="工作流状态")
    current_round = fields.IntField(default=1, description="当前轮次")
    accepted_at = fields.DatetimeField(null=True, description="验收合格时间")
    accepted_by_user_id = fields.IntField(null=True, description="验收确认人用户 ID")
    ledger_action = fields.CharField(max_length=16, default="none", description="台账处理方式")
    reporter_user_id = fields.IntField(description="建单人用户 ID")


class HaoligoEquipmentAcceptanceRound(HaoligoTenantModel):
    """设备验收轮次：调试段 + 试产段。"""

    class Meta:
        table = "haoligo_equipment_acceptance_round"
        table_description = "好力GO - 设备验收轮次"
        unique_together = [("header_id", "round_no")]
        indexes = [("tenant_id",), ("header_id",), ("round_no",)]

    header = fields.ForeignKeyField(
        "models.HaoligoEquipmentAcceptanceSheet",
        related_name="rounds",
        on_delete=fields.CASCADE,
        description="验收单头",
    )
    round_no = fields.IntField(description="轮次序号，从 1 起")
    commissioning_content = fields.TextField(null=True, description="调试内容")
    commissioning_result = fields.CharField(max_length=16, null=True, description="调试结果：合格/不合格")
    commissioning_submitted_at = fields.DatetimeField(null=True, description="调试提交试产时间")
    product_name = fields.CharField(max_length=200, null=True, description="试产产品名称")
    material_no = fields.CharField(max_length=128, null=True, description="物料编号")
    quantity = fields.DecimalField(max_digits=20, decimal_places=4, null=True, description="试产数量")
    defect_qty = fields.DecimalField(max_digits=20, decimal_places=4, null=True, description="不良数量")
    defect_reason = fields.TextField(null=True, description="不良原因")
    running_time = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="运行时间（小时）")
    fault_time = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="故障时间（小时）")
    capacity_per_hour = fields.DecimalField(max_digits=20, decimal_places=4, null=True, description="设备产能（个/小时）")
    trial_result = fields.CharField(max_length=16, null=True, description="试产结果：合格/不合格")
    commissioning_attachment_file_uuids = fields.JSONField(
        default=list,
        description="调试图片附件 UUID 列表",
    )
    trial_attachment_file_uuids = fields.JSONField(
        default=list,
        description="试产图片附件 UUID 列表",
    )
