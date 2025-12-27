"""
法规 Schema 模块

定义法规数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class RegulationBase(BaseModel):
    """法规基础 Schema"""
    
    regulation_no: str = Field(..., max_length=50, description="法规编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("regulation_no")
    def validate_regulation_no(cls, v):
        """验证法规编号格式"""
        if not v or not v.strip():
            raise ValueError("法规编号不能为空")
        return v.strip()


class RegulationCreate(RegulationBase):
    """创建法规 Schema"""
    pass


class RegulationUpdate(BaseModel):
    """更新法规 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class RegulationResponse(RegulationBase):
    """法规响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
