"""
排放管理 Schema 模块

定义排放管理数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class EmissionManagementBase(BaseModel):
    """排放管理基础 Schema"""
    
    emission_no: str = Field(..., max_length=50, description="排放编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("emission_no")
    def validate_emission_no(cls, v):
        """验证排放编号格式"""
        if not v or not v.strip():
            raise ValueError("排放编号不能为空")
        return v.strip()


class EmissionManagementCreate(EmissionManagementBase):
    """创建排放管理 Schema"""
    pass


class EmissionManagementUpdate(BaseModel):
    """更新排放管理 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class EmissionManagementResponse(EmissionManagementBase):
    """排放管理响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
