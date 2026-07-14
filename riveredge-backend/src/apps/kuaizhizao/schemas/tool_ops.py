"""
工装运营扩展 Schema：保养/维修主数据与业务单据。

Author: RiverEdge
Date: 2026-06-29
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Any

from pydantic import BaseModel, Field, ConfigDict


class AuditActorFields(BaseModel):
    """BaseModel 审计人字段（列表直接展示姓名）。"""
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None


# ---------- 工装保养项 ----------

class ToolMaintenanceItemBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_active: bool = True


class ToolMaintenanceItemCreate(ToolMaintenanceItemBase):
    pass


class ToolMaintenanceItemUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_active: Optional[bool] = None


class ToolMaintenanceItemResponse(ToolMaintenanceItemBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class ToolMaintenanceItemListResponse(BaseModel):
    items: List[ToolMaintenanceItemResponse]
    total: int
    skip: int
    limit: int


# ---------- 工装保养方案 ----------

class ToolMaintenanceSchemeLineBase(BaseModel):
    item_id: int
    sort_order: int = 0
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None


class ToolMaintenanceSchemeLineCreate(ToolMaintenanceSchemeLineBase):
    pass


class ToolMaintenanceSchemeLineResponse(ToolMaintenanceSchemeLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scheme_id: int


class ToolMaintenanceSchemeBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    trigger_type: str = Field(default="usage_count", max_length=32)
    trigger_interval_days: Optional[int] = Field(None, ge=1)
    trigger_interval_usage: Optional[int] = Field(None, ge=1)
    is_active: bool = True


class ToolMaintenanceSchemeCreate(ToolMaintenanceSchemeBase):
    lines: Optional[List[ToolMaintenanceSchemeLineCreate]] = None


class ToolMaintenanceSchemeUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    trigger_type: Optional[str] = Field(None, max_length=32)
    trigger_interval_days: Optional[int] = Field(None, ge=1)
    trigger_interval_usage: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None
    lines: Optional[List[ToolMaintenanceSchemeLineCreate]] = None


class ToolMaintenanceSchemeResponse(ToolMaintenanceSchemeBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    lines: Optional[List[ToolMaintenanceSchemeLineResponse]] = None


class ToolMaintenanceSchemeListResponse(BaseModel):
    items: List[ToolMaintenanceSchemeResponse]
    total: int
    skip: int
    limit: int


# ---------- 工装维修项 ----------

class ToolRepairItemBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_active: bool = True


class ToolRepairItemCreate(ToolRepairItemBase):
    pass


class ToolRepairItemUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_active: Optional[bool] = None


class ToolRepairItemResponse(ToolRepairItemBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class ToolRepairItemListResponse(BaseModel):
    items: List[ToolRepairItemResponse]
    total: int
    skip: int
    limit: int


# ---------- 工装维修方案 ----------

class ToolRepairSchemeLineBase(BaseModel):
    item_id: int
    sort_order: int = 0
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None


class ToolRepairSchemeLineCreate(ToolRepairSchemeLineBase):
    pass


class ToolRepairSchemeLineResponse(ToolRepairSchemeLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scheme_id: int


class ToolRepairSchemeBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    is_active: bool = True


class ToolRepairSchemeCreate(ToolRepairSchemeBase):
    lines: Optional[List[ToolRepairSchemeLineCreate]] = None


class ToolRepairSchemeUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    lines: Optional[List[ToolRepairSchemeLineCreate]] = None


class ToolRepairSchemeResponse(ToolRepairSchemeBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    lines: Optional[List[ToolRepairSchemeLineResponse]] = None


class ToolRepairSchemeListResponse(BaseModel):
    items: List[ToolRepairSchemeResponse]
    total: int
    skip: int
    limit: int


# ---------- 工装方案绑定 ----------

class ToolSchemeBindingBase(BaseModel):
    tool_id: int
    scheme_id: int
    scheme_type: str = Field(default="maintenance", max_length=32)


class ToolSchemeBindingCreate(ToolSchemeBindingBase):
    pass


class ToolSchemeBindingBulkReplace(BaseModel):
    tool_id: int
    scheme_type: str = Field(default="maintenance", max_length=32)
    scheme_ids: List[int] = Field(default_factory=list)


class ToolSchemeBindingResponse(ToolSchemeBindingBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    tool_uuid: str
    created_at: datetime
    updated_at: datetime


# ---------- 领用单 ----------

class ToolBorrowCreate(BaseModel):
    tool_id: int
    borrow_date: Optional[datetime] = None
    borrower_id: Optional[int] = None
    borrower_name: Optional[str] = None
    department_name: Optional[str] = Field(None, max_length=200)
    expected_return_date: Optional[date] = None
    source_type: Optional[str] = Field(None, max_length=50)
    source_id: Optional[int] = None
    source_no: Optional[str] = Field(None, max_length=100)
    remark: Optional[str] = None


class ToolBorrowUpdate(BaseModel):
    borrow_date: Optional[datetime] = None
    borrower_id: Optional[int] = None
    borrower_name: Optional[str] = None
    department_name: Optional[str] = Field(None, max_length=200)
    expected_return_date: Optional[date] = None
    remark: Optional[str] = None


class ToolBorrowResponse(AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    tool_id: int
    tool_uuid: str
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
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


class ToolBorrowListResponse(BaseModel):
    items: List[ToolBorrowResponse]
    total: int
    skip: int
    limit: int


# ---------- 归还单 ----------

class ToolReturnCreate(BaseModel):
    tool_id: int
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


class ToolReturnUpdate(BaseModel):
    return_date: Optional[datetime] = None
    usage_count: Optional[int] = Field(None, ge=1)
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    remark: Optional[str] = None


class ToolReturnResponse(AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    tool_id: int
    tool_uuid: str
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
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


class ToolReturnListResponse(BaseModel):
    items: List[ToolReturnResponse]
    total: int
    skip: int
    limit: int


# ---------- 保养单 preview / 行 ----------

class ToolMaintenancePreviewLine(BaseModel):
    line_no: int
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_done: bool = False
    result_value: Optional[str] = None


class ToolMaintenancePreviewResponse(BaseModel):
    tool_id: int
    scheme_id: int
    scheme_code: Optional[str] = None
    scheme_name: Optional[str] = None
    lines: List[ToolMaintenancePreviewLine]


class ToolMaintenanceLineInput(BaseModel):
    line_no: int = 1
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_done: bool = False
    result_value: Optional[str] = None
    remark: Optional[str] = None


class ToolMaintenanceLineResponse(ToolMaintenanceLineInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    maintenance_id: int


class ToolMaintenanceCreate(BaseModel):
    tool_id: int
    scheme_id: Optional[int] = None
    planned_date: Optional[date] = None
    maintenance_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[ToolMaintenanceLineInput]] = None


class ToolMaintenanceUpdate(BaseModel):
    scheme_id: Optional[int] = None
    planned_date: Optional[date] = None
    maintenance_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[ToolMaintenanceLineInput]] = None


class ToolMaintenanceResponse(AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    tool_id: int
    tool_uuid: str
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
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
    lines: Optional[List[ToolMaintenanceLineResponse]] = None


class ToolMaintenanceListResponse(BaseModel):
    items: List[ToolMaintenanceResponse]
    total: int
    skip: int
    limit: int


class ToolMaintenanceReject(BaseModel):
    reject_reason: str = Field(..., min_length=1)


# ---------- 维修单 preview / 行 ----------

class ToolRepairPreviewLine(BaseModel):
    line_no: int
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_done: bool = False
    result_value: Optional[str] = None


class ToolRepairPreviewResponse(BaseModel):
    tool_id: int
    scheme_id: int
    scheme_code: Optional[str] = None
    scheme_name: Optional[str] = None
    lines: List[ToolRepairPreviewLine]


class ToolRepairLineInput(BaseModel):
    line_no: int = 1
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_done: bool = False
    result_value: Optional[str] = None
    remark: Optional[str] = None


class ToolRepairLineResponse(ToolRepairLineInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    repair_id: int


class ToolRepairCreate(BaseModel):
    tool_id: int
    scheme_id: Optional[int] = None
    fault_description: Optional[str] = None
    planned_date: Optional[date] = None
    repair_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[ToolRepairLineInput]] = None


class ToolRepairUpdate(BaseModel):
    scheme_id: Optional[int] = None
    fault_description: Optional[str] = None
    planned_date: Optional[date] = None
    repair_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[ToolRepairLineInput]] = None


class ToolRepairResponse(AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    tool_id: int
    tool_uuid: str
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
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
    lines: Optional[List[ToolRepairLineResponse]] = None


class ToolRepairListResponse(BaseModel):
    items: List[ToolRepairResponse]
    total: int
    skip: int
    limit: int


class ToolRepairReject(BaseModel):
    reject_reason: str = Field(..., min_length=1)



# ---------- 校验预警报表 ----------

class ToolCalibrationAlertReportItem(BaseModel):
    tool_uuid: str
    tool_code: str
    tool_name: str
    reminder_type: str
    due_type: str
    due_date: Optional[date] = None
    days_until_due: int
    calibration_period: Optional[int] = None
    last_calibration_date: Optional[date] = None


class ToolCalibrationAlertReportResponse(BaseModel):
    items: List[ToolCalibrationAlertReportItem]
    total: int
    skip: int
    limit: int


class ToolMaintenanceAlertReportItem(BaseModel):
    tool_uuid: str
    tool_code: str
    tool_name: str
    reminder_type: str
    trigger_type: str
    total_usage_count: Optional[int] = None
    maintenance_interval: Optional[int] = None
    last_maintenance_date: Optional[date] = None
    days_since_maintenance: Optional[int] = None
    trigger_interval_days: Optional[int] = None
    usages_until_due: Optional[int] = None


class ToolMaintenanceAlertReportResponse(BaseModel):
    items: List[ToolMaintenanceAlertReportItem]
    total: int
    skip: int
    limit: int


class ToolBorrowReturnLogItem(BaseModel):
    log_type: str
    document_no: str
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
    event_date: datetime
    operator_name: Optional[str] = None
    usage_count: Optional[int] = None
    status: str
    related_document_no: Optional[str] = None


class ToolBorrowReturnLogReportResponse(BaseModel):
    items: List[ToolBorrowReturnLogItem]
    total: int
    skip: int
    limit: int


class ToolRepairAnalysisItem(BaseModel):
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
    repair_count: int
    completed_count: int
    avg_completion_days: Optional[float] = None


class ToolRepairAnalysisReportResponse(BaseModel):
    items: List[ToolRepairAnalysisItem]
    total: int
    skip: int
    limit: int


# ---------- 校验单 ----------

class ToolOpsCalibrationCreate(BaseModel):
    tool_id: int
    calibration_date: Optional[date] = None
    calibration_org: Optional[str] = Field(None, max_length=200)
    certificate_no: Optional[str] = Field(None, max_length=100)
    result: str = Field(..., max_length=50)
    expiry_date: Optional[date] = None
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    attachment_uuid: Optional[str] = None
    remark: Optional[str] = None


class ToolOpsCalibrationUpdate(BaseModel):
    calibration_date: Optional[date] = None
    calibration_org: Optional[str] = Field(None, max_length=200)
    certificate_no: Optional[str] = Field(None, max_length=100)
    result: Optional[str] = Field(None, max_length=50)
    expiry_date: Optional[date] = None
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    status: Optional[str] = None
    attachment_uuid: Optional[str] = None
    remark: Optional[str] = None


class ToolOpsCalibrationResponse(AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    tool_id: int
    tool_uuid: str
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
    calibration_date: date
    calibration_org: Optional[str] = None
    certificate_no: Optional[str] = None
    result: str
    expiry_date: Optional[date] = None
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    status: str
    attachment_uuid: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ToolOpsCalibrationListResponse(BaseModel):
    items: List[ToolOpsCalibrationResponse]
    total: int
    skip: int
    limit: int


# ---------- 报废申请 ----------

class ToolScrapApplicationCreate(BaseModel):
    tool_id: int
    reason: str
    scrap_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    attachments: Optional[List[Any]] = None


class ToolScrapApplicationUpdate(BaseModel):
    reason: Optional[str] = None
    scrap_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    remark: Optional[str] = None
    attachments: Optional[List[Any]] = None


class ToolScrapApplicationReject(BaseModel):
    reject_reason: str = Field(..., min_length=1)


class ToolScrapApplicationResponse(AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    application_no: str
    tool_id: int
    tool_uuid: str
    tool_code: Optional[str] = None
    tool_name: Optional[str] = None
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


class ToolScrapApplicationListResponse(BaseModel):
    items: List[ToolScrapApplicationResponse]
    total: int
    skip: int
    limit: int
