"""
系统应用绩效分析 Schema 模块

定义系统应用绩效分析相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal


class SystemPerformanceAnalysisBase(BaseModel):
    """系统应用绩效分析基础 Schema"""
    
    analysis_no: str = Field(..., max_length=100, description="分析编号")
    analysis_name: str = Field(..., max_length=200, description="分析名称")
    analysis_type: str = Field(..., max_length=50, description="分析类型")
    analysis_period: Optional[str] = Field(None, max_length=50, description="分析周期")
    analysis_start_date: Optional[datetime] = Field(None, description="分析开始日期")
    analysis_end_date: Optional[datetime] = Field(None, description="分析结束日期")
    module_usage_rate: Optional[Any] = Field(None, description="模块使用率")
    function_usage_frequency: Optional[Any] = Field(None, description="功能使用频率")
    user_activity: Optional[Any] = Field(None, description="用户活跃度")
    efficiency_improvement: Optional[Decimal] = Field(None, description="效率提升")
    time_reduction: Optional[Decimal] = Field(None, description="时间缩短")
    cost_reduction: Optional[Decimal] = Field(None, description="成本降低")
    roi_value: Optional[Decimal] = Field(None, description="ROI值")
    cost_saving: Optional[Decimal] = Field(None, description="成本节约")
    before_after_comparison: Optional[Any] = Field(None, description="前后对比")
    improvement_quantification: Optional[Any] = Field(None, description="改善量化")
    value_contribution: Optional[Any] = Field(None, description="价值贡献")
    optimization_suggestions: Optional[Any] = Field(None, description="优化建议")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class SystemPerformanceAnalysisCreate(SystemPerformanceAnalysisBase):
    """创建系统应用绩效分析 Schema"""
    pass


class SystemPerformanceAnalysisUpdate(BaseModel):
    """更新系统应用绩效分析 Schema"""
    
    analysis_name: Optional[str] = Field(None, max_length=200, description="分析名称")
    analysis_type: Optional[str] = Field(None, max_length=50, description="分析类型")
    analysis_period: Optional[str] = Field(None, max_length=50, description="分析周期")
    analysis_start_date: Optional[datetime] = Field(None, description="分析开始日期")
    analysis_end_date: Optional[datetime] = Field(None, description="分析结束日期")
    module_usage_rate: Optional[Any] = Field(None, description="模块使用率")
    function_usage_frequency: Optional[Any] = Field(None, description="功能使用频率")
    user_activity: Optional[Any] = Field(None, description="用户活跃度")
    efficiency_improvement: Optional[Decimal] = Field(None, description="效率提升")
    time_reduction: Optional[Decimal] = Field(None, description="时间缩短")
    cost_reduction: Optional[Decimal] = Field(None, description="成本降低")
    roi_value: Optional[Decimal] = Field(None, description="ROI值")
    cost_saving: Optional[Decimal] = Field(None, description="成本节约")
    before_after_comparison: Optional[Any] = Field(None, description="前后对比")
    improvement_quantification: Optional[Any] = Field(None, description="改善量化")
    value_contribution: Optional[Any] = Field(None, description="价值贡献")
    optimization_suggestions: Optional[Any] = Field(None, description="优化建议")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class SystemPerformanceAnalysisResponse(SystemPerformanceAnalysisBase):
    """系统应用绩效分析响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

