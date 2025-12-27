"""
需求预测 Schema 模块

定义需求预测相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class DemandForecastBase(BaseModel):
    """需求预测基础 Schema"""
    
    forecast_no: str = Field(..., max_length=100, description="预测单编号")
    forecast_name: str = Field(..., max_length=200, description="预测名称")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    supplier_name: Optional[str] = Field(None, max_length=200, description="供应商名称")
    material_id: Optional[int] = Field(None, description="物料ID")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    material_code: Optional[str] = Field(None, max_length=100, description="物料编码")
    forecast_period: Optional[str] = Field(None, max_length=50, description="预测周期")
    forecast_start_date: Optional[datetime] = Field(None, description="预测开始日期")
    forecast_end_date: Optional[datetime] = Field(None, description="预测结束日期")
    forecast_quantity: Optional[Decimal] = Field(None, description="预测数量")
    actual_quantity: Optional[Decimal] = Field(None, description="实际数量")
    accuracy_rate: Optional[Decimal] = Field(None, description="准确率")
    shared_status: str = Field("未共享", max_length=50, description="共享状态")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class DemandForecastCreate(DemandForecastBase):
    """创建需求预测 Schema"""
    pass


class DemandForecastUpdate(BaseModel):
    """更新需求预测 Schema"""
    
    forecast_name: Optional[str] = Field(None, max_length=200, description="预测名称")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    supplier_name: Optional[str] = Field(None, max_length=200, description="供应商名称")
    material_id: Optional[int] = Field(None, description="物料ID")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    material_code: Optional[str] = Field(None, max_length=100, description="物料编码")
    forecast_period: Optional[str] = Field(None, max_length=50, description="预测周期")
    forecast_start_date: Optional[datetime] = Field(None, description="预测开始日期")
    forecast_end_date: Optional[datetime] = Field(None, description="预测结束日期")
    forecast_quantity: Optional[Decimal] = Field(None, description="预测数量")
    actual_quantity: Optional[Decimal] = Field(None, description="实际数量")
    accuracy_rate: Optional[Decimal] = Field(None, description="准确率")
    shared_status: Optional[str] = Field(None, max_length=50, description="共享状态")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class DemandForecastResponse(DemandForecastBase):
    """需求预测响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

