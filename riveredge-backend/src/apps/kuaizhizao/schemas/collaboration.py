"""
协同平台数据验证Schema模块

定义供应商协同和客户协同相关的Pydantic数据验证Schema。

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from decimal import Decimal


# ==================== 供应商协同 Schema ====================

class PurchaseOrderProgressUpdateRequest(BaseModel):
    """更新采购订单进度请求"""
    progress_percentage: Optional[float] = Field(None, ge=0, le=100, description="完成百分比")
    estimated_delivery_date: Optional[date] = Field(None, description="预计交货日期")
    remarks: Optional[str] = Field(None, description="备注")


class DeliveryNoticeRequest(BaseModel):
    """提交发货通知请求"""
    delivery_quantity: Decimal = Field(..., description="发货数量")
    delivery_date: date = Field(..., description="发货日期")
    tracking_number: Optional[str] = Field(None, description="物流单号")
    remarks: Optional[str] = Field(None, description="备注")


# ==================== 客户协同 Schema ====================

class SalesOrderProductionProgressResponse(BaseModel):
    """销售订单生产进度响应"""
    sales_order_id: int = Field(..., description="销售订单ID")
    sales_order_code: str = Field(..., description="销售订单编码")
    total_work_orders: int = Field(..., description="总工单数")
    completed_work_orders: int = Field(..., description="已完成工单数")
    in_progress_work_orders: int = Field(..., description="进行中工单数")
    progress_percentage: float = Field(..., ge=0, le=100, description="生产进度百分比")
    work_orders: List[Dict[str, Any]] = Field(..., description="工单详情列表")
    updated_at: str = Field(..., description="更新时间")


class CustomerOrderSummaryResponse(BaseModel):
    """客户订单汇总响应"""
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., description="客户名称")
    total_orders: int = Field(..., description="总订单数")
    pending_orders: int = Field(..., description="待处理订单数")
    in_progress_orders: int = Field(..., description="进行中订单数")
    completed_orders: int = Field(..., description="已完成订单数")
    total_amount: float = Field(..., description="总金额")
    updated_at: str = Field(..., description="更新时间")
