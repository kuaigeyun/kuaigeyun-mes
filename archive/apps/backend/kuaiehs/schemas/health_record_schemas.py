"""
健康档案 Schema 模块

定义健康档案数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class HealthRecordBase(BaseModel):
    """健康档案基础 Schema"""
    
    record_no: str = Field(..., max_length=50, description="档案编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("record_no")
    def validate_record_no(cls, v):
        """验证档案编号格式"""
        if not v or not v.strip():
            raise ValueError("档案编号不能为空")
        return v.strip()


class HealthRecordCreate(HealthRecordBase):
    """创建健康档案 Schema"""
    pass


class HealthRecordUpdate(BaseModel):
    """更新健康档案 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class HealthRecordResponse(HealthRecordBase):
    """健康档案响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
