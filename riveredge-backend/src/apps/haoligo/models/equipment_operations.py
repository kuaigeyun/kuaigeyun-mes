"""
好力 GO — 设备运行单据（点检 / 路线巡检 / 维保 / 产出）与产出数据集绑定。

事实表独立，不复用 kuaizhizao。
"""

from tortoise import fields

from apps.haoligo.models.base import HaoligoTenantModel


class HaoligoEquipmentSpotCheck(HaoligoTenantModel):
    """设备点检单（按设备点检方案逐项记录）。"""

    class Meta:
        table = "haoligo_equipment_spot_check"
        table_description = "好力GO - 设备点检单"
        indexes = [
            ("tenant_id",),
            ("equipment_id",),
            ("recorded_at",),
            ("sheet_no",),
            ("inspection_param_set_id",),
        ]

    sheet_no = fields.CharField(max_length=64, null=True, description="单号（编码规则生成）")
    recorded_at = fields.DatetimeField(description="点检日期时间")
    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name="spot_checks",
        on_delete=fields.RESTRICT,
        description="设备",
    )
    reporter_user_id = fields.IntField(description="填报人用户 ID")
    abnormal_description = fields.TextField(null=True, description="异常描述")
    applied_operational_status = fields.CharField(
        max_length=32, null=True, description="本单调整后的设备运行状态（数据字典 value）"
    )
    report_enabled = fields.BooleanField(default=False, description="是否上报")
    report_notify_user_ids = fields.JSONField(default=list, description="上报通知接收人用户 ID 列表")
    inspection_param_set = fields.ForeignKeyField(
        "models.HaoligoInspectionParamSet",
        related_name="spot_checks_used",
        null=True,
        on_delete=fields.SET_NULL,
        description="本单使用的点检方案（可空：历史数据）",
    )
    inspection_param_set_code = fields.CharField(max_length=64, null=True, description="点检方案编码快照")
    inspection_param_set_name = fields.CharField(max_length=200, null=True, description="点检方案名称快照")


class HaoligoEquipmentSpotCheckLine(HaoligoTenantModel):
    """点检单行（参数项 + 结果）。"""

    class Meta:
        table = "haoligo_equipment_spot_check_line"
        table_description = "好力GO - 设备点检单行"
        indexes = [("tenant_id",), ("header_id",), ("header_id", "sort_order")]

    header = fields.ForeignKeyField(
        "models.HaoligoEquipmentSpotCheck",
        related_name="lines",
        on_delete=fields.CASCADE,
        description="点检单",
    )
    inspection_param = fields.ForeignKeyField(
        "models.HaoligoInspectionParam",
        related_name="spot_check_lines",
        null=True,
        on_delete=fields.SET_NULL,
        description="点检参数（可空：历史删除）",
    )
    param_code = fields.CharField(max_length=64, description="参数编码快照")
    param_name = fields.CharField(max_length=200, description="参数名称快照")
    sort_order = fields.IntField(default=0, description="顺序号（与方案明细一致）")
    value_type = fields.CharField(max_length=32, default="numeric", description="取值类型快照：numeric/text/boolean")
    unit = fields.CharField(max_length=32, null=True, description="单位快照")
    is_required = fields.BooleanField(default=True, description="是否必检快照")
    measured_value = fields.TextField(null=True, description="实测值（文本存储，按 value_type 解析）")
    result = fields.CharField(max_length=16, description="结果：normal / abnormal")
    remark = fields.TextField(null=True, description="备注")
    attachment_file_ids = fields.JSONField(null=True, description="点检项现场照片 core 文件 id 列表")


class HaoligoEquipmentRoutePatrol(HaoligoTenantModel):
    """设备路线巡检单。"""

    class Meta:
        table = "haoligo_equipment_route_patrol"
        table_description = "好力GO - 设备路线巡检单"
        indexes = [("tenant_id",), ("patrol_route_id",), ("recorded_at",), ("sheet_no",)]

    sheet_no = fields.CharField(max_length=64, null=True, description="单号（编码规则生成）")
    recorded_at = fields.DatetimeField(description="巡检日期时间")
    patrol_route = fields.ForeignKeyField(
        "models.HaoligoPatrolRoute",
        related_name="route_patrols",
        on_delete=fields.RESTRICT,
        description="巡检路线",
    )
    reporter_user_id = fields.IntField(description="填报人用户 ID")
    report_enabled = fields.BooleanField(default=False, description="是否上报")
    report_notify_user_ids = fields.JSONField(default=list, description="上报通知接收人用户 ID 列表")


