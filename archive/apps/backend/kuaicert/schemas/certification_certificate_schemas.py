"""
认证证书 Schema 模块

定义认证证书数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class CertificationCertificateBase(BaseModel):
    """认证证书基础 Schema"""
    
    certificate_no: str = Field(..., max_length=50, description="证书编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("certificate_no")
    def validate_certificate_no(cls, v):
        """验证证书编号格式"""
        if not v or not v.strip():
            raise ValueError("证书编号不能为空")
        return v.strip()


class CertificationCertificateCreate(CertificationCertificateBase):
    """创建认证证书 Schema"""
    pass


class CertificationCertificateUpdate(BaseModel):
    """更新认证证书 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class CertificationCertificateResponse(CertificationCertificateBase):
    """认证证书响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
