"""
安全隐患 Schema 模块

定义安全隐患数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SafetyHazardBase(BaseModel):
    """安全隐患基础 Schema"""
    
    hazard_no: str = Field(..., max_length=50, description="隐患编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("hazard_no")
    def validate_hazard_no(cls, v):
        """验证隐患编号格式"""
        if not v or not v.strip():
            raise ValueError("隐患编号不能为空")
        return v.strip()


class SafetyHazardCreate(SafetyHazardBase):
    """创建安全隐患 Schema"""
    pass


class SafetyHazardUpdate(BaseModel):
    """更新安全隐患 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class SafetyHazardResponse(SafetyHazardBase):
    """安全隐患响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
