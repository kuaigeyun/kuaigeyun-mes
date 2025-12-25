"""
投诉 Schema 模块

定义投诉数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class ComplaintBase(BaseModel):
    """投诉基础 Schema"""
    
    complaint_no: str = Field(..., max_length=50, description="投诉编号")
    customer_id: int = Field(..., description="客户ID（关联master-data）")
    complaint_type: str = Field(..., max_length=50, description="投诉类型")
    complaint_content: str = Field(..., description="投诉内容")
    handle_status: str = Field("待处理", max_length=20, description="处理状态")
    
    @validator("complaint_no")
    def validate_complaint_no(cls, v):
        """验证投诉编号格式"""
        if not v or not v.strip():
            raise ValueError("投诉编号不能为空")
        return v.strip().upper()
    
    @validator("complaint_content")
    def validate_complaint_content(cls, v):
        """验证投诉内容格式"""
        if not v or not v.strip():
            raise ValueError("投诉内容不能为空")
        return v.strip()


class ComplaintCreate(ComplaintBase):
    """创建投诉 Schema"""
    pass


class ComplaintUpdate(BaseModel):
    """更新投诉 Schema"""
    
    complaint_type: Optional[str] = Field(None, max_length=50, description="投诉类型")
    complaint_content: Optional[str] = Field(None, description="投诉内容")
    handle_status: Optional[str] = Field(None, max_length=20, description="处理状态")
    handle_result: Optional[str] = Field(None, description="处理结果")
    handle_time: Optional[datetime] = Field(None, description="处理时间")


class ComplaintResponse(ComplaintBase):
    """投诉响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    handle_result: Optional[str] = None
    handle_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
