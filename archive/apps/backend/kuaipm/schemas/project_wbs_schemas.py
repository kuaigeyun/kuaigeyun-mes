"""
项目WBS Schema 模块

定义项目WBS数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProjectWBSBase(BaseModel):
    """项目WBS基础 Schema"""
    
    wbs_code: str = Field(..., max_length=50, description="WBS编码（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("wbs_code")
    def validate_wbs_code(cls, v):
        """验证WBS编码格式"""
        if not v or not v.strip():
            raise ValueError("WBS编码不能为空")
        return v.strip()


class ProjectWBSCreate(ProjectWBSBase):
    """创建项目WBS Schema"""
    pass


class ProjectWBSUpdate(BaseModel):
    """更新项目WBS Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ProjectWBSResponse(ProjectWBSBase):
    """项目WBS响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
