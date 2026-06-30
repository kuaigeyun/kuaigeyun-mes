"""
模具运营扩展 Schema：保养/维修主数据与业务单据。

Author: RiverEdge
Date: 2026-06-29
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Any

from pydantic import BaseModel, Field, ConfigDict


# ---------- 模具保养项 ----------

class MoldMaintenanceItemBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_active: bool = True


class MoldMaintenanceItemCreate(MoldMaintenanceItemBase):
    pass


class MoldMaintenanceItemUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_active: Optional[bool] = None


class MoldMaintenanceItemResponse(MoldMaintenanceItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class MoldMaintenanceItemListResponse(BaseModel):
    items: List[MoldMaintenanceItemResponse]
    total: int
    skip: int
    limit: int


# ---------- 模具保养方案 ----------

class MoldMaintenanceSchemeLineBase(BaseModel):
    item_id: int
    sort_order: int = 0
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None


class MoldMaintenanceSchemeLineCreate(MoldMaintenanceSchemeLineBase):
    pass


class MoldMaintenanceSchemeLineResponse(MoldMaintenanceSchemeLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scheme_id: int


class MoldMaintenanceSchemeBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    trigger_type: str = Field(default="usage_count", max_length=32)
    trigger_interval_days: Optional[int] = Field(None, ge=1)
    trigger_interval_usage: Optional[int] = Field(None, ge=1)
    is_active: bool = True


class MoldMaintenanceSchemeCreate(MoldMaintenanceSchemeBase):
    lines: Optional[List[MoldMaintenanceSchemeLineCreate]] = None


class MoldMaintenanceSchemeUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    trigger_type: Optional[str] = Field(None, max_length=32)
    trigger_interval_days: Optional[int] = Field(None, ge=1)
    trigger_interval_usage: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None
    lines: Optional[List[MoldMaintenanceSchemeLineCreate]] = None


class MoldMaintenanceSchemeResponse(MoldMaintenanceSchemeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    lines: Optional[List[MoldMaintenanceSchemeLineResponse]] = None


class MoldMaintenanceSchemeListResponse(BaseModel):
    items: List[MoldMaintenanceSchemeResponse]
    total: int
    skip: int
    limit: int


# ---------- 模具维修项 ----------

class MoldRepairItemBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_active: bool = True


class MoldRepairItemCreate(MoldRepairItemBase):
    pass


class MoldRepairItemUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_active: Optional[bool] = None


class MoldRepairItemResponse(MoldRepairItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class MoldRepairItemListResponse(BaseModel):
    items: List[MoldRepairItemResponse]
    total: int
    skip: int
    limit: int


# ---------- 模具维修方案 ----------

class MoldRepairSchemeLineBase(BaseModel):
    item_id: int
    sort_order: int = 0
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None


class MoldRepairSchemeLineCreate(MoldRepairSchemeLineBase):
    pass


class MoldRepairSchemeLineResponse(MoldRepairSchemeLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scheme_id: int


class MoldRepairSchemeBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    is_active: bool = True


class MoldRepairSchemeCreate(MoldRepairSchemeBase):
    lines: Optional[List[MoldRepairSchemeLineCreate]] = None


class MoldRepairSchemeUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    lines: Optional[List[MoldRepairSchemeLineCreate]] = None


class MoldRepairSchemeResponse(MoldRepairSchemeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    lines: Optional[List[MoldRepairSchemeLineResponse]] = None


class MoldRepairSchemeListResponse(BaseModel):
    items: List[MoldRepairSchemeResponse]
    total: int
    skip: int
    limit: int


# ---------- 模具方案绑定 ----------

class MoldSchemeBindingBase(BaseModel):
    mold_id: int
    scheme_id: int
    scheme_type: str = Field(default="maintenance", max_length=32)


class MoldSchemeBindingCreate(MoldSchemeBindingBase):
    pass


class MoldSchemeBindingBulkReplace(BaseModel):
    mold_id: int
    scheme_type: str = Field(default="maintenance", max_length=32)
    scheme_ids: List[int] = Field(default_factory=list)


class MoldSchemeBindingResponse(MoldSchemeBindingBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    mold_uuid: str
    created_at: datetime
    updated_at: datetime


# ---------- 试模单 ----------

class MoldTrialCreate(BaseModel):
    mold_id: int
    trial_date: Optional[date] = None
    trial_result: Optional[str] = Field(None, max_length=50)
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    remark: Optional[str] = None


class MoldTrialUpdate(BaseModel):
    trial_date: Optional[date] = None
    trial_result: Optional[str] = Field(None, max_length=50)
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None


class MoldTrialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    mold_id: int
    mold_uuid: str
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    trial_date: date
    trial_result: Optional[str] = None
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    status: str
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MoldTrialListResponse(BaseModel):
    items: List[MoldTrialResponse]
    total: int
    skip: int
    limit: int


# ---------- 领用单 ----------

class MoldBorrowCreate(BaseModel):
    mold_id: int
    borrow_date: Optional[datetime] = None
    borrower_id: Optional[int] = None
    borrower_name: Optional[str] = None
    department_name: Optional[str] = Field(None, max_length=200)
    expected_return_date: Optional[date] = None
    source_type: Optional[str] = Field(None, max_length=50)
    source_id: Optional[int] = None
    source_no: Optional[str] = Field(None, max_length=100)
    remark: Optional[str] = None


class MoldBorrowUpdate(BaseModel):
    borrow_date: Optional[datetime] = None
    borrower_id: Optional[int] = None
    borrower_name: Optional[str] = None
    department_name: Optional[str] = Field(None, max_length=200)
    expected_return_date: Optional[date] = None
    remark: Optional[str] = None


class MoldBorrowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    mold_id: int
    mold_uuid: str
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    borrow_date: datetime
    borrower_id: Optional[int] = None
    borrower_name: Optional[str] = None
    department_name: Optional[str] = None
    expected_return_date: Optional[date] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None
    source_no: Optional[str] = None
    status: str
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MoldBorrowListResponse(BaseModel):
    items: List[MoldBorrowResponse]
    total: int
    skip: int
    limit: int


# ---------- 归还单 ----------

class MoldReturnCreate(BaseModel):
    mold_id: int
    borrow_id: Optional[int] = None
    return_date: Optional[datetime] = None
    usage_count: int = Field(default=1, ge=1)
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    source_type: Optional[str] = Field(None, max_length=50)
    source_id: Optional[int] = None
    source_no: Optional[str] = Field(None, max_length=100)
    reporting_record_id: Optional[int] = None
    remark: Optional[str] = None


class MoldReturnUpdate(BaseModel):
    return_date: Optional[datetime] = None
    usage_count: Optional[int] = Field(None, ge=1)
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    remark: Optional[str] = None


class MoldReturnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    mold_id: int
    mold_uuid: str
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    borrow_id: Optional[int] = None
    return_date: datetime
    usage_count: int
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None
    source_no: Optional[str] = None
    reporting_record_id: Optional[int] = None
    status: str
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MoldReturnListResponse(BaseModel):
    items: List[MoldReturnResponse]
    total: int
    skip: int
    limit: int


# ---------- 保养单 preview / 行 ----------

class MoldMaintenancePreviewLine(BaseModel):
    line_no: int
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_done: bool = False
    result_value: Optional[str] = None


class MoldMaintenancePreviewResponse(BaseModel):
    mold_id: int
    scheme_id: int
    scheme_code: Optional[str] = None
    scheme_name: Optional[str] = None
    lines: List[MoldMaintenancePreviewLine]


class MoldMaintenanceLineInput(BaseModel):
    line_no: int = 1
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_done: bool = False
    result_value: Optional[str] = None
    remark: Optional[str] = None


class MoldMaintenanceLineResponse(MoldMaintenanceLineInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    maintenance_id: int


class MoldMaintenanceCreate(BaseModel):
    mold_id: int
    scheme_id: Optional[int] = None
    planned_date: Optional[date] = None
    maintenance_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[MoldMaintenanceLineInput]] = None


class MoldMaintenanceUpdate(BaseModel):
    scheme_id: Optional[int] = None
    planned_date: Optional[date] = None
    maintenance_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[MoldMaintenanceLineInput]] = None


class MoldMaintenanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    mold_id: int
    mold_uuid: str
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    scheme_id: Optional[int] = None
    planned_date: Optional[date] = None
    maintenance_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    status: str
    approver_id: Optional[int] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    completed_at: Optional[datetime] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: Optional[List[MoldMaintenanceLineResponse]] = None


class MoldMaintenanceListResponse(BaseModel):
    items: List[MoldMaintenanceResponse]
    total: int
    skip: int
    limit: int


class MoldMaintenanceReject(BaseModel):
    reject_reason: str = Field(..., min_length=1)


# ---------- 维修单 preview / 行 ----------

class MoldRepairPreviewLine(BaseModel):
    line_no: int
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_done: bool = False
    result_value: Optional[str] = None


class MoldRepairPreviewResponse(BaseModel):
    mold_id: int
    scheme_id: int
    scheme_code: Optional[str] = None
    scheme_name: Optional[str] = None
    lines: List[MoldRepairPreviewLine]


class MoldRepairLineInput(BaseModel):
    line_no: int = 1
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_done: bool = False
    result_value: Optional[str] = None
    remark: Optional[str] = None


class MoldRepairLineResponse(MoldRepairLineInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    repair_id: int


class MoldRepairCreate(BaseModel):
    mold_id: int
    scheme_id: Optional[int] = None
    fault_description: Optional[str] = None
    planned_date: Optional[date] = None
    repair_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[MoldRepairLineInput]] = None


class MoldRepairUpdate(BaseModel):
    scheme_id: Optional[int] = None
    fault_description: Optional[str] = None
    planned_date: Optional[date] = None
    repair_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[MoldRepairLineInput]] = None


class MoldRepairResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    mold_id: int
    mold_uuid: str
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    scheme_id: Optional[int] = None
    fault_description: Optional[str] = None
    planned_date: Optional[date] = None
    repair_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    status: str
    approver_id: Optional[int] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    completed_at: Optional[datetime] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: Optional[List[MoldRepairLineResponse]] = None


class MoldRepairListResponse(BaseModel):
    items: List[MoldRepairResponse]
    total: int
    skip: int
    limit: int


class MoldRepairReject(BaseModel):
    reject_reason: str = Field(..., min_length=1)


# ---------- 报表 ----------

class MoldTrialRecordReportItem(BaseModel):
    document_no: str
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    trial_date: date
    trial_result: Optional[str] = None
    operator_name: Optional[str] = None
    status: str


class MoldTrialRecordReportResponse(BaseModel):
    items: List[MoldTrialRecordReportItem]
    total: int
    skip: int
    limit: int


class MoldMaintenanceAlertReportItem(BaseModel):
    mold_uuid: str
    mold_code: str
    mold_name: str
    reminder_type: str
    trigger_type: str
    total_usage_count: Optional[int] = None
    maintenance_interval: Optional[int] = None
    last_maintenance_date: Optional[date] = None
    days_since_maintenance: Optional[int] = None
    trigger_interval_days: Optional[int] = None
    usages_until_due: Optional[int] = None


class MoldMaintenanceAlertReportResponse(BaseModel):
    items: List[MoldMaintenanceAlertReportItem]
    total: int
    skip: int
    limit: int


class MoldBorrowReturnLogItem(BaseModel):
    log_type: str
    document_no: str
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    event_date: datetime
    operator_name: Optional[str] = None
    usage_count: Optional[int] = None
    status: str
    related_document_no: Optional[str] = None


class MoldBorrowReturnLogReportResponse(BaseModel):
    items: List[MoldBorrowReturnLogItem]
    total: int
    skip: int
    limit: int


class MoldRepairAnalysisItem(BaseModel):
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    repair_count: int
    completed_count: int
    avg_completion_days: Optional[float] = None


class MoldRepairAnalysisReportResponse(BaseModel):
    items: List[MoldRepairAnalysisItem]
    total: int
    skip: int
    limit: int


# ---------- 报废申请 ----------

class MoldScrapApplicationCreate(BaseModel):
    mold_id: int
    reason: str
    scrap_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    attachments: Optional[List[Any]] = None


class MoldScrapApplicationUpdate(BaseModel):
    reason: Optional[str] = None
    scrap_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    attachments: Optional[List[Any]] = None


class MoldScrapApplicationReject(BaseModel):
    reject_reason: str = Field(..., min_length=1)


class MoldScrapApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    application_no: str
    mold_id: int
    mold_uuid: str
    mold_code: Optional[str] = None
    mold_name: Optional[str] = None
    reason: str
    scrap_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    status: str
    approver_id: Optional[int] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    attachments: Optional[List[Any]] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MoldScrapApplicationListResponse(BaseModel):
    items: List[MoldScrapApplicationResponse]
    total: int
    skip: int
    limit: int
