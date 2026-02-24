"""
销售订单管理模块数据验证schema

提供销售订单相关的数据验证和序列化。

Author: Luigi Lu
Date: 2026-01-19
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import Field, field_validator, model_validator
from core.schemas.base import BaseSchema
from apps.kuaizhizao.constants import DemandStatus, ReviewStatus


# === 销售订单明细 ===

class SalesOrderItemBase(BaseSchema):
    """销售订单明细基础schema"""
    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: str = Field(..., max_length=100, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: Optional[str] = Field(None, max_length=20, description="物料单位")
    required_quantity: Decimal = Field(..., gt=0, description="需求数量")
    delivery_date: date = Field(..., description="交货日期")
    unit_price: Optional[Decimal] = Field(None, ge=0, description="单价")
    item_amount: Optional[Decimal] = Field(None, ge=0, description="金额")
    notes: Optional[str] = Field(None, description="备注")


class SalesOrderItemCreate(SalesOrderItemBase):
    """创建销售订单明细schema"""
    pass


class SalesOrderItemUpdate(BaseSchema):
    """更新销售订单明细schema"""
    material_id: Optional[int] = None
    material_code: Optional[str] = Field(None, max_length=100)
    material_name: Optional[str] = Field(None, max_length=200)
    material_spec: Optional[str] = Field(None, max_length=200)
    material_unit: Optional[str] = Field(None, max_length=20)
    required_quantity: Optional[Decimal] = Field(None, gt=0)
    delivery_date: Optional[date] = None
    unit_price: Optional[Decimal] = Field(None, ge=0)
    item_amount: Optional[Decimal] = Field(None, ge=0)
    notes: Optional[str] = None


class SalesOrderItemResponse(SalesOrderItemBase):
    """销售订单明细响应schema"""
    id: int
    uuid: str
    tenant_id: int
    sales_order_id: int
    delivered_quantity: Optional[Decimal] = Field(None, description="已交货数量")
    remaining_quantity: Optional[Decimal] = Field(None, description="剩余数量")
    delivery_status: Optional[str] = Field(None, max_length=20, description="交货状态")
    work_order_id: Optional[int] = Field(None, description="工单ID")
    work_order_code: Optional[str] = Field(None, max_length=50, description="工单编码")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# === 销售订单 ===

class SalesOrderBase(BaseSchema):
    """销售订单基础schema"""
    order_code: Optional[str] = Field(None, max_length=50, description="订单编码（自动生成，无需填写）")
    order_name: Optional[str] = Field(None, max_length=200, description="订单名称（选填，不填时以订单编码作为展示名）")
    order_date: date = Field(..., description="订单日期")
    delivery_date: date = Field(..., description="交货日期")
    
    # 客户信息（必填）
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    customer_contact: Optional[str] = Field(None, max_length=100, description="客户联系人")
    customer_phone: Optional[str] = Field(None, max_length=20, description="客户电话")
    
    # 金额信息
    total_quantity: Decimal = Field(Decimal("0"), ge=0, description="总数量")
    total_amount: Decimal = Field(Decimal("0"), ge=0, description="总金额")
    
    # 状态
    status: DemandStatus = Field(DemandStatus.DRAFT, description="订单状态")
    
    # 时间节点记录（用于耗时统计）
    submit_time: Optional[datetime] = Field(None, description="提交时间")
    
    # 审核信息
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: ReviewStatus = Field(ReviewStatus.PENDING, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    
    # 销售信息
    salesman_id: Optional[int] = Field(None, description="销售员ID")
    salesman_name: Optional[str] = Field(None, max_length=100, description="销售员姓名")
    
    # 物流信息
    shipping_address: Optional[str] = Field(None, description="收货地址")
    shipping_method: Optional[str] = Field(None, max_length=50, description="发货方式")
    payment_terms: Optional[str] = Field(None, max_length=100, description="付款条件")
    
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class SalesOrderCreate(SalesOrderBase):
    """创建销售订单schema"""
    items: List[SalesOrderItemCreate] = Field(default_factory=list, description="订单明细")
    
    @model_validator(mode='after')
    def validate_items(self):
        """验证订单明细"""
        if not self.items or len(self.items) == 0:
            raise ValueError("销售订单必须至少包含一条明细")
        return self


class SalesOrderUpdate(BaseSchema):
    """更新销售订单schema"""
    order_name: Optional[str] = Field(None, max_length=200)
    order_date: Optional[date] = None
    delivery_date: Optional[date] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = Field(None, max_length=200)
    customer_contact: Optional[str] = Field(None, max_length=100)
    customer_phone: Optional[str] = Field(None, max_length=20)
    total_quantity: Optional[Decimal] = Field(None, ge=0)
    total_amount: Optional[Decimal] = Field(None, ge=0)
    status: Optional[str] = Field(None, max_length=20)
    salesman_id: Optional[int] = None
    salesman_name: Optional[str] = Field(None, max_length=100)
    shipping_address: Optional[str] = None
    shipping_method: Optional[str] = Field(None, max_length=50)
    payment_terms: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = None
    items: Optional[List[SalesOrderItemCreate]] = None


class SalesOrderResponse(SalesOrderBase):
    """销售订单响应schema"""
    id: int
    uuid: str
    tenant_id: int
    pushed_to_computation: bool = Field(False, description="是否已下推到需求计算")
    computation_id: Optional[int] = Field(None, description="需求计算ID")
    computation_code: Optional[str] = Field(None, max_length=50, description="需求计算编码")
    is_active: bool = Field(True, description="是否启用")
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    items: Optional[List[SalesOrderItemResponse]] = Field(None, description="订单明细")
    duration_info: Optional[dict] = Field(None, description="耗时统计信息")
    delivery_progress: Optional[float] = Field(None, description="交货进度 0-100")
    invoice_progress: Optional[float] = Field(None, description="开票进度 0-100")
    demand_synced: Optional[bool] = Field(None, description="本次操作是否已同步至关联需求")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供前端 UniLifecycleStepper 展示）")

    class Config:
        from_attributes = True


class SalesOrderListResponse(BaseSchema):
    """销售订单列表响应schema"""
    data: List[SalesOrderResponse]
    total: int
    success: bool = True
