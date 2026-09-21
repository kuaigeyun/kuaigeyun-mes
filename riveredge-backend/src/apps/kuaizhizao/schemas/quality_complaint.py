"""质量投诉 Schema（R-11 WP-11B）。"""

from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from core.schemas.base import UuidStrCoerceMixin


class QualityComplaintBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str = Field(..., max_length=200)
    business_type: str = Field("iqc_incoming", max_length=30)
    defect_category: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_code: Optional[str] = Field(None, max_length=80)
    supplier_name: Optional[str] = Field(None, max_length=200)
    customer_id: Optional[int] = None
    customer_code: Optional[str] = Field(None, max_length=80)
    customer_name: Optional[str] = Field(None, max_length=200)
    material_id: Optional[int] = None
    material_code: Optional[str] = Field(None, max_length=80)
    material_name: Optional[str] = Field(None, max_length=200)
    batch_no: Optional[str] = Field(None, max_length=100)
    quantity: Optional[Decimal] = None
    unit: Optional[str] = Field(None, max_length=20)
    sla_workdays: int = Field(5, ge=1, le=365)
    attachments: Optional[List[dict]] = None
    eight_d_report_id: Optional[int] = None
    source_inspection_type: Optional[str] = Field(None, max_length=50)
    source_inspection_id: Optional[int] = None
    remarks: Optional[str] = None
    extension_payload: Optional[dict] = None


class QualityComplaintCreate(QualityComplaintBase):
    code: Optional[str] = Field(None, max_length=50)


class QualityComplaintUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: Optional[str] = Field(None, max_length=200)
    business_type: Optional[str] = Field(None, max_length=30)
    defect_category: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_code: Optional[str] = Field(None, max_length=80)
    supplier_name: Optional[str] = Field(None, max_length=200)
    customer_id: Optional[int] = None
    customer_code: Optional[str] = Field(None, max_length=80)
    customer_name: Optional[str] = Field(None, max_length=200)
    material_id: Optional[int] = None
    material_code: Optional[str] = Field(None, max_length=80)
    material_name: Optional[str] = Field(None, max_length=200)
    batch_no: Optional[str] = Field(None, max_length=100)
    quantity: Optional[Decimal] = None
    unit: Optional[str] = Field(None, max_length=20)
    sla_workdays: Optional[int] = Field(None, ge=1, le=365)
    corrective_sla_workdays: Optional[int] = Field(None, ge=1, le=365)
    attachments: Optional[List[dict]] = None
    eight_d_report_id: Optional[int] = None
    source_inspection_type: Optional[str] = Field(None, max_length=50)
    source_inspection_id: Optional[int] = None
    remarks: Optional[str] = None
    supplier_response: Optional[str] = None
    supplier_response_attachments: Optional[List[dict]] = None
    export_masked: Optional[bool] = None
    extension_payload: Optional[dict] = None


class QualityComplaintResponse(QualityComplaintBase, UuidStrCoerceMixin):
    id: int
    uuid: str
    tenant_id: int
    code: str
    status: str
    due_at: Optional[datetime] = None
    containment_due_at: Optional[datetime] = None
    corrective_due_at: Optional[datetime] = None
    corrective_sla_workdays: Optional[int] = None
    supplier_response: Optional[str] = None
    supplier_response_attachments: Optional[Any] = None
    export_masked: bool = False
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    closed_by_name: Optional[str] = None
    revoked_at: Optional[datetime] = None
    revoked_by_name: Optional[str] = None
    revoke_reason: Optional[str] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class QualityComplaintListItem(UuidStrCoerceMixin):

    id: int
    uuid: str
    code: str
    title: str
    business_type: str
    status: str
    defect_category: Optional[str] = None
    supplier_name: Optional[str] = None
    customer_name: Optional[str] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    batch_no: Optional[str] = None
    quantity: Optional[Decimal] = None
    due_at: Optional[datetime] = None
    export_masked: bool = False
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class QualityComplaintListResponse(BaseModel):
    data: List[QualityComplaintListItem]
    total: int
    success: bool = True


class QualityComplaintRevokeRequest(BaseModel):
    reason: str = Field(..., min_length=1, description="撤销原因")


class QualityComplaintSupplierResponseRequest(BaseModel):
    supplier_response: str = Field(..., min_length=1)
    supplier_response_attachments: Optional[List[dict]] = None
