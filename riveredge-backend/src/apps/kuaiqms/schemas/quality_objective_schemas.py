"""
质量目标 Schema 模块

定义质量目标相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class QualityObjectiveBase(BaseModel):
    """质量目标基础 Schema"""
    
    objective_no: str = Field(..., max_length=50, description="目标编号")
    objective_name: str = Field(..., max_length=200, description="目标名称")
    objective_description: Optional[str] = Field(None, description="目标描述")
    target_value: Decimal = Field(..., description="目标值")
    current_value: Optional[Decimal] = Field(0, description="当前值")
    unit: Optional[str] = Field(None, max_length=50, description="单位")
    period: str = Field(..., max_length=50, description="周期")
    period_start_date: Optional[datetime] = Field(None, description="周期开始日期")
    period_end_date: Optional[datetime] = Field(None, description="周期结束日期")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID")
    responsible_person_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    achievement_rate: Optional[Decimal] = Field(0, description="达成率（百分比）")
    remark: Optional[str] = Field(None, description="备注")


class QualityObjectiveCreate(QualityObjectiveBase):
    """创建质量目标 Schema"""
    pass


class QualityObjectiveUpdate(BaseModel):
    """更新质量目标 Schema"""
    
    objective_name: Optional[str] = Field(None, max_length=200, description="目标名称")
    objective_description: Optional[str] = Field(None, description="目标描述")
    target_value: Optional[Decimal] = Field(None, description="目标值")
    current_value: Optional[Decimal] = Field(None, description="当前值")
    unit: Optional[str] = Field(None, max_length=50, description="单位")
    period: Optional[str] = Field(None, max_length=50, description="周期")
    period_start_date: Optional[datetime] = Field(None, description="周期开始日期")
    period_end_date: Optional[datetime] = Field(None, description="周期结束日期")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID")
    responsible_person_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    achievement_rate: Optional[Decimal] = Field(None, description="达成率（百分比）")
    status: Optional[str] = Field(None, max_length=50, description="目标状态")
    remark: Optional[str] = Field(None, description="备注")


class QualityObjectiveResponse(QualityObjectiveBase):
    """质量目标响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
