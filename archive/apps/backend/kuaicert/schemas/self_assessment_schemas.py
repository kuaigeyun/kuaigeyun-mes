"""
自评打分 Schema 模块

定义自评打分数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SelfAssessmentBase(BaseModel):
    """自评打分基础 Schema"""
    
    assessment_no: str = Field(..., max_length=50, description="自评编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("assessment_no")
    def validate_assessment_no(cls, v):
        """验证自评编号格式"""
        if not v or not v.strip():
            raise ValueError("自评编号不能为空")
        return v.strip()


class SelfAssessmentCreate(SelfAssessmentBase):
    """创建自评打分 Schema"""
    pass


class SelfAssessmentUpdate(BaseModel):
    """更新自评打分 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class SelfAssessmentResponse(SelfAssessmentBase):
    """自评打分响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
