"""
项目任务 Schema 模块

定义项目任务数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProjectTaskBase(BaseModel):
    """项目任务基础 Schema"""
    
    task_no: str = Field(..., max_length=50, description="任务编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("task_no")
    def validate_task_no(cls, v):
        """验证任务编号格式"""
        if not v or not v.strip():
            raise ValueError("任务编号不能为空")
        return v.strip()


class ProjectTaskCreate(ProjectTaskBase):
    """创建项目任务 Schema"""
    pass


class ProjectTaskUpdate(BaseModel):
    """更新项目任务 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class ProjectTaskResponse(ProjectTaskBase):
    """项目任务响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
