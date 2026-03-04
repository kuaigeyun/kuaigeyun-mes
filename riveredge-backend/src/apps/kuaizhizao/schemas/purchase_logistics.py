"""
采购物流记录数据验证 schema

Author: RiverEdge Team
Date: 2026-03-04
"""

from datetime import datetime, date
from typing import Optional
from pydantic import Field
from core.schemas.base import BaseSchema


class PurchaseLogisticsBase(BaseSchema):
    """采购物流记录基础 schema"""
    purchase_order_id: int = Field(..., description="采购订单ID")
    purchase_order_code: str = Field(..., max_length=50, description="采购订单编码")
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., max_length=200, description="供应商名称")
    carrier: str = Field(..., max_length=100, description="承运商/物流公司")
    tracking_number: str = Field(..., max_length=100, description="物流运单号")
    shipped_at: Optional[date] = Field(None, description="发货日期")
    expected_arrival: Optional[date] = Field(None, description="预计到货日期")
    status: str = Field("在途", max_length=20, description="物流状态")
    notes: Optional[str] = Field(None, description="备注")


class PurchaseLogisticsCreate(PurchaseLogisticsBase):
    """采购物流记录创建 schema"""
    pass


class PurchaseLogisticsUpdate(BaseSchema):
    """采购物流记录更新 schema"""
    carrier: Optional[str] = Field(None, max_length=100, description="承运商/物流公司")
    tracking_number: Optional[str] = Field(None, max_length=100, description="物流运单号")
    shipped_at: Optional[date] = Field(None, description="发货日期")
    expected_arrival: Optional[date] = Field(None, description="预计到货日期")
    status: Optional[str] = Field(None, max_length=20, description="物流状态")
    receipt_notice_id: Optional[int] = Field(None, description="关联收货通知单ID")
    receipt_notice_code: Optional[str] = Field(None, max_length=50, description="收货通知单编码")
    notes: Optional[str] = Field(None, description="备注")


class PurchaseLogisticsResponse(PurchaseLogisticsBase):
    """采购物流记录响应 schema"""
    id: int = Field(..., description="记录ID")
    tenant_id: int = Field(..., description="租户ID")
    receipt_notice_id: Optional[int] = Field(None, description="关联收货通知单ID")
    receipt_notice_code: Optional[str] = Field(None, max_length=50, description="收货通知单编码")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True
