"""
统一需求管理模块数据验证schema

提供统一需求管理相关的数据验证和序列化，支持销售预测和销售订单两种需求类型。

根据《☆ 用户使用全场景推演.md》的设计理念，将销售预测和销售订单统一为需求管理。

Author: Luigi Lu
Date: 2025-01-14
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List, Literal
from decimal import Decimal
from pydantic import Field, field_validator, model_validator
from core.schemas.base import BaseSchema
from apps.kuaizhizao.constants import DemandStatus, ReviewStatus


# === 统一需求 ===

class DemandBase(BaseSchema):
    """统一需求基础schema"""
    demand_code: str = Field(..., max_length=50, description="需求编码")
    demand_type: Literal["sales_forecast", "sales_order"] = Field(..., description="需求类型")
    demand_name: str = Field(..., max_length=200, description="需求名称")
    business_mode: Literal["MTS", "MTO"] = Field(..., description="业务模式（MTS/MTO）")
    start_date: date = Field(..., description="开始日期")
    end_date: Optional[date] = Field(None, description="结束日期（销售订单可为空）")
    
    # 客户信息（销售订单专用，销售预测可为空）
    customer_id: Optional[int] = Field(None, description="客户ID")
    customer_name: Optional[str] = Field(None, max_length=200, description="客户名称")
    customer_contact: Optional[str] = Field(None, max_length=100, description="客户联系人")
    customer_phone: Optional[str] = Field(None, max_length=20, description="客户电话")
    
    # 销售预测专用字段
    forecast_period: Optional[str] = Field(None, max_length=20, description="预测周期（销售预测专用）")
    
    # 销售订单专用字段
    order_date: Optional[date] = Field(None, description="订单日期（销售订单专用）")
    delivery_date: Optional[date] = Field(None, description="交货日期（销售订单专用）")
    
    # 金额信息（通用）
    total_quantity: Decimal = Field(Decimal("0"), ge=0, description="总数量")
    total_amount: Decimal = Field(Decimal("0"), ge=0, description="总金额")
    
    # 状态（通用）
    status: DemandStatus = Field(DemandStatus.DRAFT, description="需求状态")
    
    # 时间节点记录（用于耗时统计）
    submit_time: Optional[datetime] = Field(None, description="提交时间")
    
    # 审核信息（通用）
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: ReviewStatus = Field(ReviewStatus.PENDING, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    
    # 销售信息（销售订单专用）
    salesman_id: Optional[int] = Field(None, description="销售员ID")
    salesman_name: Optional[str] = Field(None, max_length=100, description="销售员姓名")
    
    # 物流信息（销售订单专用）
    shipping_address: Optional[str] = Field(None, description="收货地址")
    shipping_method: Optional[str] = Field(None, max_length=50, description="发货方式")
    payment_terms: Optional[str] = Field(None, max_length=100, description="付款条件")
    
    notes: Optional[str] = Field(None, description="备注")
    
    @model_validator(mode='after')
    def validate_demand_type_fields(self):
        """根据需求类型验证必填字段"""
        if self.demand_type == "sales_forecast":
            # 销售预测必填字段
            if not self.forecast_period:
                raise ValueError("销售预测必须填写预测周期")
            if not self.end_date:
                raise ValueError("销售预测必须填写结束日期")
            # 业务模式应该是MTS
            if self.business_mode != "MTS":
                raise ValueError("销售预测的业务模式必须是MTS")
        elif self.demand_type == "sales_order":
            # 销售订单必填字段
            if not self.customer_id:
                raise ValueError("销售订单必须填写客户ID")
            if not self.customer_name:
                raise ValueError("销售订单必须填写客户名称")
            if not self.order_date:
                raise ValueError("销售订单必须填写订单日期")
            if not self.delivery_date:
                raise ValueError("销售订单必须填写交货日期")
            # 业务模式应该是MTO
            if self.business_mode != "MTO":
                raise ValueError("销售订单的业务模式必须是MTO")
        return self


class DemandCreate(DemandBase):
    """统一需求创建schema"""
    items: Optional[List["DemandItemCreate"]] = Field(None, description="需求明细列表")
    
    @model_validator(mode='after')
    def validate_items(self):
        """验证需求明细"""
        if self.items:
            for item in self.items:
                # 根据需求类型验证明细字段
                if self.demand_type == "sales_forecast":
                    if not item.forecast_date and not item.forecast_month:
                        raise ValueError("销售预测明细必须填写预测日期或预测月份")
                elif self.demand_type == "sales_order":
                    if not item.delivery_date:
                        raise ValueError("销售订单明细必须填写交货日期")
        return self


class DemandUpdate(BaseSchema):
    """统一需求更新schema"""
    demand_code: Optional[str] = Field(None, max_length=50, description="需求编码")
    demand_name: Optional[str] = Field(None, max_length=200, description="需求名称")
    start_date: Optional[date] = Field(None, description="开始日期")
    end_date: Optional[date] = Field(None, description="结束日期")
    customer_id: Optional[int] = Field(None, description="客户ID")
    customer_name: Optional[str] = Field(None, max_length=200, description="客户名称")
    customer_contact: Optional[str] = Field(None, max_length=100, description="客户联系人")
    customer_phone: Optional[str] = Field(None, max_length=20, description="客户电话")
    forecast_period: Optional[str] = Field(None, max_length=20, description="预测周期")
    order_date: Optional[date] = Field(None, description="订单日期")
    delivery_date: Optional[date] = Field(None, description="交货日期")
    total_quantity: Optional[Decimal] = Field(None, ge=0, description="总数量")
    total_amount: Optional[Decimal] = Field(None, ge=0, description="总金额")
    status: Optional[str] = Field(None, max_length=20, description="需求状态")
    submit_time: Optional[datetime] = Field(None, description="提交时间")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: Optional[str] = Field(None, max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    salesman_id: Optional[int] = Field(None, description="销售员ID")
    salesman_name: Optional[str] = Field(None, max_length=100, description="销售员姓名")
    shipping_address: Optional[str] = Field(None, description="收货地址")
    shipping_method: Optional[str] = Field(None, max_length=50, description="发货方式")
    payment_terms: Optional[str] = Field(None, max_length=100, description="付款条件")
    notes: Optional[str] = Field(None, description="备注")


class DemandResponse(DemandBase):
    """统一需求响应schema"""
    id: int = Field(..., description="需求ID")
    uuid: str = Field(..., description="业务ID（UUID）")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    is_active: bool = Field(True, description="是否有效")
    
    # 需求关联信息
    source_id: Optional[int] = Field(None, description="来源ID")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_code: Optional[str] = Field(None, max_length=50, description="来源编码")
    
    # 下推信息
    pushed_to_computation: bool = Field(False, description="是否已下推到需求计算")
    computation_id: Optional[int] = Field(None, description="关联的需求计算ID")
    computation_code: Optional[str] = Field(None, max_length=50, description="关联的需求计算编码")
    
    # 关联明细
    items: Optional[List["DemandItemResponse"]] = Field(None, description="需求明细列表")
    
    # 耗时统计（可选）
    duration_info: Optional[dict] = Field(None, description="耗时统计信息")
    
    class Config:
        from_attributes = True


class DemandListResponse(BaseSchema):
    """统一需求列表响应schema（简化版）"""
    id: int = Field(..., description="需求ID")
    uuid: str = Field(..., description="业务ID（UUID）")
    tenant_id: int = Field(..., description="租户ID")
    demand_code: str = Field(..., description="需求编码")
    demand_type: str = Field(..., description="需求类型")
    demand_name: str = Field(..., description="需求名称")
    business_mode: str = Field(..., description="业务模式")
    start_date: date = Field(..., description="开始日期")
    end_date: Optional[date] = Field(None, description="结束日期")
    delivery_date: Optional[date] = Field(None, description="交货日期")
    customer_id: Optional[int] = Field(None, description="客户ID")
    customer_name: Optional[str] = Field(None, description="客户名称")
    forecast_period: Optional[str] = Field(None, description="预测周期")
    order_date: Optional[date] = Field(None, description="订单日期")
    total_quantity: Decimal = Field(..., description="总数量")
    total_amount: Decimal = Field(..., description="总金额")
    status: str = Field(..., description="需求状态")
    review_status: str = Field(..., description="审核状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    
    class Config:
        from_attributes = True


# === 统一需求明细 ===

class DemandItemBase(BaseSchema):
    """统一需求明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    required_quantity: Decimal = Field(..., gt=0, description="需求数量")
    
    # 销售预测专用字段
    forecast_date: Optional[date] = Field(None, description="预测日期（销售预测专用）")
    forecast_month: Optional[str] = Field(None, max_length=7, description="预测月份（YYYY-MM，销售预测专用）")
    historical_sales: Optional[Decimal] = Field(None, ge=0, description="历史销量")
    historical_period: Optional[str] = Field(None, max_length=20, description="历史周期")
    confidence_level: Optional[Decimal] = Field(None, ge=0, le=100, description="置信度")
    forecast_method: Optional[str] = Field(None, max_length=50, description="预测方法")
    
    # 销售订单专用字段
    delivery_date: Optional[date] = Field(None, description="交货日期（销售订单专用）")
    delivered_quantity: Decimal = Field(Decimal("0"), ge=0, description="已交货数量")
    remaining_quantity: Optional[Decimal] = Field(None, ge=0, description="剩余数量")
    unit_price: Optional[Decimal] = Field(None, ge=0, description="单价")
    item_amount: Optional[Decimal] = Field(None, ge=0, description="金额")
    delivery_status: Optional[str] = Field(None, max_length=20, description="交货状态")
    
    # 关联工单（MTO模式）
    work_order_id: Optional[int] = Field(None, description="工单ID")
    work_order_code: Optional[str] = Field(None, max_length=50, description="工单编码")
    
    notes: Optional[str] = Field(None, description="备注")
    
    @field_validator('forecast_month')
    @classmethod
    def validate_forecast_month(cls, v):
        """验证预测月份格式"""
        if v:
            try:
                # 验证格式为 YYYY-MM
                parts = v.split('-')
                if len(parts) != 2:
                    raise ValueError("预测月份格式必须为 YYYY-MM")
                year, month = int(parts[0]), int(parts[1])
                if not (1 <= month <= 12):
                    raise ValueError("月份必须在1-12之间")
            except (ValueError, AttributeError):
                raise ValueError("预测月份格式必须为 YYYY-MM")
        return v


class DemandItemCreate(DemandItemBase):
    """统一需求明细创建schema"""
    pass


class DemandItemUpdate(DemandItemBase):
    """统一需求明细更新schema"""
    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    material_unit: Optional[str] = Field(None, max_length=20, description="物料单位")
    required_quantity: Optional[Decimal] = Field(None, gt=0, description="需求数量")


class DemandItemResponse(DemandItemBase):
    """统一需求明细响应schema"""
    id: int = Field(..., description="明细ID")
    uuid: str = Field(..., description="业务ID（UUID）")
    tenant_id: int = Field(..., description="租户ID")
    demand_id: int = Field(..., description="需求ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True


# 前向引用解析
DemandCreate.model_rebuild()
DemandResponse.model_rebuild()
