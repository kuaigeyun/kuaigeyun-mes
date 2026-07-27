"""滚动计划 API Schema。"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class RollingScheduleCloseDayRequest(BaseSchema):
    plan_date: date = Field(..., description="待关账的计划工作日")


class RollingScheduleGenerateRequest(BaseSchema):
    base_date: Optional[date] = Field(None, description="基准日（默认今天）；生成其下一工作日计划")
    backlog_readiness_threshold: float = Field(
        80.0,
        ge=0,
        le=100,
        description="backlog 候选最低齐套率",
    )


class RollingScheduleLineInput(BaseSchema):
    work_order_id: int = Field(..., description="工单ID")
    sequence: int = Field(..., ge=0, description="排序序号")
    planned_quantity: Optional[Decimal] = Field(None, description="计划数量")
    source_type: str = Field("manual", description="来源类型")
    remarks: Optional[str] = Field(None, description="备注")


class RollingScheduleUpdateLinesRequest(BaseSchema):
    lines: List[RollingScheduleLineInput] = Field(..., description="计划行（全量替换）")


class RollingScheduleSyncFromApsRequest(BaseSchema):
    plan_date: date = Field(..., description="滚动计划日（锚点）")
    work_order_ids: List[int] = Field(..., min_length=1, description="APS 确认涉及的工单ID")


class RollingScheduleLineResponse(BaseSchema):
    id: int
    work_order_id: int
    sequence: int
    planned_quantity: Optional[Decimal] = None
    source_type: str
    readiness_rate_snapshot: Optional[Decimal] = None
    remarks: Optional[str] = None
    work_order_code: Optional[str] = None
    work_order_name: Optional[str] = None
    work_order_status: Optional[str] = None
    quantity: Optional[Decimal] = None
    completed_quantity: Optional[Decimal] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    scheduling_score: Optional[float] = None
    scheduling_rank_band: Optional[str] = None
    scheduling_diagnostics: List[str] = Field(default_factory=list, description="排产缺失诊断摘要")


class RollingScheduleCapacityAdvisory(BaseSchema):
    plan_date: date
    daily_capacity_hours: float
    station_count: int
    available_hours: float
    required_hours: float
    utilization_rate: float
    overloaded: bool
    message: str


class RollingSchedulePlanResponse(BaseSchema):
    id: int
    uuid: str
    plan_code: str
    plan_date: date
    status: str
    prev_plan_date: Optional[date] = None
    closed_at: Optional[datetime] = None
    close_summary: Optional[Dict[str, Any]] = None
    published_at: Optional[datetime] = None
    published_by: Optional[int] = None
    capacity_advisory: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    lines: List[RollingScheduleLineResponse] = Field(default_factory=list)


class RollingScheduleCloseSummary(BaseSchema):
    plan_date: date
    planned_count: int = 0
    completed_count: int = 0
    partial_count: int = 0
    not_started_count: int = 0
    planned_quantity: float = 0
    completed_quantity: float = 0
    completion_rate: float = 0
    delayed_count: int = 0
    incomplete_items: List[Dict[str, Any]] = Field(default_factory=list)


class RollingScheduleNextWorkdayResponse(BaseSchema):
    base_date: date
    next_workday: date


class RollingSchedulePublishResult(BaseSchema):
    plan: RollingSchedulePlanResponse
    batch_update: Dict[str, Any] = Field(default_factory=dict)
