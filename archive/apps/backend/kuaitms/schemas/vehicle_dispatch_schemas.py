"""
车辆调度 Schema 模块

定义车辆调度相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class VehicleDispatchBase(BaseModel):
    """车辆调度基础 Schema"""
    
    dispatch_no: str = Field(..., max_length=100, description="调度单编号")
    vehicle_id: Optional[int] = Field(None, description="车辆ID")
    vehicle_no: Optional[str] = Field(None, max_length=50, description="车牌号")
    driver_id: Optional[int] = Field(None, description="司机ID")
    driver_name: Optional[str] = Field(None, max_length=100, description="司机姓名")
    plan_id: Optional[int] = Field(None, description="运输计划ID")
    plan_uuid: Optional[str] = Field(None, max_length=36, description="运输计划UUID")
    dispatch_date: Optional[datetime] = Field(None, description="调度日期")
    dispatch_type: Optional[str] = Field("正常调度", max_length=50, description="调度类型")
    remark: Optional[str] = Field(None, description="备注")


class VehicleDispatchCreate(VehicleDispatchBase):
    """创建车辆调度 Schema"""
    pass


class VehicleDispatchUpdate(BaseModel):
    """更新车辆调度 Schema"""
    
    vehicle_id: Optional[int] = Field(None, description="车辆ID")
    vehicle_no: Optional[str] = Field(None, max_length=50, description="车牌号")
    driver_id: Optional[int] = Field(None, description="司机ID")
    driver_name: Optional[str] = Field(None, max_length=100, description="司机姓名")
    dispatch_date: Optional[datetime] = Field(None, description="调度日期")
    dispatch_type: Optional[str] = Field(None, max_length=50, description="调度类型")
    status: Optional[str] = Field(None, max_length=50, description="调度状态")
    remark: Optional[str] = Field(None, description="备注")


class VehicleDispatchResponse(VehicleDispatchBase):
    """车辆调度响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

