"""
能源报表 Schema 模块

定义能源报表相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal


class EnergyReportBase(BaseModel):
    """能源报表基础 Schema"""
    
    report_no: str = Field(..., max_length=100, description="报表编号")
    report_name: str = Field(..., max_length=200, description="报表名称")
    report_type: str = Field(..., max_length=50, description="报表类型")
    report_period: Optional[str] = Field(None, max_length=50, description="报表周期")
    report_start_date: Optional[datetime] = Field(None, description="报表开始日期")
    report_end_date: Optional[datetime] = Field(None, description="报表结束日期")
    energy_type: Optional[str] = Field(None, max_length=50, description="能源类型")
    total_consumption: Optional[Decimal] = Field(None, description="总能耗")
    total_cost: Optional[Decimal] = Field(None, description="总成本")
    carbon_emission: Optional[Decimal] = Field(None, description="碳排放量")
    carbon_emission_rate: Optional[Decimal] = Field(None, description="碳排放率")
    report_data: Optional[Any] = Field(None, description="报表数据")
    report_config: Optional[Any] = Field(None, description="报表配置")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class EnergyReportCreate(EnergyReportBase):
    """创建能源报表 Schema"""
    pass


class EnergyReportUpdate(BaseModel):
    """更新能源报表 Schema"""
    
    report_name: Optional[str] = Field(None, max_length=200, description="报表名称")
    report_type: Optional[str] = Field(None, max_length=50, description="报表类型")
    report_period: Optional[str] = Field(None, max_length=50, description="报表周期")
    report_start_date: Optional[datetime] = Field(None, description="报表开始日期")
    report_end_date: Optional[datetime] = Field(None, description="报表结束日期")
    energy_type: Optional[str] = Field(None, max_length=50, description="能源类型")
    total_consumption: Optional[Decimal] = Field(None, description="总能耗")
    total_cost: Optional[Decimal] = Field(None, description="总成本")
    carbon_emission: Optional[Decimal] = Field(None, description="碳排放量")
    carbon_emission_rate: Optional[Decimal] = Field(None, description="碳排放率")
    report_data: Optional[Any] = Field(None, description="报表数据")
    report_config: Optional[Any] = Field(None, description="报表配置")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class EnergyReportResponse(EnergyReportBase):
    """能源报表响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

