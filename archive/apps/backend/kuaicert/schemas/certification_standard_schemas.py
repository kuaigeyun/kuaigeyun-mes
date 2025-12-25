"""
认证标准 Schema 模块

定义认证标准数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class CertificationStandardBase(BaseModel):
    """认证标准基础 Schema"""
    
    standard_no: str = Field(..., max_length=50, description="标准编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("standard_no")
    def validate_standard_no(cls, v):
        """验证标准编号格式"""
        if not v or not v.strip():
            raise ValueError("标准编号不能为空")
        return v.strip()


class CertificationStandardCreate(CertificationStandardBase):
    """创建认证标准 Schema"""
    pass


class CertificationStandardUpdate(BaseModel):
    """更新认证标准 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class CertificationStandardResponse(CertificationStandardBase):
    """认证标准响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
