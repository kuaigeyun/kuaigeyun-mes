"""
最佳实践 Schema 模块

定义最佳实践数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class BestPracticeBase(BaseModel):
    """最佳实践基础 Schema"""
    
    practice_no: str = Field(..., max_length=50, description="实践编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("practice_no")
    def validate_practice_no(cls, v):
        """验证实践编号格式"""
        if not v or not v.strip():
            raise ValueError("实践编号不能为空")
        return v.strip()


class BestPracticeCreate(BestPracticeBase):
    """创建最佳实践 Schema"""
    pass


class BestPracticeUpdate(BaseModel):
    """更新最佳实践 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class BestPracticeResponse(BestPracticeBase):
    """最佳实践响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
