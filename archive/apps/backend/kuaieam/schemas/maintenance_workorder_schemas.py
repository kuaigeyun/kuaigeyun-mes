"""
维护工单 Schema 模块

定义维护工单相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MaintenanceWorkOrderBase(BaseModel):
    """维护工单基础 Schema"""
    
    workorder_no: str = Field(..., max_length=100, description="工单编号")
    plan_id: Optional[int] = Field(None, description="维护计划ID")
    plan_uuid: Optional[str] = Field(None, max_length=36, description="维护计划UUID")
    equipment_id: int = Field(..., description="设备ID")
    equipment_name: str = Field(..., max_length=200, description="设备名称")
    workorder_type: str = Field(..., max_length=50, description="工单类型")
    maintenance_type: str = Field(..., max_length=50, description="维护类型")
    priority: str = Field("中", max_length=20, description="优先级")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    assigned_person_id: Optional[int] = Field(None, description="分配人员ID")
    assigned_person_name: Optional[str] = Field(None, max_length=100, description="分配人员姓名")
    executor_id: Optional[int] = Field(None, description="执行人员ID")
    executor_name: Optional[str] = Field(None, max_length=100, description="执行人员姓名")
    remark: Optional[str] = Field(None, description="备注")


class MaintenanceWorkOrderCreate(MaintenanceWorkOrderBase):
    """创建维护工单 Schema"""
    pass


class MaintenanceWorkOrderUpdate(BaseModel):
    """更新维护工单 Schema"""
    
    equipment_id: Optional[int] = Field(None, description="设备ID")
    equipment_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    workorder_type: Optional[str] = Field(None, max_length=50, description="工单类型")
    maintenance_type: Optional[str] = Field(None, max_length=50, description="维护类型")
    priority: Optional[str] = Field(None, max_length=20, description="优先级")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始时间")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束时间")
    assigned_person_id: Optional[int] = Field(None, description="分配人员ID")
    assigned_person_name: Optional[str] = Field(None, max_length=100, description="分配人员姓名")
    executor_id: Optional[int] = Field(None, description="执行人员ID")
    executor_name: Optional[str] = Field(None, max_length=100, description="执行人员姓名")
    status: Optional[str] = Field(None, max_length=50, description="工单状态")
    remark: Optional[str] = Field(None, description="备注")


class MaintenanceWorkOrderResponse(MaintenanceWorkOrderBase):
    """维护工单响应 Schema"""
    
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
