"""
设备综合效率分析 Schema 模块

定义设备综合效率分析相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal


class OEEAnalysisBase(BaseModel):
    """设备综合效率分析基础 Schema"""
    
    analysis_no: str = Field(..., max_length=100, description="分析编号")
    analysis_name: str = Field(..., max_length=200, description="分析名称")
    device_id: Optional[int] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    analysis_period: Optional[str] = Field(None, max_length=50, description="分析周期")
    analysis_start_date: Optional[datetime] = Field(None, description="分析开始日期")
    analysis_end_date: Optional[datetime] = Field(None, description="分析结束日期")
    availability: Optional[Decimal] = Field(None, description="可用率")
    performance: Optional[Decimal] = Field(None, description="性能率")
    quality: Optional[Decimal] = Field(None, description="质量率")
    oee_value: Optional[Decimal] = Field(None, description="OEE值")
    utilization_rate: Optional[Decimal] = Field(None, description="设备利用率")
    performance_indicators: Optional[Any] = Field(None, description="性能指标")
    optimization_suggestions: Optional[Any] = Field(None, description="优化建议")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class OEEAnalysisCreate(OEEAnalysisBase):
    """创建设备综合效率分析 Schema"""
    pass


class OEEAnalysisUpdate(BaseModel):
    """更新设备综合效率分析 Schema"""
    
    analysis_name: Optional[str] = Field(None, max_length=200, description="分析名称")
    device_id: Optional[int] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, max_length=200, description="设备名称")
    analysis_period: Optional[str] = Field(None, max_length=50, description="分析周期")
    analysis_start_date: Optional[datetime] = Field(None, description="分析开始日期")
    analysis_end_date: Optional[datetime] = Field(None, description="分析结束日期")
    availability: Optional[Decimal] = Field(None, description="可用率")
    performance: Optional[Decimal] = Field(None, description="性能率")
    quality: Optional[Decimal] = Field(None, description="质量率")
    oee_value: Optional[Decimal] = Field(None, description="OEE值")
    utilization_rate: Optional[Decimal] = Field(None, description="设备利用率")
    performance_indicators: Optional[Any] = Field(None, description="性能指标")
    optimization_suggestions: Optional[Any] = Field(None, description="优化建议")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class OEEAnalysisResponse(OEEAnalysisBase):
    """设备综合效率分析响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

