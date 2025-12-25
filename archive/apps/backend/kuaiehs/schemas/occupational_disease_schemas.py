"""
职业病 Schema 模块

定义职业病数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class OccupationalDiseaseBase(BaseModel):
    """职业病基础 Schema"""
    
    disease_no: str = Field(..., max_length=50, description="病案编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("disease_no")
    def validate_disease_no(cls, v):
        """验证病案编号格式"""
        if not v or not v.strip():
            raise ValueError("病案编号不能为空")
        return v.strip()


class OccupationalDiseaseCreate(OccupationalDiseaseBase):
    """创建职业病 Schema"""
    pass


class OccupationalDiseaseUpdate(BaseModel):
    """更新职业病 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class OccupationalDiseaseResponse(OccupationalDiseaseBase):
    """职业病响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
