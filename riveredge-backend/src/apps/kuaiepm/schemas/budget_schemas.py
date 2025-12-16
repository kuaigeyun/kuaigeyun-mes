"""
预算 Schema 模块

定义预算数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class BudgetBase(BaseModel):
    """预算基础 Schema"""
    
    budget_no: str = Field(..., max_length=50, description="预算编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("budget_no")
    def validate_budget_no(cls, v):
        """验证预算编号格式"""
        if not v or not v.strip():
            raise ValueError("预算编号不能为空")
        return v.strip()


class BudgetCreate(BudgetBase):
    """创建预算 Schema"""
    pass


class BudgetUpdate(BaseModel):
    """更新预算 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class BudgetResponse(BudgetBase):
    """预算响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
