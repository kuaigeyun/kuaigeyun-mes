"""
设备点检计划模型

对齐保养计划：设备 + 点检方案 + 周期/日期，用于排程并生成点检单。
"""

from tortoise import fields

from core.models.base import BaseModel


class EquipmentSpotCheckPlan(BaseModel):
    """设备点检计划"""

    class Meta:
        table = "apps_kuaizhizao_equipment_spot_check_plans"
        table_description = "快格轻制造 - 设备点检计划"
        indexes = [
            ("tenant_id",),
            ("plan_no",),
            ("equipment_id",),
            ("scheme_id",),
            ("status",),
            ("planned_start_date",),
        ]
        unique_together = [("tenant_id", "plan_no")]

    id = fields.IntField(pk=True, description="主键ID")

    plan_no = fields.CharField(max_length=100, description="计划编号（组织内唯一）")
    plan_name = fields.CharField(max_length=200, description="计划名称")

    # 设备由点检方案绑定展开；历史行可仍有快照，新写入可空
    equipment_id = fields.IntField(null=True, description="设备ID（首台，可选快照）")
    equipment_uuid = fields.CharField(max_length=36, null=True, description="设备UUID（首台，可选快照）")
    equipment_name = fields.CharField(max_length=200, null=True, description="设备名称（首台或汇总，可选快照）")
    equipment_items = fields.JSONField(null=True, description="关联设备列表快照（可选）")

    scheme_id = fields.IntField(description="点检方案ID")
    scheme_code = fields.CharField(max_length=64, null=True, description="点检方案编码快照")
    scheme_name = fields.CharField(max_length=200, null=True, description="点检方案名称快照")

    # 周期真源为点检方案；计划仅存快照供列表展示
    cycle_type = fields.CharField(max_length=50, null=True, description="周期类型快照（来自点检方案）")
    cycle_value = fields.IntField(null=True, description="周期值（可选）")
    cycle_unit = fields.CharField(max_length=20, null=True, description="周期单位（可选）")

    planned_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束日期")

    responsible_person_id = fields.IntField(null=True, description="负责人ID")
    responsible_person_name = fields.CharField(max_length=100, null=True, description="负责人姓名")

    status = fields.CharField(
        max_length=50,
        default="草稿",
        description="计划状态（草稿、已发布、执行中、已完成、已取消）",
    )
    remark = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件列表")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.plan_no} - {self.plan_name}"
