"""
排班执行 Schema 模块
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SchedulingExecutionBase(BaseModel):
    """排班执行基础 Schema"""
    
    plan_id: int = Field(..., description="排班计划ID（关联SchedulingPlan）")
    plan_no: str = Field(..., max_length=50, description="计划编号")
    execution_date: datetime = Field(..., description="执行日期")
    employee_id: int = Field(..., description="员工ID（关联master-data）")
    employee_name: str = Field(..., max_length=100, description="员工姓名")
    shift_type: str = Field(..., max_length=50, description="班次类型（早班、中班、晚班、其他）")
    start_time: datetime = Field(..., description="开始时间")
    end_time: datetime = Field(..., description="结束时间")
    work_hours: Optional[Decimal] = Field(None, description="工作时长（小时）")
    status: str = Field("已排班", max_length=20, description="状态（已排班、已执行、已取消）")


class SchedulingExecutionCreate(SchedulingExecutionBase):
    pass


class SchedulingExecutionUpdate(BaseModel):
    plan_id: Optional[int] = None
    plan_no: Optional[str] = Field(None, max_length=50)
    execution_date: Optional[datetime] = None
    employee_name: Optional[str] = Field(None, max_length=100)
    shift_type: Optional[str] = Field(None, max_length=50)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    work_hours: Optional[Decimal] = None
    status: Optional[str] = Field(None, max_length=20)


class SchedulingExecutionResponse(SchedulingExecutionBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

