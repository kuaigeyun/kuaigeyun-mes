"""
排程约束统一 DTO

用于智能排产、优化排产、排程配置持久化等场景，避免前后端字段漂移。
"""

from pydantic import Field, model_validator

from core.schemas.base import BaseSchema


class SchedulingConstraints(BaseSchema):
    """统一排产约束条件。"""

    priority_weight: float = Field(0.3, ge=0, le=1, description="优先级权重（0-1）")
    due_date_weight: float = Field(0.3, ge=0, le=1, description="交期权重（0-1）")
    capacity_weight: float = Field(0.2, ge=0, le=1, description="产能权重（0-1）")
    setup_time_weight: float = Field(0.2, ge=0, le=1, description="换线时间权重（0-1）")
    optimize_objective: str = Field(
        "min_makespan",
        description="优化目标（min_makespan/min_total_time/min_setup_time/min_tardiness）",
    )

    # 4M
    consider_human: bool = Field(True, description="是否考虑人员约束")
    consider_equipment: bool = Field(True, description="是否考虑设备约束")
    consider_material: bool = Field(True, description="是否考虑物料齐套")
    consider_mold_tool: bool = Field(True, description="是否考虑模具/工装占用")

    # 可选窗口
    scheduling_window_days: int = Field(14, ge=1, le=90, description="排程搜索窗口天数")
    daily_capacity_hours: float = Field(24.0, ge=1.0, le=24.0, description="默认每日可用工时")

    @model_validator(mode="after")
    def normalize_weights(self):
        total = (
            float(self.priority_weight)
            + float(self.due_date_weight)
            + float(self.capacity_weight)
            + float(self.setup_time_weight)
        )
        if total <= 0:
            self.priority_weight = 0.3
            self.due_date_weight = 0.3
            self.capacity_weight = 0.2
            self.setup_time_weight = 0.2
            return self

        # 自动归一化，保证配置容错
        self.priority_weight = round(float(self.priority_weight) / total, 6)
        self.due_date_weight = round(float(self.due_date_weight) / total, 6)
        self.capacity_weight = round(float(self.capacity_weight) / total, 6)
        self.setup_time_weight = round(float(self.setup_time_weight) / total, 6)
        return self
