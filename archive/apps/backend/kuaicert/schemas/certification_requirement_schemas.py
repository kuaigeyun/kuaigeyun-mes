"""
认证要求 Schema 模块

定义认证要求数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class CertificationRequirementBase(BaseModel):
    """认证要求基础 Schema"""
    
    requirement_no: str = Field(..., max_length=50, description="要求编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("requirement_no")
    def validate_requirement_no(cls, v):
        """验证要求编号格式"""
        if not v or not v.strip():
            raise ValueError("要求编号不能为空")
        return v.strip()


class CertificationRequirementCreate(CertificationRequirementBase):
    """创建认证要求 Schema"""
    pass


class CertificationRequirementUpdate(BaseModel):
    """更新认证要求 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class CertificationRequirementResponse(CertificationRequirementBase):
    """认证要求响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
