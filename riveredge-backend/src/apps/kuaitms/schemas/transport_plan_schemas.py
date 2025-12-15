"""
运输计划 Schema 模块

定义运输计划相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class TransportPlanBase(BaseModel):
    """运输计划基础 Schema"""
    
    plan_no: str = Field(..., max_length=100, description="计划编号")
    plan_name: str = Field(..., max_length=200, description="计划名称")
    vehicle_id: Optional[int] = Field(None, description="车辆ID")
    vehicle_no: Optional[str] = Field(None, max_length=50, description="车牌号")
    driver_id: Optional[int] = Field(None, description="司机ID")
    driver_name: Optional[str] = Field(None, max_length=100, description="司机姓名")
    route_info: Optional[Any] = Field(None, description="路线信息")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    remark: Optional[str] = Field(None, description="备注")


class TransportPlanCreate(TransportPlanBase):
    """创建运输计划 Schema"""
    pass


class TransportPlanUpdate(BaseModel):
    """更新运输计划 Schema"""
    
    plan_name: Optional[str] = Field(None, max_length=200, description="计划名称")
    vehicle_id: Optional[int] = Field(None, description="车辆ID")
    vehicle_no: Optional[str] = Field(None, max_length=50, description="车牌号")
    driver_id: Optional[int] = Field(None, description="司机ID")
    driver_name: Optional[str] = Field(None, max_length=100, description="司机姓名")
    route_info: Optional[Any] = Field(None, description="路线信息")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始时间")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束时间")
    status: Optional[str] = Field(None, max_length=50, description="计划状态")
    remark: Optional[str] = Field(None, description="备注")


class TransportPlanResponse(TransportPlanBase):
    """运输计划响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    actual_start_date: Optional[datetime]
    actual_end_date: Optional[datetime]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

