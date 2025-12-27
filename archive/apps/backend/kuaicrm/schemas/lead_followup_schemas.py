"""
线索跟进记录 Schema 模块

定义线索跟进记录数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class LeadFollowUpBase(BaseModel):
    """线索跟进记录基础 Schema"""
    
    lead_id: int = Field(..., description="线索ID（关联Lead）")
    followup_type: str = Field(..., max_length=50, description="跟进类型（电话、邮件、拜访、会议等）")
    followup_content: str = Field(..., description="跟进内容")
    followup_result: Optional[str] = Field(None, max_length=200, description="跟进结果")
    next_followup_date: Optional[datetime] = Field(None, description="下次跟进日期")
    followup_by: int = Field(..., description="跟进人（用户ID）")
    
    @validator("followup_content")
    def validate_followup_content(cls, v):
        """验证跟进内容格式"""
        if not v or not v.strip():
            raise ValueError("跟进内容不能为空")
        return v.strip()


class LeadFollowUpCreate(LeadFollowUpBase):
    """创建线索跟进记录 Schema"""
    pass


class LeadFollowUpUpdate(BaseModel):
    """更新线索跟进记录 Schema"""
    
    followup_type: Optional[str] = Field(None, max_length=50, description="跟进类型")
    followup_content: Optional[str] = Field(None, description="跟进内容")
    followup_result: Optional[str] = Field(None, max_length=200, description="跟进结果")
    next_followup_date: Optional[datetime] = Field(None, description="下次跟进日期")


class LeadFollowUpResponse(LeadFollowUpBase):
    """线索跟进记录响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
