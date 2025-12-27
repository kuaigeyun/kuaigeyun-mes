"""
项目资源 Schema 模块

定义项目资源数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProjectResourceBase(BaseModel):
    """项目资源基础 Schema"""
    
    resource_no: str = Field(..., max_length=50, description="资源编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("resource_no")
    def validate_resource_no(cls, v):
        """验证资源编号格式"""
        if not v or not v.strip():
            raise ValueError("资源编号不能为空")
        return v.strip()


class ProjectResourceCreate(ProjectResourceBase):
    """创建项目资源 Schema"""
    pass


class ProjectResourceUpdate(BaseModel):
    """更新项目资源 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ProjectResourceResponse(ProjectResourceBase):
    """项目资源响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
