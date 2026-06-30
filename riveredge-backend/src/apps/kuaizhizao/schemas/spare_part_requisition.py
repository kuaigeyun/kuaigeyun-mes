"""备件领用单 Schema。"""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SparePartRequisitionLineInput(BaseModel):
    spare_part_id: int
    quantity: int = Field(..., ge=1)
    warehouse_location: Optional[str] = Field(default="默认库位", max_length=100)
    remark: Optional[str] = None


class SparePartRequisitionLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    line_no: int
    spare_part_id: int
    spare_part_uuid: Optional[str] = None
    part_no: Optional[str] = None
    part_name: Optional[str] = None
    quantity: int
    warehouse_location: Optional[str] = None
    unit: Optional[str] = None
    remark: Optional[str] = None


class SparePartRequisitionBase(BaseModel):
    equipment_id: Optional[int] = None
    purpose: Optional[str] = None
    remark: Optional[str] = None
    lines: List[SparePartRequisitionLineInput] = Field(default_factory=list)


class SparePartRequisitionCreate(SparePartRequisitionBase):
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = Field(None, max_length=100)


class SparePartRequisitionUpdate(BaseModel):
    equipment_id: Optional[int] = None
    purpose: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[SparePartRequisitionLineInput]] = None


class SparePartRequisitionReject(BaseModel):
    reject_reason: str


class SparePartRequisitionResponse(SparePartRequisitionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    requisition_no: str
    equipment_uuid: Optional[str] = None
    equipment_code: Optional[str] = None
    equipment_name: Optional[str] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    status: str
    approver_id: Optional[int] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: List[SparePartRequisitionLineResponse] = Field(default_factory=list)


class SparePartRequisitionListResponse(BaseModel):
    items: List[SparePartRequisitionResponse]
    total: int
    skip: int
    limit: int
