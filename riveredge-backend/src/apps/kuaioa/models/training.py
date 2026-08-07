"""培训与上岗证模型。"""

from tortoise import fields

from core.models.base import BaseModel


class KuaioaTrainingPlan(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    plan_code = fields.CharField(max_length=50, description="计划编号")
    plan_name = fields.CharField(max_length=200, description="计划名称")
    plan_type = fields.CharField(max_length=50, default="quality", description="计划类型")
    department_name = fields.CharField(max_length=100, null=True, description="部门")
    planned_start_date = fields.DateField(null=True, description="计划开始")
    planned_end_date = fields.DateField(null=True, description="计划结束")
    status = fields.CharField(max_length=30, default="draft", description="状态")
    description = fields.TextField(null=True, description="说明")
    reminder_days = fields.IntField(default=7, description="提醒天数")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_training_plans"
        table_description = "轻办公 - 培训计划"
        unique_together = (("tenant_id", "plan_code"),)
        indexes = [("tenant_id", "status"), ("tenant_id", "plan_type")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KuaioaTrainingRecord(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    record_code = fields.CharField(max_length=50, description="记录编号")
    plan_id = fields.IntField(null=True, description="关联计划")
    training_name = fields.CharField(max_length=200, description="培训名称")
    trainee_id = fields.IntField(null=True, description="参训人")
    trainee_name = fields.CharField(max_length=100, null=True, description="参训人姓名")
    trainer_name = fields.CharField(max_length=100, null=True, description="讲师")
    training_date = fields.DateField(null=True, description="培训日期")
    theory_score = fields.DecimalField(max_digits=8, decimal_places=2, null=True, description="理论成绩")
    practice_score = fields.DecimalField(max_digits=8, decimal_places=2, null=True, description="实操成绩")
    is_passed = fields.BooleanField(default=False, description="是否通过")
    status = fields.CharField(max_length=30, default="draft", description="状态")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_training_records"
        table_description = "轻办公 - 培训记录"
        unique_together = (("tenant_id", "record_code"),)
        indexes = [("tenant_id", "plan_id"), ("tenant_id", "trainee_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KuaioaWorkLicense(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    license_code = fields.CharField(max_length=50, description="证书编号")
    license_name = fields.CharField(max_length=200, description="证书名称")
    license_type = fields.CharField(max_length=50, default="work", description="类型 work/special")
    holder_id = fields.IntField(null=True, description="持有人")
    holder_name = fields.CharField(max_length=100, null=True, description="持有人姓名")
    department_name = fields.CharField(max_length=100, null=True, description="部门")
    issue_date = fields.DateField(null=True, description="发证日期")
    expiry_date = fields.DateField(null=True, description="到期日期")
    status = fields.CharField(max_length=30, default="active", description="状态")
    reminder_days = fields.IntField(default=30, description="到期提醒天数")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_work_licenses"
        table_description = "轻办公 - 上岗证"
        unique_together = (("tenant_id", "license_code"),)
        indexes = [("tenant_id", "holder_id"), ("tenant_id", "expiry_date")]

    class PydanticMeta:
        exclude = ["deleted_at"]
