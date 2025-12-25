"""
目标 Schema 模块

定义目标数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ObjectiveBase(BaseModel):
    """目标基础 Schema"""
    
    objective_no: str = Field(..., max_length=50, description="目标编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("objective_no")
    def validate_objective_no(cls, v):
        """验证目标编号格式"""
        if not v or not v.strip():
            raise ValueError("目标编号不能为空")
        return v.strip()


class ObjectiveCreate(ObjectiveBase):
    """创建目标 Schema"""
    pass


class ObjectiveUpdate(BaseModel):
    """更新目标 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ObjectiveResponse(ObjectiveBase):
    """目标响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
