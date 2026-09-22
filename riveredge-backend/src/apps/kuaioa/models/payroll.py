"""薪酬：生活费预支、奖励、工资结算。"""

from tortoise import fields

from core.models.base import BaseModel


class KuaioaLivingAdvance(BaseModel):
    """当月生活费预支（仅当月有效）。"""

    tenant_id = fields.IntField(description="租户ID")
    advance_code = fields.CharField(max_length=50, description="单号")
    year_month = fields.CharField(max_length=7, description="年月 YYYY-MM")
    employee_id = fields.IntField(description="员工档案ID")
    employee_code = fields.CharField(max_length=50, null=True, description="员工编号快照")
    employee_name = fields.CharField(max_length=100, description="姓名快照")
    workshop_name = fields.CharField(max_length=100, null=True, description="车间快照")
    base_living = fields.DecimalField(
        max_digits=12, decimal_places=2, null=True, description="档案生活费标准快照"
    )
    amount = fields.DecimalField(max_digits=12, decimal_places=2, description="预支金额")
    reason = fields.CharField(max_length=200, null=True, description="原因")
    status = fields.CharField(max_length=20, default="confirmed", description="confirmed/void")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_living_advances"
        table_description = "轻办公 - 生活费预支"
        unique_together = (("tenant_id", "advance_code"),)
        indexes = [("tenant_id", "year_month"), ("tenant_id", "employee_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KuaioaRewardRecord(BaseModel):
    """额外奖励登记。"""

    tenant_id = fields.IntField(description="租户ID")
    reward_code = fields.CharField(max_length=50, description="单号")
    year_month = fields.CharField(max_length=7, description="年月 YYYY-MM")
    employee_id = fields.IntField(description="员工档案ID")
    employee_code = fields.CharField(max_length=50, null=True, description="员工编号快照")
    employee_name = fields.CharField(max_length=100, description="姓名快照")
    workshop_name = fields.CharField(max_length=100, null=True, description="车间快照")
    amount = fields.DecimalField(max_digits=12, decimal_places=2, description="奖励金额")
    reason = fields.CharField(max_length=200, null=True, description="奖励原因")
    status = fields.CharField(max_length=20, default="confirmed", description="confirmed/void")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_reward_records"
        table_description = "轻办公 - 奖励登记"
        unique_together = (("tenant_id", "reward_code"),)
        indexes = [("tenant_id", "year_month"), ("tenant_id", "employee_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KuaioaPayrollSettlement(BaseModel):
    """车间月度工资结算单。"""

    tenant_id = fields.IntField(description="租户ID")
    settlement_code = fields.CharField(max_length=50, description="结算单号")
    year_month = fields.CharField(max_length=7, description="年月 YYYY-MM")
    workshop_name = fields.CharField(max_length=100, description="车间")
    ot_multiplier = fields.DecimalField(
        max_digits=6, decimal_places=2, default=3, description="加班倍率"
    )
    line_total_output = fields.DecimalField(
        max_digits=14, decimal_places=2, null=True, description="产线总产量"
    )
    line_total_hours = fields.DecimalField(
        max_digits=12, decimal_places=2, null=True, description="产线总工时"
    )
    line_total_wage = fields.DecimalField(
        max_digits=14, decimal_places=2, null=True, description="产线总工资"
    )
    line_bonus_rate = fields.DecimalField(
        max_digits=8, decimal_places=4, default=0.01, description="产线月奖比例"
    )
    status = fields.CharField(max_length=20, default="draft", description="draft/confirmed")
    confirmed_at = fields.DatetimeField(null=True)
    confirmed_by = fields.IntField(null=True)
    confirmed_by_name = fields.CharField(max_length=100, null=True)
    notes = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_payroll_settlements"
        table_description = "轻办公 - 工资结算单"
        unique_together = (("tenant_id", "settlement_code"),)
        indexes = [("tenant_id", "year_month"), ("tenant_id", "workshop_name"), ("tenant_id", "status")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KuaioaPayrollSettlementLine(BaseModel):
    """工资结算行（过账快照字段写死，禁止读侧 enrich）。"""

    tenant_id = fields.IntField(description="租户ID")
    settlement_id = fields.IntField(description="结算单ID")
    employee_id = fields.IntField(description="员工档案ID")
    employee_code = fields.CharField(max_length=50, null=True)
    employee_name = fields.CharField(max_length=100)
    bank_name = fields.CharField(max_length=100, null=True)
    bank_account = fields.CharField(max_length=50, null=True)
    # 应发
    basic_wage = fields.DecimalField(max_digits=12, decimal_places=2, default=0)
    post_wage = fields.DecimalField(max_digits=12, decimal_places=2, default=0)
    time_wage = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="计时工资")
    piece_wage = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="计件工资")
    night_subsidy = fields.DecimalField(max_digits=12, decimal_places=2, default=0)
    heat_subsidy = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="高温补贴")
    post_allowance = fields.DecimalField(
        max_digits=12, decimal_places=2, default=0, description="岗位津贴"
    )
    allowance = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="补助/奖励")
    earning_subtotal = fields.DecimalField(max_digits=12, decimal_places=2, default=0)
    # 扣除
    living_deduct = fields.DecimalField(
        max_digits=12, decimal_places=2, default=0, description="生活费专项（标准+预支）"
    )
    rent_utility_deduct = fields.DecimalField(
        max_digits=12, decimal_places=2, default=0, description="房租电费扣除"
    )
    insurance_deduct = fields.DecimalField(max_digits=12, decimal_places=2, default=0)
    leave_deduct = fields.DecimalField(max_digits=12, decimal_places=2, default=0)
    compensation = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="赔款")
    tax_deduct = fields.DecimalField(max_digits=12, decimal_places=2, default=0)
    deduct_subtotal = fields.DecimalField(max_digits=12, decimal_places=2, default=0)
    # 结余
    card_pay = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="打卡金额")
    balance = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="结余工资")
    # 计算辅助快照
    regular_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    ot_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    night_count = fields.IntField(null=True)
    hourly_rate = fields.DecimalField(max_digits=12, decimal_places=4, null=True)
    notes = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_payroll_settlement_lines"
        table_description = "轻办公 - 工资结算行"
        unique_together = (("tenant_id", "settlement_id", "employee_id"),)
        indexes = [("tenant_id", "settlement_id"), ("tenant_id", "employee_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]
