"""
会议纪要 Schema 模块

定义会议纪要数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class MeetingMinutesBase(BaseModel):
    """会议纪要基础 Schema"""
    
    minutes_no: str = Field(..., max_length=50, description="纪要编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("minutes_no")
    def validate_minutes_no(cls, v):
        """验证纪要编号格式"""
        if not v or not v.strip():
            raise ValueError("纪要编号不能为空")
        return v.strip()


class MeetingMinutesCreate(MeetingMinutesBase):
    """创建会议纪要 Schema"""
    pass


class MeetingMinutesUpdate(BaseModel):
    """更新会议纪要 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class MeetingMinutesResponse(MeetingMinutesBase):
    """会议纪要响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
