"""
可视排产规则 DTO

用于排程配置持久化与甘特诊断，避免前后端字段漂移。
"""

from typing import Any, List

from pydantic import Field, model_validator

from core.schemas.base import BaseSchema


class SchedulingConstraints(BaseSchema):
    """可视排产规则（非自动求解参数）。"""

    consider_human: bool = Field(True, description="冲突检测是否考虑工位时间重叠")
    consider_equipment: bool = Field(True, description="冲突检测是否考虑设备")
    consider_material: bool = Field(True, description="是否提示物料齐套")
    consider_mold_tool: bool = Field(True, description="冲突检测是否考虑模具/工装")

    daily_capacity_hours: float = Field(24.0, ge=1.0, le=24.0, description="负荷计算基准每日工时")
    freeze_horizon_days: int = Field(2, ge=0, le=30, description="冻结窗口天数（窗口内禁止拖拽）")
    rolling_horizon_days: int = Field(14, ge=1, le=120, description="滚动关注窗口天数（看板展示）")
    setup_changeover_hours: float = Field(1.0, ge=0, le=12, description="换型切换参考工时（小时）")
    bottleneck_work_center_ids: List[int] = Field(default_factory=list, description="重点关注的工作中心ID")

    @model_validator(mode="before")
    @classmethod
    def coerce_legacy_payload(cls, data: Any):
        if isinstance(data, dict):
            return cls.strip_legacy_keys(data)
        return data

    @classmethod
    def strip_legacy_keys(cls, data: Any) -> dict:
        """从旧配置 JSON 中剥离已删除的自动排程字段。"""
        if not isinstance(data, dict):
            return {}
        legacy = {
            "priority_weight",
            "due_date_weight",
            "capacity_weight",
            "setup_time_weight",
            "optimize_objective",
            "scheduling_window_days",
            "bottleneck_first",
            "consider_setup_family",
            "local_reschedule_hours",
        }
        return {k: v for k, v in data.items() if k not in legacy}
