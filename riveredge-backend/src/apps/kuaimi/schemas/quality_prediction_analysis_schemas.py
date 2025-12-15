"""
质量预测分析 Schema 模块

定义质量预测分析相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal


class QualityPredictionAnalysisBase(BaseModel):
    """质量预测分析基础 Schema"""
    
    analysis_no: str = Field(..., max_length=100, description="分析编号")
    analysis_name: str = Field(..., max_length=200, description="分析名称")
    prediction_model: Optional[str] = Field(None, max_length=200, description="预测模型")
    prediction_period: Optional[str] = Field(None, max_length=50, description="预测周期")
    prediction_start_date: Optional[datetime] = Field(None, description="预测开始日期")
    prediction_end_date: Optional[datetime] = Field(None, description="预测结束日期")
    quality_trend: Optional[Any] = Field(None, description="质量趋势")
    prediction_accuracy: Optional[Decimal] = Field(None, description="预测准确性")
    alert_status: str = Field("正常", max_length=50, description="预警状态")
    alert_level: Optional[str] = Field(None, max_length=50, description="预警等级")
    alert_description: Optional[str] = Field(None, description="预警描述")
    risk_level: Optional[str] = Field(None, max_length=50, description="风险等级")
    root_cause_analysis: Optional[Any] = Field(None, description="根因分析")
    root_cause_trace: Optional[Any] = Field(None, description="根因追溯")
    improvement_plan: Optional[Any] = Field(None, description="改进方案")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class QualityPredictionAnalysisCreate(QualityPredictionAnalysisBase):
    """创建质量预测分析 Schema"""
    pass


class QualityPredictionAnalysisUpdate(BaseModel):
    """更新质量预测分析 Schema"""
    
    analysis_name: Optional[str] = Field(None, max_length=200, description="分析名称")
    prediction_model: Optional[str] = Field(None, max_length=200, description="预测模型")
    prediction_period: Optional[str] = Field(None, max_length=50, description="预测周期")
    prediction_start_date: Optional[datetime] = Field(None, description="预测开始日期")
    prediction_end_date: Optional[datetime] = Field(None, description="预测结束日期")
    quality_trend: Optional[Any] = Field(None, description="质量趋势")
    prediction_accuracy: Optional[Decimal] = Field(None, description="预测准确性")
    alert_status: Optional[str] = Field(None, max_length=50, description="预警状态")
    alert_level: Optional[str] = Field(None, max_length=50, description="预警等级")
    alert_description: Optional[str] = Field(None, description="预警描述")
    risk_level: Optional[str] = Field(None, max_length=50, description="风险等级")
    root_cause_analysis: Optional[Any] = Field(None, description="根因分析")
    root_cause_trace: Optional[Any] = Field(None, description="根因追溯")
    improvement_plan: Optional[Any] = Field(None, description="改进方案")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class QualityPredictionAnalysisResponse(QualityPredictionAnalysisBase):
    """质量预测分析响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

