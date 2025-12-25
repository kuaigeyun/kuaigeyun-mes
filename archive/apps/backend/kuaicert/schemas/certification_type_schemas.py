"""
认证类型 Schema 模块

定义认证类型数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class CertificationTypeBase(BaseModel):
    """认证类型基础 Schema"""
    
    type_code: str = Field(..., max_length=50, description="类型编码（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("type_code")
    def validate_type_code(cls, v):
        """验证类型编码格式"""
        if not v or not v.strip():
            raise ValueError("类型编码不能为空")
        return v.strip()


class CertificationTypeCreate(CertificationTypeBase):
    """创建认证类型 Schema"""
    pass


class CertificationTypeUpdate(BaseModel):
    """更新认证类型 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class CertificationTypeResponse(CertificationTypeBase):
    """认证类型响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
