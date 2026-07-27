"""工作日历 Schema"""

from datetime import date, datetime, time
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _normalize_time(v):
    if v is None or v == "":
        return None
    if isinstance(v, time):
        return v.replace(microsecond=0)
    text = str(v).strip()
    parts = text.split(":")
    if len(parts) < 2:
        raise ValueError("时间须为 HH:MM")
    return time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)


class WorkCalendarConfigUpdate(BaseModel):
    work_day_start: time = Field(..., alias="workDayStart")
    work_day_end: time = Field(..., alias="workDayEnd")
    break_start: Optional[time] = Field(None, alias="breakStart")
    break_end: Optional[time] = Field(None, alias="breakEnd")
    window_source: str = Field("fixed", alias="windowSource", description="fixed|shift")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("window_source", mode="before")
    @classmethod
    def normalize_window_source(cls, v):
        raw = str(v or "fixed").strip().lower()
        if raw not in {"fixed", "shift"}:
            raise ValueError("windowSource 须为 fixed 或 shift")
        return raw

    @field_validator("work_day_start", "work_day_end", "break_start", "break_end", mode="before")
    @classmethod
    def parse_time(cls, v):
        if v is None or v == "":
            return None
        return _normalize_time(v)

    @model_validator(mode="after")
    def validate_range(self):
        if self.work_day_end <= self.work_day_start:
            raise ValueError("workDayEnd 必须晚于 workDayStart")
        has_bs = self.break_start is not None
        has_be = self.break_end is not None
        if has_bs != has_be:
            raise ValueError("休息时段须同时配置 breakStart 与 breakEnd")
        if has_bs and has_be:
            assert self.break_start is not None and self.break_end is not None
            if not (self.work_day_start <= self.break_start < self.break_end <= self.work_day_end):
                raise ValueError("休息时段须落在工作时段内")
        return self


class WorkCalendarConfigResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    work_day_start: time = Field(..., alias="workDayStart")
    work_day_end: time = Field(..., alias="workDayEnd")
    break_start: Optional[time] = Field(None, alias="breakStart")
    break_end: Optional[time] = Field(None, alias="breakEnd")
    window_source: str = Field("fixed", alias="windowSource")
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class OvertimePlanCreate(BaseModel):
    overtime_date: date = Field(..., alias="overtimeDate")
    start_time: time = Field(..., alias="startTime")
    end_time: time = Field(..., alias="endTime")
    name: Optional[str] = None
    is_active: bool = Field(True, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def parse_time(cls, v):
        return _normalize_time(v)

    @model_validator(mode="after")
    def validate_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("endTime 必须晚于 startTime（加班窗口不跨日）")
        if self.name is not None:
            self.name = self.name.strip() or None
        return self


class OvertimePlanUpdate(BaseModel):
    overtime_date: Optional[date] = Field(None, alias="overtimeDate")
    start_time: Optional[time] = Field(None, alias="startTime")
    end_time: Optional[time] = Field(None, alias="endTime")
    name: Optional[str] = None
    is_active: Optional[bool] = Field(None, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def parse_time(cls, v):
        if v is None or v == "":
            return None
        return _normalize_time(v)


class OvertimePlanResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    overtime_date: date = Field(..., alias="overtimeDate")
    start_time: time = Field(..., alias="startTime")
    end_time: time = Field(..., alias="endTime")
    name: Optional[str] = None
    is_active: bool = Field(..., alias="isActive")
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class EffectiveCalendarResponse(BaseModel):
    """APS 一次拉取的有效日历。"""

    config: WorkCalendarConfigResponse
    holiday_dates: List[date] = Field(default_factory=list, alias="holidayDates")
    overtime_by_date: Dict[str, List[Dict[str, str]]] = Field(
        default_factory=dict, alias="overtimeByDate"
    )
    day_windows_by_date: Dict[str, List[Dict[str, str]]] = Field(
        default_factory=dict,
        alias="dayWindowsByDate",
        description="班次模式下按日基础窗；fixed 时为空",
    )

    model_config = ConfigDict(populate_by_name=True)


class StationUnavailableWindowCreate(BaseModel):
    station_id: int = Field(..., alias="stationId")
    start_at: datetime = Field(..., alias="startAt")
    end_at: datetime = Field(..., alias="endAt")
    reason: Optional[str] = None
    is_active: bool = Field(True, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def validate_range(self):
        if self.end_at <= self.start_at:
            raise ValueError("endAt 必须晚于 startAt")
        if self.reason is not None:
            self.reason = self.reason.strip() or None
        return self


class StationUnavailableWindowUpdate(BaseModel):
    station_id: Optional[int] = Field(None, alias="stationId")
    start_at: Optional[datetime] = Field(None, alias="startAt")
    end_at: Optional[datetime] = Field(None, alias="endAt")
    reason: Optional[str] = None
    is_active: Optional[bool] = Field(None, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)


class StationUnavailableWindowResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    station_id: int = Field(..., alias="stationId")
    start_at: datetime = Field(..., alias="startAt")
    end_at: datetime = Field(..., alias="endAt")
    reason: Optional[str] = None
    is_active: bool = Field(..., alias="isActive")
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
