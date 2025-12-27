"""
项目质量 Schema 模块

定义项目质量数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProjectQualityBase(BaseModel):
    """项目质量基础 Schema"""
    
    quality_no: str = Field(..., max_length=50, description="质量编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("quality_no")
    def validate_quality_no(cls, v):
        """验证质量编号格式"""
        if not v or not v.strip():
            raise ValueError("质量编号不能为空")
        return v.strip()


class ProjectQualityCreate(ProjectQualityBase):
    """创建项目质量 Schema"""
    pass


class ProjectQualityUpdate(BaseModel):
    """更新项目质量 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ProjectQualityResponse(ProjectQualityBase):
    """项目质量响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
