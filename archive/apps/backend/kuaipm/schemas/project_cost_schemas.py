"""
项目成本 Schema 模块

定义项目成本数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProjectCostBase(BaseModel):
    """项目成本基础 Schema"""
    
    cost_no: str = Field(..., max_length=50, description="成本编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("cost_no")
    def validate_cost_no(cls, v):
        """验证成本编号格式"""
        if not v or not v.strip():
            raise ValueError("成本编号不能为空")
        return v.strip()


class ProjectCostCreate(ProjectCostBase):
    """创建项目成本 Schema"""
    pass


class ProjectCostUpdate(BaseModel):
    """更新项目成本 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ProjectCostResponse(ProjectCostBase):
    """项目成本响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
