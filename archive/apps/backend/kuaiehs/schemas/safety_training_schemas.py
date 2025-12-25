"""
安全培训 Schema 模块

定义安全培训数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class SafetyTrainingBase(BaseModel):
    """安全培训基础 Schema"""
    
    training_no: str = Field(..., max_length=50, description="培训编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("training_no")
    def validate_training_no(cls, v):
        """验证培训编号格式"""
        if not v or not v.strip():
            raise ValueError("培训编号不能为空")
        return v.strip()


class SafetyTrainingCreate(SafetyTrainingBase):
    """创建安全培训 Schema"""
    pass


class SafetyTrainingUpdate(BaseModel):
    """更新安全培训 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class SafetyTrainingResponse(SafetyTrainingBase):
    """安全培训响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