class HaoligoEquipmentRoutePatrolLine(HaoligoTenantModel):
    """路线巡检行（路线上的设备 + 是否正常）。"""

    class Meta:
        table = "haoligo_equipment_route_patrol_line"
        table_description = "好力GO - 设备路线巡检单行"
        indexes = [("tenant_id",), ("header_id",)]

    header = fields.ForeignKeyField(
        "models.HaoligoEquipmentRoutePatrol",
        related_name="lines",
        on_delete=fields.CASCADE,
        description="巡检单",
    )
    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name="route_patrol_lines",
        on_delete=fields.RESTRICT,
        description="设备",
    )
    asset_code = fields.CharField(max_length=64, description="设备代号快照")
    equipment_name = fields.CharField(max_length=200, description="设备名称快照")
    sequence = fields.IntField(default=0, description="顺序号")
    is_normal = fields.BooleanField(default=True, description="是否正常")
    abnormal_description = fields.TextField(null=True, description="异常描述")
    applied_operational_status = fields.CharField(
        max_length=32, null=True, description="本行调整后的设备运行状态（数据字典 value）"
    )
    attachment_file_ids = fields.JSONField(null=True, description="巡检设备现场照片 core 文件 id 列表")


class HaoligoEquipmentMaintenanceReport(HaoligoTenantModel):
    """设备维保（维报）。"""

    class Meta:
        table = "haoligo_equipment_maintenance_report"
        table_description = "好力GO - 设备维保单"
        indexes = [("tenant_id",), ("equipment_id",), ("recorded_at",), ("sheet_no",)]

    sheet_no = fields.CharField(max_length=64, null=True, description="单号（编码规则生成）")
    recorded_at = fields.DatetimeField(description="日期时间")
    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name="maintenance_reports",
        on_delete=fields.RESTRICT,
        description="设备",
    )
    description = fields.TextField(description="维保描述")
    attachment_file_ids = fields.JSONField(null=True, description="附件 core 文件 id 列表")
    reporter_user_id = fields.IntField(description="填报人用户 ID")


class HaoligoEquipmentOutputRecord(HaoligoTenantModel):
    """设备产出记录。"""

    class Meta:
        table = "haoligo_equipment_output_record"
        table_description = "好力GO - 设备产出单"
        indexes = [("tenant_id",), ("equipment_id",), ("recorded_at",), ("sheet_no",), ("work_order_no",)]

    sheet_no = fields.CharField(max_length=64, null=True, description="单号（编码规则生成）")
    recorded_at = fields.DatetimeField(description="日期时间")
    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name="output_records",
        on_delete=fields.RESTRICT,
        description="设备",
    )
    work_order_no = fields.CharField(max_length=128, description="制令单号")
    customer_name = fields.CharField(max_length=200, null=True, description="客户（历史字段，新单请用成品代号/名称）")
    product_name = fields.CharField(max_length=200, null=True, description="品号/名称（历史字段）")
    finished_product_code = fields.CharField(max_length=128, null=True, description="成品代号")
    finished_product_name = fields.CharField(max_length=200, null=True, description="成品名称")
    planned_qty = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="计划数量")
    completed_qty = fields.DecimalField(max_digits=18, decimal_places=4, description="完成数量")
    startup_at = fields.DatetimeField(null=True, description="开机时间")
    completed_at = fields.DatetimeField(null=True, description="完成时间")
    operator_name = fields.CharField(max_length=100, null=True, description="作业人员")
    team_leader_name = fields.CharField(max_length=100, null=True, description="组长")
    reporter_user_id = fields.IntField(description="填报人用户 ID")
    dataset_snapshot = fields.JSONField(null=True, description="数据集带出原始行快照")


class HaoligoEquipmentStatusAdjustment(HaoligoTenantModel):
    """设备状态调整单（手工切换设备运行状态）。"""

    class Meta:
        table = "haoligo_equipment_status_adjustment"
        table_description = "好力GO - 设备状态调整单"
        indexes = [("tenant_id",), ("equipment_id",), ("recorded_at",), ("sheet_no",)]

    sheet_no = fields.CharField(max_length=64, null=True, description="单号（编码规则生成）")
    recorded_at = fields.DatetimeField(description="调整时间")
    equipment = fields.ForeignKeyField(
        "models.HaoligoEquipment",
        related_name="status_adjustments",
        on_delete=fields.RESTRICT,
        description="设备",
    )
    old_operational_status = fields.CharField(max_length=32, null=True, description="调整前运行状态")
    new_operational_status = fields.CharField(max_length=32, description="调整后运行状态")
    remark = fields.TextField(null=True, description="备注")
    reporter_user_id = fields.IntField(description="填报人用户 ID")


class HaoligoEquipmentOutputDatasetBinding(HaoligoTenantModel):
    """设备产出与数据集的关联（按制令单号查询）。"""

    class Meta:
        table = "haoligo_equipment_output_dataset_binding"
        table_description = "好力GO - 设备产出数据集关联"
        indexes = [("tenant_id",)]

    dataset_uuid = fields.CharField(max_length=36, null=True, description="数据集 UUID")
    work_order_param_key = fields.CharField(max_length=64, null=True, description="制令单号 SQL 参数名")
    customer_column = fields.CharField(max_length=128, null=True, description="客户列名（历史）")
    product_name_column = fields.CharField(max_length=128, null=True, description="品号名称列名（历史）")
    finished_product_code_column = fields.CharField(max_length=128, null=True, description="成品代号列名（可选）")
    finished_product_name_column = fields.CharField(max_length=128, null=True, description="成品名称列名（可选）")
    planned_qty_column = fields.CharField(max_length=128, null=True, description="计划数量列名（可选）")
