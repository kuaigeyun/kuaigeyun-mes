"""
维护计划 Schema 模块

定义维护计划相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MaintenancePlanBase(BaseModel):
    """维护计划基础 Schema"""
    
    plan_no: str = Field(..., max_length=100, description="维护计划编号")
    plan_name: str = Field(..., max_length=200, description="计划名称")
    equipment_id: int = Field(..., description="设备ID")
    equipment_name: str = Field(..., max_length=200, description="设备名称")
    plan_type: str = Field(..., max_length=50, description="计划类型")
    maintenance_type: str = Field(..., max_length=50, description="维护类型")
    cycle_type: Optional[str] = Field(None, max_length=50, description="周期类型")
    cycle_value: Optional[int] = Field(None, description="周期值")
    cycle_unit: Optional[str] = Field(None, max_length=20, description="周期单位")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID")
    responsible_person_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    remark: Optional[str] = Field(None, description="备注")


class MaintenancePlanCreate(MaintenancePlanBase):
    """创建维护计划 Schema"""
    pass


class MaintenancePlanUpdate(BaseModel):
    """更新维护计划 Schema"""
    
    plan_name: Optional[str] = Field(None, max_length=200, description="计划名称")
    equipment_id: Optional[int] = Field(None, description="设备ID")
    equipment_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    plan_type: Optional[str] = Field(None, max_length=50, description="计划类型")
    maintenance_type: Optional[str] = Field(None, max_length=50, description="维护类型")
    cycle_type: Optional[str] = Field(None, max_length=50, description="周期类型")
    cycle_value: Optional[int] = Field(None, description="周期值")
    cycle_unit: Optional[str] = Field(None, max_length=20, description="周期单位")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID")
    responsible_person_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    status: Optional[str] = Field(None, max_length=50, description="计划状态")
    remark: Optional[str] = Field(None, description="备注")


class MaintenancePlanResponse(MaintenancePlanBase):
    """维护计划响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
