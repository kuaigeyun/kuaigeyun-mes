"""
排班管理数据模型

班次定义、按工作小组的周排班周期与排班明细。
"""

from tortoise import fields
from core.models.base import BaseModel


class Shift(BaseModel):
    """班次定义（早/中/晚等）"""

    class Meta:
        table = "apps_master_data_shifts"
        table_description = "基础数据管理 - 班次定义"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("code",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    code = fields.CharField(max_length=50, description="班次编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="班次名称")
    start_time = fields.TimeField(description="开始时间")
    end_time = fields.TimeField(description="结束时间")
    crosses_midnight = fields.BooleanField(default=False, description="是否跨天")
    standard_hours = fields.DecimalField(
        max_digits=6, decimal_places=2, default=8, description="标准工时（小时）"
    )
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.code} - {self.name}"


class ShiftRoster(BaseModel):
    """排班周期（按工作小组或单员工 + 自然周）"""

    class Meta:
        table = "apps_master_data_shift_rosters"
        table_description = "基础数据管理 - 排班周期"
        indexes = [
            ("tenant_id",),
            ("work_group_id",),
            ("employee_id",),
            ("period_start",),
            ("status",),
            ("scope_type",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    scope_type = fields.CharField(
        max_length=20, default="work_group", description="范围：work_group/employee"
    )
    work_group_id = fields.IntField(null=True, description="工作小组ID（小组排班）")
    work_group_code = fields.CharField(max_length=50, null=True, description="工作小组编码（冗余）")
    work_group_name = fields.CharField(max_length=200, null=True, description="工作小组名称（冗余）")
    employee_id = fields.IntField(null=True, description="员工ID（单人排班）")
    employee_name = fields.CharField(max_length=100, null=True, description="员工姓名（冗余）")
    period_start = fields.DateField(description="周期开始（周一）")
    period_end = fields.DateField(description="周期结束（周日）")
    status = fields.CharField(max_length=20, default="draft", description="状态：draft/published")
    published_at = fields.DatetimeField(null=True, description="发布时间")
    remarks = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"Roster#{self.id} wg={self.work_group_id} {self.period_start}"


class ShiftAssignment(BaseModel):
    """排班明细：员工 × 日期 → 班次（shift_id 为空表示休息）"""

    class Meta:
        table = "apps_master_data_shift_assignments"
        table_description = "基础数据管理 - 排班明细"
        indexes = [
            ("tenant_id",),
            ("roster_id",),
            ("employee_id",),
            ("work_date",),
        ]
        unique_together = [("tenant_id", "roster_id", "employee_id", "work_date")]

    id = fields.IntField(pk=True, description="主键ID")
    roster = fields.ForeignKeyField(
        "models.ShiftRoster",
        related_name="assignments",
        description="排班周期",
    )
    work_date = fields.DateField(description="工作日期")
    shift_id = fields.IntField(null=True, description="班次ID（空=休息）")
    employee_id = fields.IntField(description="员工ID（User.id）")
    employee_name = fields.CharField(max_length=100, null=True, description="员工姓名（冗余）")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"Assignment emp={self.employee_id} {self.work_date}"
