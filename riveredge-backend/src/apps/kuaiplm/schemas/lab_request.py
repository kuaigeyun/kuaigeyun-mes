"""实验委托 Schema（R-02 / kuaiplm）。"""

from datetime import datetime
from typing import List, Optional

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class LabRequestMeasureItemBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    line_no: int = 1
    item_code: Optional[str] = Field(None, max_length=80)
    item_name: str = Field(..., max_length=200)
    unit: Optional[str] = Field(None, max_length=40)
    compare_type: str = Field("range", max_length=20)
    standard_min: Optional[str] = Field(None, max_length=80)
    standard_max: Optional[str] = Field(None, max_length=80)
    standard_value: Optional[str] = Field(None, max_length=80)
    measured_value: Optional[str] = Field(None, max_length=200)
    remarks: Optional[str] = None


class LabRequestMeasureItemResponse(LabRequestMeasureItemBase):
    id: int
    uuid: str
    lab_request_id: int
    judgment_rule_id: Optional[int] = None
    rule_version: Optional[str] = None
    auto_judgment: Optional[str] = None
    judgment_snapshot: Optional[dict] = None
    manual_judgment: Optional[str] = None
    manual_reason: Optional[str] = None
    manual_by: Optional[int] = None
    manual_by_name: Optional[str] = None
    manual_at: Optional[datetime] = None
    final_judgment: Optional[str] = None
    quality_exception_id: Optional[int] = None
    quality_exception_uuid: Optional[str] = None
    exception_linked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class LabRequestMeasurePlanItemInput(BaseModel):
    """草稿/待受理：维护试验项与标准（尚无实测）。"""

    line_no: Optional[int] = None
    item_code: Optional[str] = Field(None, max_length=80)
    item_name: Optional[str] = Field(None, max_length=200)
    unit: Optional[str] = Field(None, max_length=40)
    compare_type: str = Field("range", max_length=20)
    standard_min: Optional[str] = Field(None, max_length=80)
    standard_max: Optional[str] = Field(None, max_length=80)
    standard_value: Optional[str] = Field(None, max_length=80)
    judgment_rule_id: Optional[int] = None
    remarks: Optional[str] = None


class LabRequestMeasurePlanReplaceRequest(BaseModel):
    items: List[LabRequestMeasurePlanItemInput] = Field(default_factory=list)


class LabRequestMeasureValueInput(BaseModel):
    """实验中：按行录入实测；标准以库内行为准并冻结快照。"""

    id: int
    measured_value: Optional[str] = Field(None, max_length=200)


class LabRequestMeasuresSaveRequest(BaseModel):
    items: List[LabRequestMeasureValueInput] = Field(default_factory=list)


class LabRequestMeasureOverrideRequest(BaseModel):
    judgment: str = Field(..., max_length=20)
    reason: str = Field(..., min_length=1)


class LabRequestBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str = Field(..., max_length=200)
    business_type: str = Field("general", max_length=40)
    priority: str = Field("normal", max_length=20)
    project_id: Optional[int] = None
    project_code: Optional[str] = Field(None, max_length=80)
    material_id: Optional[int] = None
    material_code: Optional[str] = Field(None, max_length=80)
    material_name: Optional[str] = Field(None, max_length=200)
    sample_desc: Optional[str] = None
    test_items: Optional[str] = None
    test_reason: Optional[str] = None
    requester_name: Optional[str] = Field(None, max_length=100)
    lab_owner_name: Optional[str] = Field(None, max_length=100)
    expected_complete_at: Optional[datetime] = None
    result_summary: Optional[str] = None
    judgment: Optional[str] = Field(None, max_length=20)
    report_file_uuid: Optional[str] = Field(None, max_length=36)
    report_url: Optional[str] = Field(None, max_length=500)
    attachments: Optional[List[dict]] = None
    extension_payload: Optional[dict] = None
    remarks: Optional[str] = None


