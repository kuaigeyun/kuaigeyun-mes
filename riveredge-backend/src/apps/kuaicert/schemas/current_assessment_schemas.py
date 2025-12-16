"""
现状评估 Schema 模块

定义现状评估数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class CurrentAssessmentBase(BaseModel):
    """现状评估基础 Schema"""
    
    assessment_no: str = Field(..., max_length=50, description="评估编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("assessment_no")
    def validate_assessment_no(cls, v):
        """验证评估编号格式"""
        if not v or not v.strip():
            raise ValueError("评估编号不能为空")
        return v.strip()


class CurrentAssessmentCreate(CurrentAssessmentBase):
    """创建现状评估 Schema"""
    pass


class CurrentAssessmentUpdate(BaseModel):
    """更新现状评估 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class CurrentAssessmentResponse(CurrentAssessmentBase):
    """现状评估响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
