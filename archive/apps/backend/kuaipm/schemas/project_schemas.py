"""
项目 Schema 模块

定义项目数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ProjectBase(BaseModel):
    """项目基础 Schema"""
    
    project_no: str = Field(..., max_length=50, description="项目编号（组织内唯一）")
    project_name: str = Field(..., max_length=200, description="项目名称")
    project_type: str = Field(..., max_length=50, description="项目类型")
    project_category: Optional[str] = Field(None, max_length=50, description="项目分类")
    manager_id: int = Field(..., description="项目经理ID")
    manager_name: str = Field(..., max_length=100, description="项目经理姓名")
    department_id: Optional[int] = Field(None, description="负责部门ID")
    start_date: Optional[datetime] = Field(None, description="计划开始日期")
    end_date: Optional[datetime] = Field(None, description="计划结束日期")
    budget_amount: Optional[Decimal] = Field(None, description="预算金额")
    progress: int = Field(0, ge=0, le=100, description="项目进度（百分比）")
    status: str = Field("草稿", max_length=50, description="状态")
    priority: str = Field("中", max_length=50, description="优先级")
    description: Optional[str] = Field(None, description="项目描述")
    
    @validator("project_no")
    def validate_project_no(cls, v):
        """验证项目编号格式"""
        if not v or not v.strip():
            raise ValueError("项目编号不能为空")
        return v.strip()


class ProjectCreate(ProjectBase):
    """创建项目 Schema"""
    pass


class ProjectUpdate(BaseModel):
    """更新项目 Schema"""
    
    project_name: Optional[str] = Field(None, max_length=200, description="项目名称")
    project_type: Optional[str] = Field(None, max_length=50, description="项目类型")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    progress: Optional[int] = Field(None, ge=0, le=100, description="项目进度")
    priority: Optional[str] = Field(None, max_length=50, description="优先级")
    description: Optional[str] = Field(None, description="项目描述")


class ProjectResponse(ProjectBase):
    """项目响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    actual_start_date: Optional[datetime]
    actual_end_date: Optional[datetime]
    actual_amount: Optional[Decimal]
    approval_instance_id: Optional[int]
    approval_status: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

