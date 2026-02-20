"""
样品试用单数据验证schema

客户申请样品试用，可转正式销售订单，样品出库可通过其他出库（原因：样品）。

Author: RiverEdge Team
Date: 2026-02-19
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List
from pydantic import Field
from core.schemas.base import BaseSchema


# === 样品试用单 ===

class SampleTrialBase(BaseSchema):
    """样品试用单基础schema"""
    trial_code: Optional[str] = Field(None, max_length=50, description="试用单编码（可选，不提供则自动生成）")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    customer_contact: Optional[str] = Field(None, max_length=100, description="客户联系人")
    customer_phone: Optional[str] = Field(None, max_length=50, description="客户电话")
    trial_purpose: Optional[str] = Field(None, max_length=200, description="试用目的")
    trial_period_start: Optional[date] = Field(None, description="试用开始日期")
    trial_period_end: Optional[date] = Field(None, description="试用结束日期")
    status: str = Field("草稿", max_length=20, description="试用状态")
    notes: Optional[str] = Field(None, description="备注")


class SampleTrialCreate(SampleTrialBase):
    """样品试用单创建schema"""
    items: Optional[List["SampleTrialItemCreate"]] = Field(None, description="试用明细列表")


class SampleTrialUpdate(SampleTrialBase):
    """样品试用单更新schema"""
    trial_code: Optional[str] = Field(None, max_length=50, description="试用单编码")
    items: Optional[List["SampleTrialItemCreate"]] = Field(None, description="试用明细列表（提供则覆盖全部明细）")


class SampleTrialResponse(SampleTrialBase):
    """样品试用单响应schema"""
    id: int = Field(..., description="试用单ID")
    tenant_id: int = Field(..., description="租户ID")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    sales_order_code: Optional[str] = Field(None, max_length=50, description="关联销售订单编码")
    other_outbound_id: Optional[int] = Field(None, description="关联其他出库单ID")
    other_outbound_code: Optional[str] = Field(None, max_length=50, description="关联其他出库单编码")
    total_quantity: float = Field(0, description="总数量")
    total_amount: float = Field(0, description="总金额")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class SampleTrialListResponse(SampleTrialResponse):
    """样品试用单列表响应schema"""
    pass


# === 样品试用单明细 ===

class SampleTrialItemBase(BaseSchema):
    """样品试用单明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    trial_quantity: float = Field(..., gt=0, description="试用数量")
    unit_price: float = Field(0, ge=0, description="单价")
    total_amount: Optional[float] = Field(None, ge=0, description="金额")
    notes: Optional[str] = Field(None, description="备注")


class SampleTrialItemCreate(SampleTrialItemBase):
    """样品试用单明细创建schema"""
    pass


class SampleTrialItemUpdate(SampleTrialItemBase):
    """样品试用单明细更新schema"""
    pass


class SampleTrialItemResponse(SampleTrialItemBase):
    """样品试用单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    trial_id: int = Field(..., description="试用单ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class SampleTrialWithItemsResponse(SampleTrialResponse):
    """样品试用单详情响应（含明细）"""
    items: List[SampleTrialItemResponse] = Field(default_factory=list, description="试用明细列表")
