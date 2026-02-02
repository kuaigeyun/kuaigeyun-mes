"""
销售管理模块数据验证schema

提供销售管理相关的数据验证和序列化。

Author: Luigi Lu
Date: 2025-12-30
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List
from pydantic import Field
from core.schemas.base import BaseSchema


# === 销售预测 ===

class SalesForecastBase(BaseSchema):
    """销售预测基础schema"""
    forecast_code: str = Field(..., max_length=50, description="预测编码")
    forecast_name: str = Field(..., max_length=200, description="预测名称")
    forecast_type: str = Field("MTS", max_length=20, description="预测类型")
    forecast_period: str = Field(..., max_length=20, description="预测周期")
    start_date: date = Field(..., description="预测开始日期")
    end_date: date = Field(..., description="预测结束日期")
    status: str = Field("草稿", max_length=20, description="预测状态")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")


class SalesForecastCreate(SalesForecastBase):
    """销售预测创建schema"""
    items: Optional[List[SalesForecastItemCreate]] = Field(None, description="预测明细列表")


class SalesForecastUpdate(SalesForecastBase):
    """销售预测更新schema"""
    forecast_code: Optional[str] = Field(None, max_length=50, description="预测编码")
    items: Optional[List[SalesForecastItemCreate]] = Field(None, description="预测明细列表（提供则覆盖全部明细）")


class SalesForecastResponse(SalesForecastBase):
    """销售预测响应schema"""
    id: int = Field(..., description="预测ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class SalesForecastListResponse(SalesForecastResponse):
    """销售预测列表响应schema（简化版）"""
    pass


class SalesForecastListResult(BaseSchema):
    """销售预测列表分页结果"""
    data: List[SalesForecastListResponse] = Field(default_factory=list, description="列表数据")
    total: int = Field(0, description="总条数")
    success: bool = Field(True, description="是否成功")


# === 销售预测明细 ===

class SalesForecastItemBase(BaseSchema):
    """销售预测明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    forecast_quantity: float = Field(..., gt=0, description="预测数量")
    forecast_date: date = Field(..., description="预测日期")
    historical_sales: Optional[float] = Field(None, ge=0, description="历史销量")
    historical_period: Optional[str] = Field(None, max_length=20, description="历史周期")
    confidence_level: Optional[float] = Field(None, ge=0, le=100, description="置信度")
    forecast_method: Optional[str] = Field(None, max_length=50, description="预测方法")
    notes: Optional[str] = Field(None, description="备注")


class SalesForecastItemCreate(SalesForecastItemBase):
    """销售预测明细创建schema"""
    pass


class SalesForecastItemUpdate(SalesForecastItemBase):
    """销售预测明细更新schema"""
    pass


class SalesForecastItemResponse(SalesForecastItemBase):
    """销售预测明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    forecast_id: int = Field(..., description="销售预测ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# === 销售订单 ===

class SalesOrderBase(BaseSchema):
    """销售订单基础schema"""
    order_code: str = Field(..., max_length=50, description="订单编码")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    customer_contact: Optional[str] = Field(None, max_length=100, description="客户联系人")
    customer_phone: Optional[str] = Field(None, max_length=20, description="客户电话")
    order_date: date = Field(..., description="订单日期")
    delivery_date: date = Field(..., description="交货日期")
    order_type: str = Field("MTO", max_length=20, description="订单类型")
    total_quantity: float = Field(0, ge=0, description="总数量")
    total_amount: float = Field(0, ge=0, description="总金额")
    status: str = Field("草稿", max_length=20, description="订单状态")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    salesman_id: Optional[int] = Field(None, description="销售员ID")
    salesman_name: Optional[str] = Field(None, max_length=100, description="销售员姓名")
    shipping_address: Optional[str] = Field(None, description="收货地址")
    shipping_method: Optional[str] = Field(None, max_length=50, description="发货方式")
    payment_terms: Optional[str] = Field(None, max_length=100, description="付款条件")
    notes: Optional[str] = Field(None, description="备注")


class SalesOrderCreate(SalesOrderBase):
    """销售订单创建schema"""
    items: Optional[List["SalesOrderItemCreate"]] = Field(None, description="订单明细列表")


class SalesOrderUpdate(SalesOrderBase):
    """销售订单更新schema"""
    order_code: Optional[str] = Field(None, max_length=50, description="订单编码")


class SalesOrderResponse(SalesOrderBase):
    """销售订单响应schema"""
    id: int = Field(..., description="订单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    items: Optional[List["SalesOrderItemResponse"]] = Field(None, description="订单明细")

    class Config:
        from_attributes = True


class SalesOrderListResponse(SalesOrderResponse):
    """销售订单列表响应schema（简化版）"""
    pass


# === 销售订单明细 ===

class SalesOrderItemBase(BaseSchema):
    """销售订单明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    order_quantity: float = Field(..., gt=0, description="订单数量")
    delivered_quantity: float = Field(0, ge=0, description="已交货数量")
    remaining_quantity: float = Field(..., ge=0, description="剩余数量")
    unit_price: float = Field(..., ge=0, description="单价")
    total_amount: float = Field(..., ge=0, description="金额")
    delivery_date: date = Field(..., description="交货日期")
    delivery_status: str = Field("待交货", max_length=20, description="交货状态")
    work_order_id: Optional[int] = Field(None, description="工单ID")
    work_order_code: Optional[str] = Field(None, max_length=50, description="工单编码")
    notes: Optional[str] = Field(None, description="备注")


class SalesOrderItemCreate(SalesOrderItemBase):
    """销售订单明细创建schema"""
    pass


class SalesOrderItemUpdate(SalesOrderItemBase):
    """销售订单明细更新schema"""
    pass


class SalesOrderItemResponse(SalesOrderItemBase):
    """销售订单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    sales_order_id: int = Field(..., description="销售订单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# 解析前向引用，使 SalesOrderResponse.items 的 List[SalesOrderItemResponse] 生效
SalesOrderResponse.model_rebuild()
