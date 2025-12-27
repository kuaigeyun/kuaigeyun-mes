"""
资源调度 Schema 模块

定义资源调度相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ResourceSchedulingBase(BaseModel):
    """资源调度基础 Schema"""
    
    scheduling_no: str = Field(..., max_length=100, description="调度编号")
    scheduling_name: str = Field(..., max_length=200, description="调度名称")
    resource_type: str = Field(..., max_length=50, description="资源类型")
    resource_id: Optional[int] = Field(None, description="资源ID")
    resource_name: Optional[str] = Field(None, max_length=200, description="资源名称")
    plan_id: Optional[int] = Field(None, description="计划ID")
    plan_uuid: Optional[str] = Field(None, max_length=36, description="计划UUID")
    plan_no: Optional[str] = Field(None, max_length=100, description="计划编号")
    scheduled_start_date: Optional[datetime] = Field(None, description="调度开始日期")
    scheduled_end_date: Optional[datetime] = Field(None, description="调度结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    availability_status: str = Field("可用", max_length=50, description="可用性状态")
    scheduling_status: str = Field("待调度", max_length=50, description="调度状态")
    optimization_suggestion: Optional[str] = Field(None, description="优化建议")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ResourceSchedulingCreate(ResourceSchedulingBase):
    """创建资源调度 Schema"""
    pass


class ResourceSchedulingUpdate(BaseModel):
    """更新资源调度 Schema"""
    
    scheduling_name: Optional[str] = Field(None, max_length=200, description="调度名称")
    resource_type: Optional[str] = Field(None, max_length=50, description="资源类型")
    resource_id: Optional[int] = Field(None, description="资源ID")
    resource_name: Optional[str] = Field(None, max_length=200, description="资源名称")
    plan_id: Optional[int] = Field(None, description="计划ID")
    plan_uuid: Optional[str] = Field(None, max_length=36, description="计划UUID")
    plan_no: Optional[str] = Field(None, max_length=100, description="计划编号")
    scheduled_start_date: Optional[datetime] = Field(None, description="调度开始日期")
    scheduled_end_date: Optional[datetime] = Field(None, description="调度结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    availability_status: Optional[str] = Field(None, max_length=50, description="可用性状态")
    scheduling_status: Optional[str] = Field(None, max_length=50, description="调度状态")
    optimization_suggestion: Optional[str] = Field(None, description="优化建议")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ResourceSchedulingResponse(ResourceSchedulingBase):
    """资源调度响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

