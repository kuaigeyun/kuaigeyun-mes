"""
采购申请数据验证Schema

Author: RiverEdge Team
Date: 2025-02-01
"""

from datetime import date, datetime
from typing import List, Optional
from decimal import Decimal

from pydantic import BaseModel, Field, ConfigDict


class PurchaseRequisitionItemBase(BaseModel):
    """采购申请行基础"""
    model_config = ConfigDict(from_attributes=True)

    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    unit: str = Field("件", max_length=20, description="单位")
    quantity: Decimal = Field(..., gt=0, description="申请数量")
    suggested_unit_price: Decimal = Field(Decimal(0), ge=0, description="建议单价")
    required_date: Optional[date] = Field(None, description="要求到货日期")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    notes: Optional[str] = Field(None, description="备注")


class PurchaseRequisitionItemCreate(PurchaseRequisitionItemBase):
    """采购申请行创建"""
    demand_computation_item_id: Optional[int] = Field(None, description="需求计算明细ID")


class PurchaseRequisitionItemUpdate(BaseModel):
    """采购申请行更新"""
    quantity: Optional[Decimal] = Field(None, gt=0)
    suggested_unit_price: Optional[Decimal] = Field(None, ge=0)
    required_date: Optional[date] = None
    supplier_id: Optional[int] = None
    notes: Optional[str] = None


class PurchaseRequisitionItemResponse(PurchaseRequisitionItemBase):
    """采购申请行响应"""
    id: int
    requisition_id: int
    tenant_id: int
    demand_computation_item_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    purchase_order_item_id: Optional[int] = None
    supplier_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class PurchaseRequisitionBase(BaseModel):
    """采购申请头基础"""
    model_config = ConfigDict(from_attributes=True)

    requisition_code: str = Field(..., max_length=50, description="申请编码")
    requisition_name: Optional[str] = Field(None, max_length=200, description="申请名称")
    status: str = Field("草稿", max_length=20, description="状态")
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    requisition_date: Optional[date] = None
    required_date: Optional[date] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None
    source_code: Optional[str] = None
    is_urgent: bool = Field(False, description="是否紧急采购")
    urgent_reason: Optional[str] = None
    notes: Optional[str] = None


class PurchaseRequisitionCreate(BaseModel):
    """采购申请创建"""
    requisition_code: Optional[str] = None
    requisition_name: Optional[str] = None
    required_date: Optional[date] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None
    source_code: Optional[str] = None
    notes: Optional[str] = None
    items: List[PurchaseRequisitionItemCreate] = Field(..., description="申请明细")


class PurchaseRequisitionUpdate(BaseModel):
    """采购申请更新"""
    requisition_name: Optional[str] = None
    required_date: Optional[date] = None
    notes: Optional[str] = None
    items: Optional[List[PurchaseRequisitionItemCreate]] = None


class PurchaseRequisitionResponse(PurchaseRequisitionBase):
    """采购申请响应"""
    id: int
    tenant_id: int
    urgent_operator_id: Optional[int] = None
    urgent_operated_at: Optional[datetime] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_time: Optional[datetime] = None
    review_status: str = "待审核"
    review_remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseRequisitionItemResponse] = Field(default_factory=list)


class PurchaseRequisitionListResponse(PurchaseRequisitionResponse):
    """采购申请列表响应"""
    items_count: Optional[int] = None


class ConvertToPurchaseOrderRequest(BaseModel):
    """转采购单请求"""
    item_ids: List[int] = Field(..., description="要转单的采购申请行ID列表")
    supplier_id: int = Field(..., description="供应商ID")
    supplier_name: str = Field(..., description="供应商名称")


class UrgentPurchaseRequest(BaseModel):
    """紧急采购请求"""
    urgent_reason: str = Field(..., min_length=1, description="紧急原因（必填）")
