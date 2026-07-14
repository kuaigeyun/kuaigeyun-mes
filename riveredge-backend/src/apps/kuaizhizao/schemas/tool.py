"""
工装 Schema 模块

定义工装及其生命周期记录相关的 Pydantic Schema。

Author: Antigravity
Date: 2026-02-02
"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator

from apps.kuaizhizao.constants.tool_status import validate_tool_status


# --- 工装基础 ---

class ToolBase(BaseModel):
    code: Optional[str] = Field(None, max_length=50, description="工装编码")
    name: str = Field(..., max_length=200, description="工装名称")
    type: Optional[str] = Field(None, max_length=50, description="类型")
    spec: Optional[str] = Field(None, max_length=200, description="规格型号")

    manufacturer: Optional[str] = Field(None, max_length=200, description="制造商")
    supplier: Optional[str] = Field(None, max_length=200, description="供应商")
    purchase_date: Optional[date] = Field(None, description="采购日期")
    warranty_expiry: Optional[date] = Field(None, description="保修到期日")

    storage_location: Optional[str] = Field(None, max_length=200, description="存放位置")
    maintenance_scheme_id: Optional[int] = Field(None, description="默认保养方案ID")
    repair_scheme_id: Optional[int] = Field(None, description="默认维修方案ID")
    allow_repeated_borrow: bool = Field(default=False, description="是否允许重复领用")

    status: str = Field(default="待启用", description="工装状态")
    is_active: bool = Field(default=True)

    maintenance_period: Optional[int] = Field(None, description="保养周期（天）")
    needs_calibration: bool = Field(default=False)
    calibration_period: Optional[int] = Field(None, description="校验周期（天）")

    description: Optional[str] = Field(None)
    attachments: Optional[List[dict]] = Field(None, description="附件列表")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        return validate_tool_status(v)


class ToolCreate(ToolBase):
    pass


class ToolUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    spec: Optional[str] = None
    storage_location: Optional[str] = None
    maintenance_scheme_id: Optional[int] = None
    repair_scheme_id: Optional[int] = None
    allow_repeated_borrow: Optional[bool] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    maintenance_period: Optional[int] = None
    needs_calibration: Optional[bool] = None
    calibration_period: Optional[int] = None
    description: Optional[str] = None
    attachments: Optional[List[dict]] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return validate_tool_status(v)


class ToolResponse(ToolBase):
    model_config = ConfigDict(from_attributes=True)

    uuid: str
    id: int
    tenant_id: int
    last_maintenance_date: Optional[date] = None
    next_maintenance_date: Optional[date] = None
    last_calibration_date: Optional[date] = None
    next_calibration_date: Optional[date] = None
    total_usage_count: int
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# --- 领用记录（遗留，运营单据见 tool_ops） ---

class ToolUsageBase(BaseModel):
    tool_uuid: str
    usage_no: Optional[str] = Field(None, description="领用单号")
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    department_name: Optional[str] = None
    source_type: Optional[str] = None
    source_no: Optional[str] = None
    checkout_date: datetime = Field(default_factory=datetime.now)
    checkin_date: Optional[datetime] = None
    status: str = Field(default="使用中")
    remark: Optional[str] = None
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class ToolUsageCreate(ToolUsageBase):
    pass


class ToolUsageResponse(ToolUsageBase):
    model_config = ConfigDict(from_attributes=True)
    uuid: str
    id: int
    tenant_id: int
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
    created_at: datetime


# --- 维保记录（遗留） ---

class ToolMaintenanceBase(BaseModel):
    tool_uuid: str
    maintenance_type: str = Field(..., description="日常保养、定期保养、故障维修")
    maintenance_date: date
    executor: Optional[str] = None
    content: Optional[str] = None
    result: str = Field(default="完成")
    cost: float = Field(default=0.0)
    remark: Optional[str] = None
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class ToolMaintenanceCreate(ToolMaintenanceBase):
    pass


class ToolMaintenanceResponse(ToolMaintenanceBase):
    model_config = ConfigDict(from_attributes=True)
    uuid: str
    id: int
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
    created_at: datetime


# --- 校验记录（遗留） ---

class ToolCalibrationBase(BaseModel):
    tool_uuid: str
    calibration_date: date
    calibration_org: Optional[str] = None
    certificate_no: Optional[str] = None
    result: str = Field(..., description="合格、不合格、准用")
    expiry_date: Optional[date] = None
    attachment_uuid: Optional[str] = None
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    remark: Optional[str] = None


class ToolCalibrationCreate(ToolCalibrationBase):
    pass


class ToolCalibrationResponse(ToolCalibrationBase):
    model_config = ConfigDict(from_attributes=True)
    uuid: str
    id: int
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None


# --- 列表包装 ---

class ToolListResponse(BaseModel):
    items: List[ToolResponse]
    total: int


class ToolUsageListResponse(BaseModel):
    items: List[ToolUsageResponse]
    total: int
    skip: int = 0
    limit: int = 100


class ToolMaintenanceListResponse(BaseModel):
    items: List[ToolMaintenanceResponse]
    total: int
    skip: int = 0
    limit: int = 100


class ToolCalibrationListResponse(BaseModel):
    items: List[ToolCalibrationResponse]
    total: int
    skip: int = 0
    limit: int = 100


class ToolMaintenanceReminderResponse(BaseModel):
    """工装保养提醒（方案触发 + 使用次数/按天）"""
    tool_uuid: str
    tool_code: str
    tool_name: str
    trigger_type: str = Field(..., description="days/usage_count")
    total_usage_count: Optional[int] = None
    maintenance_interval: Optional[int] = None
    next_maintenance_at_count: Optional[int] = None
    usages_until_due: Optional[int] = None
    last_maintenance_date: Optional[date] = None
    days_since_maintenance: Optional[int] = None
    trigger_interval_days: Optional[int] = None
    reminder_type: str = Field(..., description="due_soon/overdue")


class ToolMaintenanceReminderListResponse(BaseModel):
    items: List[ToolMaintenanceReminderResponse]
    total: int
    skip: int = 0
    limit: int = 100


class ToolCalibrationReminderResponse(BaseModel):
    """工装校准到期提醒"""
    tool_uuid: str
    tool_code: str
    tool_name: str
    reminder_type: str = Field(default="calibration", description="calibration")
    due_type: str = Field(..., description="due_soon/overdue")
    due_date: date
    days_until_due: int
    calibration_period: Optional[int] = None
    last_calibration_date: Optional[date] = None


class ToolCalibrationReminderListResponse(BaseModel):
    items: List[ToolCalibrationReminderResponse]
    total: int
    skip: int = 0
    limit: int = 100
