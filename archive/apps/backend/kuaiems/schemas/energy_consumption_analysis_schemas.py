"""
能耗分析 Schema 模块

定义能耗分析相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal


class EnergyConsumptionAnalysisBase(BaseModel):
    """能耗分析基础 Schema"""
    
    analysis_no: str = Field(..., max_length=100, description="分析编号")
    analysis_name: str = Field(..., max_length=200, description="分析名称")
    analysis_type: str = Field(..., max_length=50, description="分析类型")
    energy_type: Optional[str] = Field(None, max_length=50, description="能源类型")
    analysis_period: Optional[str] = Field(None, max_length=50, description="分析周期")
    analysis_start_date: Optional[datetime] = Field(None, description="分析开始日期")
    analysis_end_date: Optional[datetime] = Field(None, description="分析结束日期")
    total_consumption: Optional[Decimal] = Field(None, description="总能耗")
    average_consumption: Optional[Decimal] = Field(None, description="平均能耗")
    peak_consumption: Optional[Decimal] = Field(None, description="峰值能耗")
    consumption_trend: Optional[str] = Field(None, max_length=50, description="能耗趋势")
    comparison_result: Optional[str] = Field(None, description="对比结果")
    analysis_result: Optional[Any] = Field(None, description="分析结果")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class EnergyConsumptionAnalysisCreate(EnergyConsumptionAnalysisBase):
    """创建能耗分析 Schema"""
    pass


class EnergyConsumptionAnalysisUpdate(BaseModel):
    """更新能耗分析 Schema"""
    
    analysis_name: Optional[str] = Field(None, max_length=200, description="分析名称")
    analysis_type: Optional[str] = Field(None, max_length=50, description="分析类型")
    energy_type: Optional[str] = Field(None, max_length=50, description="能源类型")
    analysis_period: Optional[str] = Field(None, max_length=50, description="分析周期")
    analysis_start_date: Optional[datetime] = Field(None, description="分析开始日期")
    analysis_end_date: Optional[datetime] = Field(None, description="分析结束日期")
    total_consumption: Optional[Decimal] = Field(None, description="总能耗")
    average_consumption: Optional[Decimal] = Field(None, description="平均能耗")
    peak_consumption: Optional[Decimal] = Field(None, description="峰值能耗")
    consumption_trend: Optional[str] = Field(None, max_length=50, description="能耗趋势")
    comparison_result: Optional[str] = Field(None, description="对比结果")
    analysis_result: Optional[Any] = Field(None, description="分析结果")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class EnergyConsumptionAnalysisResponse(EnergyConsumptionAnalysisBase):
    """能耗分析响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

