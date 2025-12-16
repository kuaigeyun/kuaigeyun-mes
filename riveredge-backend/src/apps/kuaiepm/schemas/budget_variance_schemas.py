"""
预算差异 Schema 模块

定义预算差异数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class BudgetVarianceBase(BaseModel):
    """预算差异基础 Schema"""
    
    variance_no: str = Field(..., max_length=50, description="差异编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("variance_no")
    def validate_variance_no(cls, v):
        """验证差异编号格式"""
        if not v or not v.strip():
            raise ValueError("差异编号不能为空")
        return v.strip()


class BudgetVarianceCreate(BudgetVarianceBase):
    """创建预算差异 Schema"""
    pass


class BudgetVarianceUpdate(BaseModel):
    """更新预算差异 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class BudgetVarianceResponse(BudgetVarianceBase):
    """预算差异响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
