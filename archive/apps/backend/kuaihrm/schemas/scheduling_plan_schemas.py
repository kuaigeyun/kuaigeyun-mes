"""
排班计划 Schema 模块
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class SchedulingPlanBase(BaseModel):
    """排班计划基础 Schema"""
    
    plan_no: str = Field(..., max_length=50, description="计划编号（组织内唯一）")
    plan_name: str = Field(..., max_length=200, description="计划名称")
    plan_period: str = Field(..., max_length=20, description="计划期间（格式：2024-01）")
    start_date: datetime = Field(..., description="开始日期")
    end_date: datetime = Field(..., description="结束日期")
    department_id: Optional[int] = Field(None, description="部门ID（关联master-data）")
    status: str = Field("草稿", max_length=20, description="状态（草稿、已发布、已执行、已取消）")
    
    @validator("plan_no")
    def validate_plan_no(cls, v):
        if not v or not v.strip():
            raise ValueError("计划编号不能为空")
        return v.strip()


class SchedulingPlanCreate(SchedulingPlanBase):
    pass


class SchedulingPlanUpdate(BaseModel):
    plan_name: Optional[str] = Field(None, max_length=200)
    plan_period: Optional[str] = Field(None, max_length=20)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    department_id: Optional[int] = None
    status: Optional[str] = Field(None, max_length=20)


class SchedulingPlanResponse(SchedulingPlanBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

