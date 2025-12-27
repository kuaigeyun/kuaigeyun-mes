"""
公告 Schema 模块

定义公告数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class NoticeBase(BaseModel):
    """公告基础 Schema"""
    
    notice_no: str = Field(..., max_length=50, description="公告编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("notice_no")
    def validate_notice_no(cls, v):
        """验证公告编号格式"""
        if not v or not v.strip():
            raise ValueError("公告编号不能为空")
        return v.strip()


class NoticeCreate(NoticeBase):
    """创建公告 Schema"""
    pass


class NoticeUpdate(BaseModel):
    """更新公告 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class NoticeResponse(NoticeBase):
    """公告响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
