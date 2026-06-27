"""订单变更单 schemas（销售/采购对称）"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from apps.kuaizhizao.services.document_action_policy.types import SalesOrderChangeCapabilities
from core.schemas.base import BaseSchema


class OrderChangeItemBase(BaseModel):
    source_item_id: Optional[int] = None
    change_type: str
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    material_spec: Optional[str] = None
    material_unit: Optional[str] = None
    before_quantity: Optional[Decimal] = None
    after_quantity: Optional[Decimal] = None
    before_unit_price: Optional[Decimal] = None
    after_unit_price: Optional[Decimal] = None
    before_delivery_date: Optional[date] = None
    after_delivery_date: Optional[date] = None
    before_amount: Optional[Decimal] = None
    after_amount: Optional[Decimal] = None
    delta_amount: Optional[Decimal] = None
    notes: Optional[str] = None


class OrderChangeItemCreate(OrderChangeItemBase):
    line_no: Optional[int] = None


class OrderChangeItemUpdate(OrderChangeItemBase):
    id: Optional[int] = None
    line_no: Optional[int] = None


class OrderChangeItemResponse(OrderChangeItemBase):
    id: int
    line_no: int
    change_order_id: Optional[int] = None

    class Config:
        from_attributes = True


class OrderChangeOrderBase(BaseModel):
    change_reason: str = Field(..., min_length=1)
    change_category: Optional[str] = "MIXED"
    effective_date: Optional[date] = None
    header_changes: Optional[Dict[str, Any]] = None
    attachments: Optional[List[Any]] = None
    notes: Optional[str] = None


class SalesOrderChangeCreate(OrderChangeOrderBase):
    source_order_id: int
    items: List[OrderChangeItemCreate] = Field(default_factory=list)


class SalesOrderChangeUpdate(OrderChangeOrderBase):
    items: Optional[List[OrderChangeItemUpdate]] = None


class PurchaseOrderChangeCreate(OrderChangeOrderBase):
    source_order_id: int
    items: List[OrderChangeItemCreate] = Field(default_factory=list)


class PurchaseOrderChangeUpdate(OrderChangeOrderBase):
    items: Optional[List[OrderChangeItemUpdate]] = None


class OrderChangeListResponse(BaseSchema):
    id: int
    change_code: str
    source_order_id: int
    source_order_code: str
    change_version: int
    change_category: str
    change_reason: str
    status: str
    review_status: str
    before_total_amount: Decimal
    after_total_amount: Decimal
    delta_amount: Decimal
    applied_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    lifecycle: Optional[Dict[str, Any]] = None
    partner_name: Optional[str] = None
    capabilities: Optional[SalesOrderChangeCapabilities] = Field(
        None,
        description="业务态动作 capabilities（不含 RBAC）",
    )


class SalesOrderChangeListResponse(OrderChangeListResponse):
    customer_id: int
    customer_name: str


class PurchaseOrderChangeListResponse(OrderChangeListResponse):
    supplier_id: int
    supplier_name: str


class SalesOrderChangeResponse(SalesOrderChangeListResponse):
    pass


class PurchaseOrderChangeResponse(PurchaseOrderChangeListResponse):
    pass


class OrderChangeWithItemsResponse(OrderChangeListResponse):
    items: List[OrderChangeItemResponse] = Field(default_factory=list)
    header_changes: Optional[Dict[str, Any]] = None
    attachments: Optional[List[Any]] = None
    notes: Optional[str] = None
    reviewer_name: Optional[str] = None
    review_time: Optional[datetime] = None
    review_remarks: Optional[str] = None
    before_total_quantity: Optional[Decimal] = None
    after_total_quantity: Optional[Decimal] = None


class SalesOrderChangeWithItemsResponse(OrderChangeWithItemsResponse):
    customer_id: int
    customer_name: str


class PurchaseOrderChangeWithItemsResponse(OrderChangeWithItemsResponse):
    supplier_id: int
    supplier_name: str


class ChangeImpactPreviewResponse(BaseModel):
    blocking_errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    affected_demands: List[Dict[str, Any]] = Field(default_factory=list)
    affected_computations: List[Dict[str, Any]] = Field(default_factory=list)
    affected_plans: List[Dict[str, Any]] = Field(default_factory=list)
    affected_work_orders: List[Dict[str, Any]] = Field(default_factory=list)
    affected_receipt_notices: List[Dict[str, Any]] = Field(default_factory=list)
    affected_inbounds: List[Dict[str, Any]] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)


class ApproveChangeRequest(BaseModel):
    approved: bool = True
    review_remarks: Optional[str] = None
