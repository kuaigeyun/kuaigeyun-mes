"""
销售预测模块数据验证schema

提供销售预测相关的数据验证和序列化。

Author: Luigi Lu
Date: 2026-02-02
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import Field, field_validator, model_validator
from core.schemas.base import BaseSchema


# === 销售预测 ===

class SalesForecastBase(BaseSchema):
    """销售预测基础schema"""
    forecast_code: str = Field(..., max_length=50, description="预测编码")
    forecast_name: str = Field(..., max_length=200, description="预测名称")
    forecast_type: str = Field(default="MTS", max_length=20, description="预测类型")
    forecast_period: str = Field(..., max_length=20, description="预测周期")
    start_date: date = Field(..., description="预测开始日期")
    end_date: date = Field(..., description="预测结束日期")
    status: str = Field(default="草稿", max_length=20, description="预测状态")
    review_status: str = Field(default="待审核", max_length=20, description="审核状态")
    notes: Optional[str] = Field(None, description="备注")
    
    # 审核信息
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    
    @model_validator(mode='after')
    def validate_dates(self):
        """验证日期范围"""
        if self.start_date and self.end_date:
            if self.start_date > self.end_date:
                raise ValueError("开始日期不能晚于结束日期")
        return self


class SalesForecastCreate(SalesForecastBase):
    """销售预测创建schema"""
    items: Optional[List["SalesForecastItemCreate"]] = Field(None, description="预测明细列表")
    
    @model_validator(mode='after')
    def validate_items(self):
        """验证预测明细"""
        if self.items:
            for item in self.items:
                if not item.forecast_date:
                    raise ValueError("预测明细必须填写预测日期")
                if item.forecast_quantity <= 0:
                    raise ValueError("预测数量必须大于0")
        return self


class SalesForecastUpdate(BaseSchema):
    """销售预测更新schema"""
    forecast_code: Optional[str] = Field(None, max_length=50, description="预测编码")
    forecast_name: Optional[str] = Field(None, max_length=200, description="预测名称")
    forecast_type: Optional[str] = Field(None, max_length=20, description="预测类型")
    forecast_period: Optional[str] = Field(None, max_length=20, description="预测周期")
    start_date: Optional[date] = Field(None, description="预测开始日期")
    end_date: Optional[date] = Field(None, description="预测结束日期")
    status: Optional[str] = Field(None, max_length=20, description="预测状态")
    review_status: Optional[str] = Field(None, max_length=20, description="审核状态")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")


class SalesForecastResponse(SalesForecastBase):
    """销售预测响应schema"""
    id: int = Field(..., description="预测ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    is_active: bool = Field(True, description="是否有效")
    
    # 关联明细
    items: Optional[List["SalesForecastItemResponse"]] = Field(None, description="预测明细列表")
    
    class Config:
        from_attributes = True


class SalesForecastListResponse(BaseSchema):
    """销售预测列表响应schema（简化版）"""
    id: int = Field(..., description="预测ID")
    tenant_id: int = Field(..., description="租户ID")
    forecast_code: str = Field(..., description="预测编码")
    forecast_name: str = Field(..., description="预测名称")
    forecast_type: str = Field(..., description="预测类型")
    forecast_period: str = Field(..., description="预测周期")
    start_date: date = Field(..., description="预测开始日期")
    end_date: date = Field(..., description="预测结束日期")
    status: str = Field(..., description="预测状态")
    review_status: str = Field(..., description="审核状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    
    class Config:
        from_attributes = True


# === 销售预测明细 ===

class SalesForecastItemBase(BaseSchema):
    """销售预测明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    forecast_quantity: Decimal = Field(..., gt=0, description="预测数量")
    forecast_date: date = Field(..., description="预测日期")
    
    # 历史数据（可选，用于预测参考）
    historical_sales: Optional[Decimal] = Field(None, ge=0, description="历史销量")
    historical_period: Optional[str] = Field(None, max_length=20, description="历史周期")
    
    # 预测参数
    confidence_level: Optional[Decimal] = Field(None, ge=0, le=100, description="置信度")
    forecast_method: Optional[str] = Field(None, max_length=50, description="预测方法")
    
    notes: Optional[str] = Field(None, description="备注")


class SalesForecastItemCreate(SalesForecastItemBase):
    """销售预测明细创建schema"""
    pass


class SalesForecastItemUpdate(BaseSchema):
    """销售预测明细更新schema"""
    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: Optional[str] = Field(None, max_length=20, description="物料单位")
    forecast_quantity: Optional[Decimal] = Field(None, gt=0, description="预测数量")
    forecast_date: Optional[date] = Field(None, description="预测日期")
    historical_sales: Optional[Decimal] = Field(None, ge=0, description="历史销量")
    historical_period: Optional[str] = Field(None, max_length=20, description="历史周期")
    confidence_level: Optional[Decimal] = Field(None, ge=0, le=100, description="置信度")
    forecast_method: Optional[str] = Field(None, max_length=50, description="预测方法")
    notes: Optional[str] = Field(None, description="备注")


class SalesForecastItemResponse(SalesForecastItemBase):
    """销售预测明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    forecast_id: int = Field(..., description="预测ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True


# 前向引用解析
SalesForecastCreate.model_rebuild()
SalesForecastResponse.model_rebuild()
