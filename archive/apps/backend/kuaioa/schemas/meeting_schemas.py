"""
会议 Schema 模块

定义会议数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class MeetingBase(BaseModel):
    """会议基础 Schema"""
    
    meeting_no: str = Field(..., max_length=50, description="会议编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("meeting_no")
    def validate_meeting_no(cls, v):
        """验证会议编号格式"""
        if not v or not v.strip():
            raise ValueError("会议编号不能为空")
        return v.strip()


class MeetingCreate(MeetingBase):
    """创建会议 Schema"""
    pass


class MeetingUpdate(BaseModel):
    """更新会议 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class MeetingResponse(MeetingBase):
    """会议响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
