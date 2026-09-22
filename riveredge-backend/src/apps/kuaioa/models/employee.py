"""员工档案模型。"""

from tortoise import fields

from core.models.base import BaseModel


class KuaioaEmployeeProfile(BaseModel):
    """人事员工档案（可无系统登录账号；含临时工）。"""

    tenant_id = fields.IntField(description="租户ID")
    employee_code = fields.CharField(max_length=50, description="员工编号")
    full_name = fields.CharField(max_length=100, description="姓名")
    phone = fields.CharField(max_length=30, null=True, description="联系电话")
    workshop_name = fields.CharField(max_length=100, null=True, description="所属车间")
    production_line_name = fields.CharField(max_length=100, null=True, description="产线")
    employment_type = fields.CharField(
        max_length=20, default="formal", description="用工类型 formal/temp"
    )
    pay_method = fields.CharField(
        max_length=20, default="time", description="计薪方式 piece/time/line"
    )
    hourly_rate = fields.DecimalField(
        max_digits=12, decimal_places=4, null=True, description="计时单价"
    )
    hire_date = fields.DateField(null=True, description="入职日期")
    leave_date = fields.DateField(null=True, description="离职日期")
    bank_account = fields.CharField(max_length=50, null=True, description="工资卡号")
    bank_name = fields.CharField(max_length=100, null=True, description="银行名称")
    bank_branch = fields.CharField(max_length=200, null=True, description="开户行")
    living_allowance = fields.DecimalField(
        max_digits=12, decimal_places=2, null=True, description="生活费标准"
    )
    post_wage = fields.DecimalField(
        max_digits=12, decimal_places=2, null=True, description="岗位工资"
    )
    social_insurance = fields.DecimalField(
        max_digits=12, decimal_places=2, null=True, description="社保金额"
    )
    housing_fund = fields.DecimalField(
        max_digits=12, decimal_places=2, null=True, description="住房公积金"
    )
    rent_utility = fields.DecimalField(
        max_digits=12, decimal_places=2, null=True, description="房租电费标准"
    )
    welfare_dragon_boat = fields.DecimalField(
        max_digits=12, decimal_places=2, null=True, description="端午福利标准"
    )
    welfare_mid_autumn = fields.DecimalField(
        max_digits=12, decimal_places=2, null=True, description="中秋福利标准"
    )
    welfare_spring_festival = fields.DecimalField(
        max_digits=12, decimal_places=2, null=True, description="春节福利标准"
    )
    user_id = fields.IntField(null=True, description="关联系统用户ID（可空）")
    department_name = fields.CharField(max_length=100, null=True, description="部门")
    status = fields.CharField(max_length=20, default="active", description="状态 active/left")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_employee_profiles"
        table_description = "轻办公 - 员工档案"
        unique_together = (("tenant_id", "employee_code"),)
        indexes = [
            ("tenant_id", "status"),
            ("tenant_id", "workshop_name"),
            ("tenant_id", "employment_type"),
            ("tenant_id", "user_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
