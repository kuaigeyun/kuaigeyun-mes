"""
计划调整 Schema 模块

定义计划调整相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class PlanAdjustmentBase(BaseModel):
    """计划调整基础 Schema"""
    
    adjustment_no: str = Field(..., max_length=100, description="调整单编号")
    adjustment_name: str = Field(..., max_length=200, description="调整名称")
    adjustment_type: str = Field(..., max_length=50, description="调整类型")
    plan_id: Optional[int] = Field(None, description="计划ID")
    plan_uuid: Optional[str] = Field(None, max_length=36, description="计划UUID")
    plan_no: Optional[str] = Field(None, max_length=100, description="计划编号")
    adjustment_reason: Optional[str] = Field(None, description="调整原因")
    impact_analysis: Optional[Any] = Field(None, description="影响分析")
    original_plan_data: Optional[Any] = Field(None, description="原计划数据")
    adjusted_plan_data: Optional[Any] = Field(None, description="调整后计划数据")
    approval_status: str = Field("待审批", max_length=50, description="审批状态")
    approval_person_id: Optional[int] = Field(None, description="审批人ID")
    approval_person_name: Optional[str] = Field(None, max_length=100, description="审批人姓名")
    approval_date: Optional[datetime] = Field(None, description="审批日期")
    adjustment_status: str = Field("待调整", max_length=50, description="调整状态")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class PlanAdjustmentCreate(PlanAdjustmentBase):
    """创建计划调整 Schema"""
    pass


class PlanAdjustmentUpdate(BaseModel):
    """更新计划调整 Schema"""
    
    adjustment_name: Optional[str] = Field(None, max_length=200, description="调整名称")
    adjustment_type: Optional[str] = Field(None, max_length=50, description="调整类型")
    plan_id: Optional[int] = Field(None, description="计划ID")
    plan_uuid: Optional[str] = Field(None, max_length=36, description="计划UUID")
    plan_no: Optional[str] = Field(None, max_length=100, description="计划编号")
    adjustment_reason: Optional[str] = Field(None, description="调整原因")
    impact_analysis: Optional[Any] = Field(None, description="影响分析")
    original_plan_data: Optional[Any] = Field(None, description="原计划数据")
    adjusted_plan_data: Optional[Any] = Field(None, description="调整后计划数据")
    approval_status: Optional[str] = Field(None, max_length=50, description="审批状态")
    approval_person_id: Optional[int] = Field(None, description="审批人ID")
    approval_person_name: Optional[str] = Field(None, max_length=100, description="审批人姓名")
    approval_date: Optional[datetime] = Field(None, description="审批日期")
    adjustment_status: Optional[str] = Field(None, max_length=50, description="调整状态")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class PlanAdjustmentResponse(PlanAdjustmentBase):
    """计划调整响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

