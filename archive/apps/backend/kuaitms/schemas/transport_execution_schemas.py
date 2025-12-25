"""
运输执行 Schema 模块

定义运输执行相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TransportExecutionBase(BaseModel):
    """运输执行基础 Schema"""
    
    execution_no: str = Field(..., max_length=100, description="执行单编号")
    plan_id: Optional[int] = Field(None, description="运输计划ID")
    plan_uuid: Optional[str] = Field(None, max_length=36, description="运输计划UUID")
    vehicle_id: Optional[int] = Field(None, description="车辆ID")
    vehicle_no: Optional[str] = Field(None, max_length=50, description="车牌号")
    driver_id: Optional[int] = Field(None, description="司机ID")
    driver_name: Optional[str] = Field(None, max_length=100, description="司机姓名")
    loading_date: Optional[datetime] = Field(None, description="装车日期")
    loading_status: Optional[str] = Field("待装车", max_length=50, description="装车状态")
    departure_date: Optional[datetime] = Field(None, description="发车日期")
    current_location: Optional[str] = Field(None, max_length=200, description="当前位置")
    tracking_status: Optional[str] = Field("待发车", max_length=50, description="跟踪状态")
    arrival_date: Optional[datetime] = Field(None, description="到达日期")
    sign_date: Optional[datetime] = Field(None, description="签收日期")
    sign_person: Optional[str] = Field(None, max_length=100, description="签收人")
    sign_status: Optional[str] = Field("待签收", max_length=50, description="签收状态")
    remark: Optional[str] = Field(None, description="备注")


class TransportExecutionCreate(TransportExecutionBase):
    """创建运输执行 Schema"""
    pass


class TransportExecutionUpdate(BaseModel):
    """更新运输执行 Schema"""
    
    loading_date: Optional[datetime] = Field(None, description="装车日期")
    loading_status: Optional[str] = Field(None, max_length=50, description="装车状态")
    departure_date: Optional[datetime] = Field(None, description="发车日期")
    current_location: Optional[str] = Field(None, max_length=200, description="当前位置")
    tracking_status: Optional[str] = Field(None, max_length=50, description="跟踪状态")
    arrival_date: Optional[datetime] = Field(None, description="到达日期")
    sign_date: Optional[datetime] = Field(None, description="签收日期")
    sign_person: Optional[str] = Field(None, max_length=100, description="签收人")
    sign_status: Optional[str] = Field(None, max_length=50, description="签收状态")
    status: Optional[str] = Field(None, max_length=50, description="执行状态")
    remark: Optional[str] = Field(None, description="备注")


class TransportExecutionResponse(TransportExecutionBase):
    """运输执行响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

