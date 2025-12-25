"""
线索 Schema 模块

定义线索数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class LeadBase(BaseModel):
    """线索基础 Schema"""
    
    lead_no: str = Field(..., max_length=50, description="线索编号")
    lead_source: str = Field(..., max_length=50, description="线索来源")
    status: str = Field("新线索", max_length=20, description="线索状态")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    contact_name: Optional[str] = Field(None, max_length=100, description="联系人")
    contact_phone: Optional[str] = Field(None, max_length=20, description="联系电话")
    contact_email: Optional[str] = Field(None, max_length=100, description="联系邮箱")
    address: Optional[str] = Field(None, description="地址")
    score: int = Field(0, ge=0, le=100, description="线索评分")
    assigned_to: Optional[int] = Field(None, description="分配给（用户ID）")
    
    @validator("lead_no")
    def validate_lead_no(cls, v):
        """验证线索编号格式"""
        if not v or not v.strip():
            raise ValueError("线索编号不能为空")
        return v.strip().upper()
    
    @validator("customer_name")
    def validate_customer_name(cls, v):
        """验证客户名称格式"""
        if not v or not v.strip():
            raise ValueError("客户名称不能为空")
        return v.strip()


class LeadCreate(LeadBase):
    """创建线索 Schema"""
    pass


class LeadUpdate(BaseModel):
    """更新线索 Schema"""
    
    lead_source: Optional[str] = Field(None, max_length=50, description="线索来源")
    status: Optional[str] = Field(None, max_length=20, description="线索状态")
    customer_name: Optional[str] = Field(None, max_length=200, description="客户名称")
    contact_name: Optional[str] = Field(None, max_length=100, description="联系人")
    contact_phone: Optional[str] = Field(None, max_length=20, description="联系电话")
    contact_email: Optional[str] = Field(None, max_length=100, description="联系邮箱")
    address: Optional[str] = Field(None, description="地址")
    score: Optional[int] = Field(None, ge=0, le=100, description="线索评分")
    assigned_to: Optional[int] = Field(None, description="分配给（用户ID）")
    convert_status: Optional[str] = Field(None, max_length=20, description="转化状态")
    convert_reason: Optional[str] = Field(None, description="转化原因")


class LeadResponse(LeadBase):
    """线索响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    convert_status: Optional[str] = None
    convert_time: Optional[datetime] = None
    convert_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
