"""
认证申请 Schema 模块

定义认证申请数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class CertificationApplicationBase(BaseModel):
    """认证申请基础 Schema"""
    
    application_no: str = Field(..., max_length=50, description="申请编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("application_no")
    def validate_application_no(cls, v):
        """验证申请编号格式"""
        if not v or not v.strip():
            raise ValueError("申请编号不能为空")
        return v.strip()


class CertificationApplicationCreate(CertificationApplicationBase):
    """创建认证申请 Schema"""
    pass


class CertificationApplicationUpdate(BaseModel):
    """更新认证申请 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class CertificationApplicationResponse(CertificationApplicationBase):
    """认证申请响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
