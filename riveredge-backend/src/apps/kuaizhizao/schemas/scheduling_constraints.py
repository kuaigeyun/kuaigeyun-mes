"""
排程约束统一 DTO

用于智能排产、优化排产、排程配置持久化等场景，避免前后端字段漂移。
"""

from typing import Any, List

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
    freeze_horizon_days: int = Field(2, ge=0, le=30, description="冻结窗口天数（窗口内不自动改动）")
    rolling_horizon_days: int = Field(14, ge=1, le=120, description="滚动排程窗口天数")
    bottleneck_first: bool = Field(True, description="是否启用瓶颈优先排程")
    bottleneck_work_center_ids: List[int] = Field(default_factory=list, description="瓶颈工作中心ID列表（为空时自动识别）")
    consider_setup_family: bool = Field(True, description="是否考虑换型族连续排产")
    setup_changeover_hours: float = Field(1.0, ge=0, le=12, description="换型切换追加工时（小时）")
    local_reschedule_hours: int = Field(72, ge=1, le=240, description="异常局部重排影响窗口（小时）")

    @model_validator(mode="before")
    @classmethod
    def normalize_weights(cls, data: Any):
        if not isinstance(data, dict):
            return data
        payload = dict(data)
        total = (
            float(payload.get("priority_weight", 0.3))
            + float(payload.get("due_date_weight", 0.3))
            + float(payload.get("capacity_weight", 0.2))
            + float(payload.get("setup_time_weight", 0.2))
        )
        if total <= 0:
            payload["priority_weight"] = 0.3
            payload["due_date_weight"] = 0.3
            payload["capacity_weight"] = 0.2
            payload["setup_time_weight"] = 0.2
            return payload

        # 自动归一化，保证配置容错
        payload["priority_weight"] = round(float(payload.get("priority_weight", 0.3)) / total, 6)
        payload["due_date_weight"] = round(float(payload.get("due_date_weight", 0.3)) / total, 6)
        payload["capacity_weight"] = round(float(payload.get("capacity_weight", 0.2)) / total, 6)
        payload["setup_time_weight"] = round(float(payload.get("setup_time_weight", 0.2)) / total, 6)
        return payload
