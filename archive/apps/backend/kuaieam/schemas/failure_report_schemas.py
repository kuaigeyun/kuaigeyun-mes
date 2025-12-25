"""
故障报修 Schema 模块

定义故障报修相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class FailureReportBase(BaseModel):
    """故障报修基础 Schema"""
    
    report_no: str = Field(..., max_length=100, description="报修单编号")
    equipment_id: int = Field(..., description="设备ID")
    equipment_name: str = Field(..., max_length=200, description="设备名称")
    failure_type: str = Field(..., max_length=50, description="故障类型")
    failure_level: str = Field("一般", max_length=20, description="故障等级")
    failure_description: str = Field(..., description="故障描述")
    reporter_id: Optional[int] = Field(None, description="报修人ID")
    reporter_name: Optional[str] = Field(None, max_length=100, description="报修人姓名")
    report_date: datetime = Field(..., description="报修日期")
    assigned_person_id: Optional[int] = Field(None, description="分配人员ID")
    assigned_person_name: Optional[str] = Field(None, max_length=100, description="分配人员姓名")
    assigned_date: Optional[datetime] = Field(None, description="分配日期")
    remark: Optional[str] = Field(None, description="备注")


class FailureReportCreate(FailureReportBase):
    """创建故障报修 Schema"""
    pass


class FailureReportUpdate(BaseModel):
    """更新故障报修 Schema"""
    
    equipment_id: Optional[int] = Field(None, description="设备ID")
    equipment_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    failure_type: Optional[str] = Field(None, max_length=50, description="故障类型")
    failure_level: Optional[str] = Field(None, max_length=20, description="故障等级")
    failure_description: Optional[str] = Field(None, description="故障描述")
    assigned_person_id: Optional[int] = Field(None, description="分配人员ID")
    assigned_person_name: Optional[str] = Field(None, max_length=100, description="分配人员姓名")
    assigned_date: Optional[datetime] = Field(None, description="分配日期")
    status: Optional[str] = Field(None, max_length=50, description="报修状态")
    remark: Optional[str] = Field(None, description="备注")


class FailureReportResponse(FailureReportBase):
    """故障报修响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
