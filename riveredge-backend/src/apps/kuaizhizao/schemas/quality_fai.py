"""FAI schemas"""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class FaiCharacteristicBase(BaseSchema):
    sequence: int = 1
    balloon_no: Optional[str] = None
    characteristic_name: str
    nominal_value: Optional[float] = None
    upper_tolerance: Optional[float] = None
    lower_tolerance: Optional[float] = None
    unit: Optional[str] = None
    measured_value: Optional[float] = None
    sample_values: Optional[List[float]] = None
    judgment: str = "pending"
    gauge_id: Optional[int] = None
    gauge_code: Optional[str] = None
    gauge_name: Optional[str] = None
    source_step_key: Optional[str] = None
    remarks: Optional[str] = None


class FaiCharacteristicCreate(FaiCharacteristicBase):
    pass


class FaiCharacteristicResponse(FaiCharacteristicBase):
    id: int
    fai_order_id: int
    uuid: str
    tenant_id: int

    class Config:
        from_attributes = True


class FaiOrderBase(BaseSchema):
    fai_code: Optional[str] = None
    title: str
    trigger_reason: str = "new_part"
    status: str = "draft"
    conclusion: str = "pending"
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    drawing_no: Optional[str] = None
    drawing_revision: Optional[str] = None
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    inspection_plan_id: Optional[int] = None
    inspection_plan_code: Optional[str] = None
    part_number: Optional[str] = None
    part_name: Optional[str] = None
    serial_number: Optional[str] = None
    lot_number: Optional[str] = None
    material_spec: Optional[str] = None
    process_spec: Optional[str] = None
    organization_name: Optional[str] = None
    sample_size: int = 1
    cpk_summary: Optional[Any] = None
    drawing_file_url: Optional[str] = None
    balloon_candidates: Optional[List[Any]] = None
    attachments: Optional[Any] = None
    remarks: Optional[str] = None


class FaiOrderCreate(FaiOrderBase):
    characteristics: Optional[List[FaiCharacteristicCreate]] = None


class FaiOrderUpdate(BaseSchema):
    title: Optional[str] = None
    trigger_reason: Optional[str] = None
    status: Optional[str] = None
    conclusion: Optional[str] = None
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    drawing_no: Optional[str] = None
    drawing_revision: Optional[str] = None
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    inspection_plan_id: Optional[int] = None
    inspection_plan_code: Optional[str] = None
    part_number: Optional[str] = None
    part_name: Optional[str] = None
    serial_number: Optional[str] = None
    lot_number: Optional[str] = None
    material_spec: Optional[str] = None
    process_spec: Optional[str] = None
    organization_name: Optional[str] = None
    sample_size: Optional[int] = None
    drawing_file_url: Optional[str] = None
    balloon_candidates: Optional[List[Any]] = None
    attachments: Optional[Any] = None
    remarks: Optional[str] = None
    characteristics: Optional[List[FaiCharacteristicCreate]] = None
    fai_code: Optional[str] = None


class FaiOrderResponse(FaiOrderBase):
    id: int
    uuid: str
    tenant_id: int
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[int] = None
    approved_by_name: Optional[str] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    characteristics: Optional[List[FaiCharacteristicResponse]] = None

    class Config:
        from_attributes = True


class FaiOrderListResponse(BaseSchema):
    items: List[FaiOrderResponse]
    total: int


class FaiImportFromPlanRequest(BaseSchema):
    inspection_plan_id: int = Field(..., description="质检方案ID")


class FaiConfirmBalloonsRequest(BaseSchema):
    candidates: List[Any] = Field(..., description="确认后的气泡候选列表")
    replace_existing: bool = Field(True, description="是否替换现有特性行")


class FaiFairExportResponse(BaseSchema):
    fai_code: str
    form1: dict
    form2: dict
    form3: List[dict]
    cpk_summary: Optional[Any] = None
