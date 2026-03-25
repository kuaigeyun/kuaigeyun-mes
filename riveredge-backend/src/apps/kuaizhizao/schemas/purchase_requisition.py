"""
采购申请数据验证Schema

Author: RiverEdge Team
Date: 2025-02-01
"""

from datetime import date, datetime
from typing import Dict, List, Optional
from decimal import Decimal

from pydantic import BaseModel, Field, ConfigDict, field_validator


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
    converted_quantity_draft: Optional[Decimal] = Field(0, description="已下推数量（草稿）")
    converted_quantity_confirmed: Optional[Decimal] = Field(0, description="已下推数量（已确认）")
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
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")


class PurchaseRequisitionListResponse(PurchaseRequisitionResponse):
    """采购申请列表响应"""
    items_count: Optional[int] = None


class ConvertToPurchaseOrderRequest(BaseModel):
    """转采购单请求"""
    item_ids: List[int] = Field(..., description="要转单的采购申请行ID列表")
    supplier_id: Optional[int] = Field(None, description="统一供应商ID（行未指定且无 item_suppliers 映射时使用）")
    supplier_name: Optional[str] = Field(None, description="统一供应商名称（可选，缺省由服务端按 supplier_id 解析）")
    item_quantities: Optional[Dict[int, float]] = Field(None, description="按 item_id 覆盖数量，不传则用申请行原数量")
    item_suppliers: Optional[Dict[int, int]] = Field(
        None,
        description="申请行ID -> 供应商ID；优先于申请行上的 supplier_id 与顶层的 supplier_id，支持多供应商拆单",
    )
    persist_default_supplier_to_material: bool = Field(
        False,
        description="转单成功后，将本次下推使用的供应商写回采购件物料来源配置中的默认供应商",
    )

    @field_validator("item_suppliers", mode="before")
    @classmethod
    def _coerce_item_supplier_keys(cls, v):
        if v is None:
            return v
        if not isinstance(v, dict):
            return v
        return {int(k): int(val) for k, val in v.items()}


class ApproveRequisitionRequest(BaseModel):
    """审核采购申请请求"""
    approved: bool = Field(True, description="是否通过")
    review_remarks: Optional[str] = Field(None, description="审核备注/驳回原因")


class UrgentPurchaseRequest(BaseModel):
    """紧急采购请求"""
    urgent_reason: str = Field(..., min_length=1, description="紧急原因（必填）")
