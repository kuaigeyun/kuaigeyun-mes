"""
环保合规 Schema 模块

定义环保合规数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class EnvironmentalComplianceBase(BaseModel):
    """环保合规基础 Schema"""
    
    compliance_no: str = Field(..., max_length=50, description="合规编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("compliance_no")
    def validate_compliance_no(cls, v):
        """验证合规编号格式"""
        if not v or not v.strip():
            raise ValueError("合规编号不能为空")
        return v.strip()


class EnvironmentalComplianceCreate(EnvironmentalComplianceBase):
    """创建环保合规 Schema"""
    pass


class EnvironmentalComplianceUpdate(BaseModel):
    """更新环保合规 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class EnvironmentalComplianceResponse(EnvironmentalComplianceBase):
    """环保合规响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
