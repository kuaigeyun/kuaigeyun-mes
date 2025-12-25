"""
ISO质量审核 Schema 模块

定义ISO质量审核相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class ISOAuditBase(BaseModel):
    """ISO质量审核基础 Schema"""
    
    audit_no: str = Field(..., max_length=50, description="审核编号")
    audit_type: str = Field(..., max_length=50, description="审核类型")
    iso_standard: Optional[str] = Field(None, max_length=100, description="ISO标准")
    audit_scope: Optional[str] = Field(None, description="审核范围")
    audit_date: Optional[datetime] = Field(None, description="审核日期")
    auditor_id: Optional[int] = Field(None, description="审核员ID")
    auditor_name: Optional[str] = Field(None, max_length=100, description="审核员姓名")
    audit_result: Optional[str] = Field(None, max_length=50, description="审核结果")
    findings: Optional[Any] = Field(None, description="审核发现（JSON）")
    remark: Optional[str] = Field(None, description="备注")


class ISOAuditCreate(ISOAuditBase):
    """创建ISO质量审核 Schema"""
    pass


class ISOAuditUpdate(BaseModel):
    """更新ISO质量审核 Schema"""
    
    audit_type: Optional[str] = Field(None, max_length=50, description="审核类型")
    iso_standard: Optional[str] = Field(None, max_length=100, description="ISO标准")
    audit_scope: Optional[str] = Field(None, description="审核范围")
    audit_date: Optional[datetime] = Field(None, description="审核日期")
    auditor_id: Optional[int] = Field(None, description="审核员ID")
    auditor_name: Optional[str] = Field(None, max_length=100, description="审核员姓名")
    audit_result: Optional[str] = Field(None, max_length=50, description="审核结果")
    findings: Optional[Any] = Field(None, description="审核发现（JSON）")
    status: Optional[str] = Field(None, max_length=50, description="审核状态")
    remark: Optional[str] = Field(None, description="备注")


class ISOAuditResponse(ISOAuditBase):
    """ISO质量审核响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
