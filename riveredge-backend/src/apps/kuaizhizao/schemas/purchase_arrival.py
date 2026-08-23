"""采购到货延期填报 Schema"""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict

from core.schemas.base import BaseSchema


DELAY_REASON_OPTIONS = (
    "supplier_capacity",
    "logistics",
    "quality_rework",
    "drawing_change",
    "payment_delay",
    "other",
)


class PurchaseArrivalDelayReportCreate(BaseSchema):
    purchase_order_item_id: int = Field(..., description="采购订单明细ID")
    delay_reason: str = Field(..., max_length=50)
    estimated_arrival_date: date = Field(..., description="预计新到货日")
    impact_description: Optional[str] = Field(None, description="影响说明")
    attachments: Optional[List[dict]] = None
    notes: Optional[str] = None


class PurchaseArrivalDelayReportUpdate(BaseSchema):
    delay_reason: Optional[str] = Field(None, max_length=50)
    estimated_arrival_date: Optional[date] = None
    impact_description: Optional[str] = None
    attachments: Optional[List[dict]] = None
    notes: Optional[str] = None


class ApproveDelayReportRequest(BaseModel):
    approved: bool = True
    review_remarks: Optional[str] = None


class PurchaseArrivalDelayReportResponse(BaseSchema):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    report_code: str
    purchase_order_id: int
    purchase_order_item_id: int
    order_code: str
    material_id: int
    material_code: str
    material_name: str
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    planned_arrival_date: date
    delay_reason: str
    estimated_arrival_date: date
    impact_description: Optional[str] = None
    impacted_assembly_summary: Optional[str] = None
    status: str
    review_status: str
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_time: Optional[datetime] = None
    review_remarks: Optional[str] = None
    purchase_order_change_id: Optional[int] = None
    purchase_order_change_code: Optional[str] = None
    attachments: Optional[List[dict]] = None
    notes: Optional[str] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PurchaseArrivalDelayReportListResponse(BaseModel):
    items: List[PurchaseArrivalDelayReportResponse]
    total: int
    skip: int
    limit: int


class PurchaseArrivalWarningListResponse(BaseModel):
    data: List[dict]
    total: int
    success: bool = True
    summary: dict
