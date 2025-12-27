"""
项目风险 Schema 模块

定义项目风险数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProjectRiskBase(BaseModel):
    """项目风险基础 Schema"""
    
    risk_no: str = Field(..., max_length=50, description="风险编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("risk_no")
    def validate_risk_no(cls, v):
        """验证风险编号格式"""
        if not v or not v.strip():
            raise ValueError("风险编号不能为空")
        return v.strip()


class ProjectRiskCreate(ProjectRiskBase):
    """创建项目风险 Schema"""
    pass


class ProjectRiskUpdate(BaseModel):
    """更新项目风险 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ProjectRiskResponse(ProjectRiskBase):
    """项目风险响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
