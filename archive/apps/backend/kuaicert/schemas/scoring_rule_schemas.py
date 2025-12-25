"""
评分规则 Schema 模块

定义评分规则数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ScoringRuleBase(BaseModel):
    """评分规则基础 Schema"""
    
    rule_no: str = Field(..., max_length=50, description="规则编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("rule_no")
    def validate_rule_no(cls, v):
        """验证规则编号格式"""
        if not v or not v.strip():
            raise ValueError("规则编号不能为空")
        return v.strip()


class ScoringRuleCreate(ScoringRuleBase):
    """创建评分规则 Schema"""
    pass


class ScoringRuleUpdate(BaseModel):
    """更新评分规则 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ScoringRuleResponse(ScoringRuleBase):
    """评分规则响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
