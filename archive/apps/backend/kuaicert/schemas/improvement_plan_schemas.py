"""
改进计划 Schema 模块

定义改进计划数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ImprovementPlanBase(BaseModel):
    """改进计划基础 Schema"""
    
    plan_no: str = Field(..., max_length=50, description="计划编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("plan_no")
    def validate_plan_no(cls, v):
        """验证计划编号格式"""
        if not v or not v.strip():
            raise ValueError("计划编号不能为空")
        return v.strip()


class ImprovementPlanCreate(ImprovementPlanBase):
    """创建改进计划 Schema"""
    pass


class ImprovementPlanUpdate(BaseModel):
    """更新改进计划 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ImprovementPlanResponse(ImprovementPlanBase):
    """改进计划响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
