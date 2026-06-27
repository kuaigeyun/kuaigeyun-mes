"""好力GO — 品质管理一期（问题跟踪 / 客诉 / 停线反馈）。"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class _HaoligoQualityBase(HaoligoTenantModel):
    """品质单据公共字段。"""

    class Meta:
        abstract = True

    sheet_no = fields.CharField(max_length=64, null=True, description="单号")
    title = fields.CharField(max_length=200, null=True, description="标题")
    workshop = fields.ForeignKeyField(
        "models.HaoligoWorkshop",
        related_name=False,
        null=True,
        on_delete=fields.SET_NULL,
        description="责任车间",
    )
    production_line = fields.CharField(max_length=200, null=True, description="产线")
    work_order_no = fields.CharField(max_length=128, null=True, description="制令单号")
    material_code_snapshot = fields.CharField(max_length=128, null=True, description="物料号快照")
    model_snapshot = fields.CharField(max_length=128, null=True, description="型号快照")
    mold_code_snapshot = fields.CharField(max_length=128, null=True, description="模具号快照")
    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name=False,
        null=True,
        on_delete=fields.SET_NULL,
        description="关联设备",
    )
    problem_description = fields.TextField(null=True, description="问题描述")
    immediate_action = fields.TextField(null=True, description="临时措施（兼容字段）")
    long_term_action = fields.TextField(null=True, description="长期措施（兼容字段）")
    due_at = fields.DatetimeField(null=True, description="计划完成时间（兼容字段）")
    temporary_action = fields.TextField(null=True, description="临时措施")
    temporary_due_at = fields.DatetimeField(null=True, description="临时措施预计完成时间")
    temporary_action_image_uuids = fields.JSONField(default=list, description="临时措施落实图片 UUID 列表")
    temporary_submitted_at = fields.DatetimeField(null=True, description="临时措施提交时间")
    long_term_due_at = fields.DatetimeField(null=True, description="长期措施预计完成时间")
    long_term_action_image_uuids = fields.JSONField(default=list, description="长期措施落实图片 UUID 列表")
    long_term_submitted_at = fields.DatetimeField(null=True, description="长期措施提交时间")
    completed_at = fields.DatetimeField(null=True, description="完成时间")
    status = fields.CharField(
        max_length=32,
        default="registered",
        description="状态：registered(登记)/processing(处理中)/completed(完成)，兼容历史 assigned",
    )
    attachment_file_uuids = fields.JSONField(default=list, description="附件 UUID 列表")
    registrant_user_id = fields.IntField(null=True, description="登记人用户 ID")
    registrant_name = fields.CharField(max_length=100, null=True, description="登记人")
    responsible_user_id = fields.IntField(null=True, description="责任人用户 ID")
    responsible_name = fields.CharField(max_length=100, null=True, description="责任人")
    responsible_user_ids = fields.JSONField(default=list, description="责任人用户 ID 列表（多人）")
    overdue_notify_user_ids = fields.JSONField(default=list, description="逾期提醒对象用户 ID 列表")
    notify_user_ids = fields.JSONField(default=list, description="通知接收人用户 ID 列表")
    reported_at = fields.DatetimeField(null=True, description="反馈时间")
    close_note = fields.TextField(null=True, description="结案备注")
    close_confirmed_at = fields.DatetimeField(null=True, description="结案确认时间")
    close_confirmer_user_id = fields.IntField(null=True, description="结案确认人用户 ID")


class HaoligoQualityIssueTracking(_HaoligoQualityBase):
    """品质问题反馈及跟踪。"""

    class Meta:
        table = "haoligo_quality_issue_tracking"
        table_description = "好力GO - 品质问题反馈及跟踪"
        indexes = [("tenant_id",), ("status",), ("reported_at",), ("sheet_no",)]

    issue_type_codes = fields.JSONField(default=list, description="问题类型编码列表")
    issue_kind = fields.CharField(
        max_length=32,
        null=True,
        description="问题类型：equipment(设备品质问题)/product(产品品质问题)",
    )
    temporary_overdue_notify_user_ids = fields.JSONField(
        default=list,
        description="临时措施逾期提醒对象用户 ID 列表",
    )
    long_term_overdue_notify_user_ids = fields.JSONField(
        default=list,
        description="长期措施逾期提醒对象用户 ID 列表",
    )
    planned_qty = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="计划数量")
    completed_qty = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="完成数量")
    defect_qty = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="不良数量")
    defect_rate = fields.DecimalField(max_digits=8, decimal_places=2, null=True, description="不良率（%）")


class HaoligoCustomerComplaint(_HaoligoQualityBase):
    """客户投诉。"""

    class Meta:
        table = "haoligo_customer_complaint"
        table_description = "好力GO - 客户投诉"
        indexes = [("tenant_id",), ("status",), ("reported_at",), ("sheet_no",)]

    temporary_overdue_notify_user_ids = fields.JSONField(
        default=list,
        description="临时措施逾期提醒对象用户 ID 列表",
    )
    long_term_overdue_notify_user_ids = fields.JSONField(
        default=list,
        description="长期措施逾期提醒对象用户 ID 列表",
    )
    customer_name = fields.CharField(max_length=200, null=True, description="客户名称")
    material_code = fields.CharField(max_length=100, null=True, description="物料号")
    model = fields.CharField(max_length=100, null=True, description="型号")
    batch_no = fields.CharField(max_length=100, null=True, description="批次号")
    quantity = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="不良数量")
    claim_amount = fields.DecimalField(max_digits=18, decimal_places=2, null=True, description="赔偿金额")


class HaoligoLineStopFeedback(_HaoligoQualityBase):
    """停线（机）反馈。"""

    class Meta:
        table = "haoligo_line_stop_feedback"
        table_description = "好力GO - 停线（机）反馈"
        indexes = [("tenant_id",), ("status",), ("reported_at",), ("sheet_no",)]

    temporary_overdue_notify_user_ids = fields.JSONField(
        default=list,
        description="临时措施逾期提醒对象用户 ID 列表",
    )
    long_term_overdue_notify_user_ids = fields.JSONField(
        default=list,
        description="长期措施逾期提醒对象用户 ID 列表",
    )
    stop_kind = fields.CharField(max_length=32, default="equipment", description="停线类型：equipment/quality")
    stop_reason = fields.TextField(null=True, description="停线原因")
    stop_started_at = fields.DatetimeField(null=True, description="停线开始时间")
    recovered_at = fields.DatetimeField(null=True, description="恢复生产时间")
