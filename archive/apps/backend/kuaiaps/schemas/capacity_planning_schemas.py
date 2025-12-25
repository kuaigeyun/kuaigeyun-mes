"""
产能规划 Schema 模块

定义产能规划相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class CapacityPlanningBase(BaseModel):
    """产能规划基础 Schema"""
    
    planning_no: str = Field(..., max_length=100, description="规划编号")
    planning_name: str = Field(..., max_length=200, description="规划名称")
    resource_type: str = Field(..., max_length=50, description="资源类型")
    resource_id: Optional[int] = Field(None, description="资源ID")
    resource_name: Optional[str] = Field(None, max_length=200, description="资源名称")
    planning_period: Optional[str] = Field(None, max_length=50, description="规划周期")
    planning_start_date: Optional[datetime] = Field(None, description="规划开始日期")
    planning_end_date: Optional[datetime] = Field(None, description="规划结束日期")
    planned_capacity: Optional[Decimal] = Field(None, description="计划产能")
    actual_capacity: Optional[Decimal] = Field(None, description="实际产能")
    utilization_rate: Optional[Decimal] = Field(None, description="利用率")
    bottleneck_status: str = Field("否", max_length=20, description="瓶颈状态")
    optimization_suggestion: Optional[str] = Field(None, description="优化建议")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class CapacityPlanningCreate(CapacityPlanningBase):
    """创建产能规划 Schema"""
    pass


class CapacityPlanningUpdate(BaseModel):
    """更新产能规划 Schema"""
    
    planning_name: Optional[str] = Field(None, max_length=200, description="规划名称")
    resource_type: Optional[str] = Field(None, max_length=50, description="资源类型")
    resource_id: Optional[int] = Field(None, description="资源ID")
    resource_name: Optional[str] = Field(None, max_length=200, description="资源名称")
    planning_period: Optional[str] = Field(None, max_length=50, description="规划周期")
    planning_start_date: Optional[datetime] = Field(None, description="规划开始日期")
    planning_end_date: Optional[datetime] = Field(None, description="规划结束日期")
    planned_capacity: Optional[Decimal] = Field(None, description="计划产能")
    actual_capacity: Optional[Decimal] = Field(None, description="实际产能")
    utilization_rate: Optional[Decimal] = Field(None, description="利用率")
    bottleneck_status: Optional[str] = Field(None, max_length=20, description="瓶颈状态")
    optimization_suggestion: Optional[str] = Field(None, description="优化建议")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class CapacityPlanningResponse(CapacityPlanningBase):
    """产能规划响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