class LabRequestCreate(LabRequestBase):
    code: Optional[str] = Field(None, max_length=50)
    measure_items: Optional[List[LabRequestMeasurePlanItemInput]] = None


class LabRequestUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: Optional[str] = Field(None, max_length=200)
    business_type: Optional[str] = Field(None, max_length=40)
    priority: Optional[str] = Field(None, max_length=20)
    project_id: Optional[int] = None
    project_code: Optional[str] = Field(None, max_length=80)
    material_id: Optional[int] = None
    material_code: Optional[str] = Field(None, max_length=80)
    material_name: Optional[str] = Field(None, max_length=200)
    sample_desc: Optional[str] = None
    test_items: Optional[str] = None
    test_reason: Optional[str] = None
    requester_name: Optional[str] = Field(None, max_length=100)
    lab_owner_name: Optional[str] = Field(None, max_length=100)
    expected_complete_at: Optional[datetime] = None
    result_summary: Optional[str] = None
    judgment: Optional[str] = Field(None, max_length=20)
    report_file_uuid: Optional[str] = Field(None, max_length=36)
    report_url: Optional[str] = Field(None, max_length=500)
    attachments: Optional[List[dict]] = None
    extension_payload: Optional[dict] = None
    remarks: Optional[str] = None
    measure_items: Optional[List[LabRequestMeasurePlanItemInput]] = None


class LabRequestResponse(LabRequestBase):
    id: int
    uuid: str
    tenant_id: int
    code: str
    status: str
    report_status: str = "none"
    report_title: Optional[str] = None
    report_submitted_at: Optional[datetime] = None
    report_submitted_by: Optional[int] = None
    report_submitted_by_name: Optional[str] = None
    report_approved_at: Optional[datetime] = None
    report_approved_by: Optional[int] = None
    report_approved_by_name: Optional[str] = None
    report_rejected_at: Optional[datetime] = None
    report_reject_reason: Optional[str] = None
    outsource_price: Optional[Decimal] = None
    price_filled_by: Optional[int] = None
    price_filled_by_name: Optional[str] = None
    price_filled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    revoked_at: Optional[datetime] = None
    revoke_reason: Optional[str] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    measure_items: List[LabRequestMeasureItemResponse] = Field(default_factory=list)
    has_ng: bool = False


class LabRequestListItem(BaseModel):
    """列表不含实测明细，仅带 has_ng 供看板置顶。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    code: str
    title: str
    business_type: str
    status: str
    priority: str
    project_code: Optional[str] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    outsource_price: Optional[Decimal] = None
    price_filled_by_name: Optional[str] = None
    requester_name: Optional[str] = None
    lab_owner_name: Optional[str] = None
    expected_complete_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    judgment: Optional[str] = None
    report_status: str = "none"
    has_ng: bool = False
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class LabRequestListResponse(BaseModel):
    data: List[LabRequestListItem]
    total: int
    success: bool = True


class LabRequestFillOutsourcePriceRequest(BaseModel):
    outsource_price: Decimal = Field(..., gt=0, description="委外试验价格")


class LabRequestRejectRequest(BaseModel):
    reason: Optional[str] = None


class LabRequestRevokeRequest(BaseModel):
    reason: str = Field(..., min_length=1)


class LabRequestCompleteRequest(BaseModel):
    result_summary: Optional[str] = None
    judgment: Optional[str] = Field(None, max_length=20)
    report_file_uuid: Optional[str] = Field(None, max_length=36)
    report_url: Optional[str] = Field(None, max_length=500)


class LabRequestReportSaveRequest(BaseModel):
    report_title: Optional[str] = Field(None, max_length=200)
    result_summary: Optional[str] = None
    report_file_uuid: Optional[str] = Field(None, max_length=36)
    report_url: Optional[str] = Field(None, max_length=500)


class LabRequestReportRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1)


class LabRequestLinkExceptionRequest(BaseModel):
    problem_description: Optional[str] = None
    severity: str = Field("major", max_length=20)
    remarks: Optional[str] = None
