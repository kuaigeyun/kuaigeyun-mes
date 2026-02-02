"""
工装 Schema 模块

定义工装及其生命周期记录相关的 Pydantic Schema。

Author: Antigravity
Date: 2026-02-02
"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator


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
    
    status: str = Field(default="正常", description="状态（正常、领用中、维修中、校验中、停用、报废）")
    is_active: bool = Field(default=True)
    
    maintenance_period: Optional[int] = Field(None, description="保养周期（天）")
    needs_calibration: bool = Field(default=False)
    calibration_period: Optional[int] = Field(None, description="校验周期（天）")
    
    description: Optional[str] = Field(None)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = ["正常", "领用中", "维修中", "校验中", "停用", "报废"]
        if v not in allowed:
            raise ValueError(f"状态必须是 {allowed} 之一")
        return v


class ToolCreate(ToolBase):
    pass


class ToolUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    spec: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    maintenance_period: Optional[int] = None
    needs_calibration: Optional[bool] = None
    calibration_period: Optional[int] = None
    description: Optional[str] = None


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
    created_at: datetime
    updated_at: datetime


# --- 领用记录 ---

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


class ToolUsageCreate(ToolUsageBase):
    pass


class ToolUsageResponse(ToolUsageBase):
    model_config = ConfigDict(from_attributes=True)
    uuid: str
    id: int
    tenant_id: int
    created_at: datetime


# --- 维保记录 ---

class ToolMaintenanceBase(BaseModel):
    tool_uuid: str
    maintenance_type: str = Field(..., description="日常保养、定期保养、故障维修")
    maintenance_date: date
    executor: Optional[str] = None
    content: Optional[str] = None
    result: str = Field(default="完成")
    cost: float = Field(default=0.0)
    remark: Optional[str] = None


class ToolMaintenanceCreate(ToolMaintenanceBase):
    pass


class ToolMaintenanceResponse(ToolMaintenanceBase):
    model_config = ConfigDict(from_attributes=True)
    uuid: str
    id: int
    created_at: datetime


# --- 校验记录 ---

class ToolCalibrationBase(BaseModel):
    tool_uuid: str
    calibration_date: date
    calibration_org: Optional[str] = None
    certificate_no: Optional[str] = None
    result: str = Field(..., description="合格、不合格、准用")
    expiry_date: Optional[date] = None
    attachment_uuid: Optional[str] = None
    remark: Optional[str] = None


class ToolCalibrationCreate(ToolCalibrationBase):
    pass


class ToolCalibrationResponse(ToolCalibrationBase):
    model_config = ConfigDict(from_attributes=True)
    uuid: str
    id: int
    created_at: datetime


# --- 列表包装 ---

class ToolListResponse(BaseModel):
    items: List[ToolResponse]
    total: int
