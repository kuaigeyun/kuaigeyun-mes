"""
持续改进 Schema 模块

定义持续改进相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ContinuousImprovementBase(BaseModel):
    """持续改进基础 Schema"""
    
    improvement_no: str = Field(..., max_length=50, description="改进编号")
    improvement_type: str = Field(..., max_length=50, description="改进类型")
    improvement_title: str = Field(..., max_length=200, description="改进标题")
    improvement_description: str = Field(..., description="改进描述")
    improvement_plan: Optional[str] = Field(None, description="改进计划")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID")
    responsible_person_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    improvement_result: Optional[str] = Field(None, description="改进结果")
    effectiveness_evaluation: Optional[str] = Field(None, description="有效性评估")
    remark: Optional[str] = Field(None, description="备注")


class ContinuousImprovementCreate(ContinuousImprovementBase):
    """创建持续改进 Schema"""
    pass


class ContinuousImprovementUpdate(BaseModel):
    """更新持续改进 Schema"""
    
    improvement_type: Optional[str] = Field(None, max_length=50, description="改进类型")
    improvement_title: Optional[str] = Field(None, max_length=200, description="改进标题")
    improvement_description: Optional[str] = Field(None, description="改进描述")
    improvement_plan: Optional[str] = Field(None, description="改进计划")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID")
    responsible_person_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    improvement_result: Optional[str] = Field(None, description="改进结果")
    effectiveness_evaluation: Optional[str] = Field(None, description="有效性评估")
    status: Optional[str] = Field(None, max_length=50, description="改进状态")
    remark: Optional[str] = Field(None, description="备注")


class ContinuousImprovementResponse(ContinuousImprovementBase):
    """持续改进响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
