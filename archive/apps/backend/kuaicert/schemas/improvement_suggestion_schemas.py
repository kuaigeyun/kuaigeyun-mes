"""
改进建议 Schema 模块

定义改进建议数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ImprovementSuggestionBase(BaseModel):
    """改进建议基础 Schema"""
    
    suggestion_no: str = Field(..., max_length=50, description="建议编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("suggestion_no")
    def validate_suggestion_no(cls, v):
        """验证建议编号格式"""
        if not v or not v.strip():
            raise ValueError("建议编号不能为空")
        return v.strip()


class ImprovementSuggestionCreate(ImprovementSuggestionBase):
    """创建改进建议 Schema"""
    pass


class ImprovementSuggestionUpdate(BaseModel):
    """更新改进建议 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ImprovementSuggestionResponse(ImprovementSuggestionBase):
    """改进建议响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
