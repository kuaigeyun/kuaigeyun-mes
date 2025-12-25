"""
质量指标 Schema 模块

定义质量指标相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class QualityIndicatorBase(BaseModel):
    """质量指标基础 Schema"""
    
    indicator_no: str = Field(..., max_length=50, description="指标编号")
    indicator_name: str = Field(..., max_length=200, description="指标名称")
    indicator_description: Optional[str] = Field(None, description="指标描述")
    indicator_type: str = Field(..., max_length=100, description="指标类型")
    target_value: Optional[Decimal] = Field(None, description="目标值")
    current_value: Optional[Decimal] = Field(0, description="当前值")
    unit: Optional[str] = Field(None, max_length=50, description="单位")
    calculation_method: Optional[str] = Field(None, description="计算方法")
    data_source: Optional[str] = Field(None, max_length=200, description="数据来源")
    monitoring_frequency: Optional[str] = Field(None, max_length=50, description="监控频率")
    alert_threshold: Optional[Decimal] = Field(None, description="预警阈值")
    remark: Optional[str] = Field(None, description="备注")


class QualityIndicatorCreate(QualityIndicatorBase):
    """创建质量指标 Schema"""
    pass


class QualityIndicatorUpdate(BaseModel):
    """更新质量指标 Schema"""
    
    indicator_name: Optional[str] = Field(None, max_length=200, description="指标名称")
    indicator_description: Optional[str] = Field(None, description="指标描述")
    indicator_type: Optional[str] = Field(None, max_length=100, description="指标类型")
    target_value: Optional[Decimal] = Field(None, description="目标值")
    current_value: Optional[Decimal] = Field(None, description="当前值")
    unit: Optional[str] = Field(None, max_length=50, description="单位")
    calculation_method: Optional[str] = Field(None, description="计算方法")
    data_source: Optional[str] = Field(None, max_length=200, description="数据来源")
    monitoring_frequency: Optional[str] = Field(None, max_length=50, description="监控频率")
    alert_threshold: Optional[Decimal] = Field(None, description="预警阈值")
    status: Optional[str] = Field(None, max_length=50, description="指标状态")
    remark: Optional[str] = Field(None, description="备注")


class QualityIndicatorResponse(QualityIndicatorBase):
    """质量指标响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
