"""
厂级工作日历：工作时段配置 + 加班计划。

供 APS / MRP 等引用；与节假日（Holiday）组合构成有效可排日历。
"""

from tortoise import fields
from core.models.base import BaseModel


class WorkCalendarConfig(BaseModel):
    """租户级工作时段配置（每租户一条）。"""

    class Meta:
        table = "apps_master_data_work_calendar_configs"
        table_description = "基础数据管理 - 工作日历配置"
        indexes = [
            ("tenant_id",),
            ("uuid",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    work_day_start = fields.TimeField(description="每日工作开始时刻")
    work_day_end = fields.TimeField(description="每日工作结束时刻")
    break_start = fields.TimeField(null=True, description="休息开始时刻")
    break_end = fields.TimeField(null=True, description="休息结束时刻")
    window_source = fields.CharField(
        max_length=20,
        default="fixed",
        description="窗口来源：fixed / shift",
    )
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"WorkCalendarConfig#{self.tenant_id} {self.work_day_start}-{self.work_day_end}"


class OvertimePlan(BaseModel):
    """按日加班窗口（可多条/日）。"""

    class Meta:
        table = "apps_master_data_overtime_plans"
        table_description = "基础数据管理 - 加班计划"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("overtime_date",),
            ("tenant_id", "overtime_date"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    overtime_date = fields.DateField(description="加班日期")
    start_time = fields.TimeField(description="加班开始时刻")
    end_time = fields.TimeField(description="加班结束时刻")
    name = fields.CharField(max_length=200, null=True, description="名称/说明")
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"OvertimePlan#{self.id} {self.overtime_date} {self.start_time}-{self.end_time}"


class StationUnavailableWindow(BaseModel):
    """工位停机/不可用窗口（从可排窗扣除或作为占用）。"""

    class Meta:
        table = "apps_master_data_station_unavailable_windows"
        table_description = "基础数据管理 - 工位停机窗"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("station_id",),
            ("tenant_id", "station_id"),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    station_id = fields.IntField(description="工位ID")
    start_at = fields.DatetimeField(description="停机开始")
    end_at = fields.DatetimeField(description="停机结束")
    reason = fields.CharField(max_length=200, null=True, description="原因")
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"StationUnavailable#{self.id} station={self.station_id}"
