"""
项目进度 Schema 模块

定义项目进度数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProjectProgressBase(BaseModel):
    """项目进度基础 Schema"""
    
    progress_no: str = Field(..., max_length=50, description="进度编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("progress_no")
    def validate_progress_no(cls, v):
        """验证进度编号格式"""
        if not v or not v.strip():
            raise ValueError("进度编号不能为空")
        return v.strip()


class ProjectProgressCreate(ProjectProgressBase):
    """创建项目进度 Schema"""
    pass


class ProjectProgressUpdate(BaseModel):
    """更新项目进度 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ProjectProgressResponse(ProjectProgressBase):
    """项目进度响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
