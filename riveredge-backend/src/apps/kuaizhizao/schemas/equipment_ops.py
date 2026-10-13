"""
设备运营扩展 Schema：点检/巡检/保养主数据与业务单据。

Author: RiverEdge
Date: 2026-06-29
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field, ConfigDict, field_validator


class AuditActorFields(BaseModel):
    """BaseModel 审计人字段（列表直接展示姓名）。"""
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None


# ---------- 通用列表响应 ----------

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    skip: int
    limit: int


# ---------- 点检项 ----------

class InspectionItemBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    requirement: Optional[str] = None
    method: Optional[str] = Field(None, description="点检方法")
    judgment_standard: Optional[str] = Field(None, description="判定标准")
    value_type: str = Field(default="boolean", max_length=32)
    unit: Optional[str] = Field(None, max_length=32)
    numeric_min: Optional[Decimal] = None
    numeric_max: Optional[Decimal] = None
    is_active: bool = True


class InspectionItemCreate(InspectionItemBase):
    pass


class InspectionItemUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    requirement: Optional[str] = None
    method: Optional[str] = None
    judgment_standard: Optional[str] = None
    value_type: Optional[str] = Field(None, max_length=32)
    unit: Optional[str] = Field(None, max_length=32)
    numeric_min: Optional[Decimal] = None
    numeric_max: Optional[Decimal] = None
    is_active: Optional[bool] = None


class InspectionItemResponse(InspectionItemBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class InspectionItemListResponse(BaseModel):
    items: List[InspectionItemResponse]
    total: int
    skip: int
    limit: int


# ---------- 点检方案行 ----------

class InspectionSchemeLineBase(BaseModel):
    item_id: int
    sort_order: int = 0
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    method: Optional[str] = None
    judgment_standard: Optional[str] = None
    value_type: Optional[str] = None
    unit: Optional[str] = None
    numeric_min: Optional[Decimal] = None
    numeric_max: Optional[Decimal] = None
    is_critical: bool = False
    photo_required: bool = False


class InspectionSchemeLineCreate(InspectionSchemeLineBase):
    pass


class InspectionSchemeLineResponse(InspectionSchemeLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scheme_id: int


# ---------- 点检方案 ----------

INSPECTION_SCHEME_CYCLE_TYPES = ("每班", "每天", "每周", "每月", "每季度")
INSPECTION_CAPTURE_MODES = ("A", "B", "C")


class InspectionSchemeBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    domain: str = Field(default="equipment", max_length=32, description="业务域 equipment/esd")
    cycle_type: Optional[str] = Field(None, max_length=32, description="点检周期")
    capture_mode: str = Field(default="A", max_length=8, description="采集方式 A/B/C")
    reviewer_user_id: Optional[int] = Field(None, description="指定审核人用户ID")
    reviewer_user_name: Optional[str] = Field(None, max_length=100, description="指定审核人姓名")
    overdue_hours: int = Field(default=8, ge=1, le=720, description="未点检超时小时")
    review_overdue_hours: int = Field(default=4, ge=1, le=720, description="未审核超时小时")
    is_active: bool = True


class InspectionSchemeCreate(InspectionSchemeBase):
    lines: Optional[List[InspectionSchemeLineCreate]] = None


class InspectionSchemeUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    domain: Optional[str] = Field(None, max_length=32)
    cycle_type: Optional[str] = Field(None, max_length=32)
    capture_mode: Optional[str] = Field(None, max_length=8)
    reviewer_user_id: Optional[int] = None
    reviewer_user_name: Optional[str] = Field(None, max_length=100)
    overdue_hours: Optional[int] = Field(None, ge=1, le=720)
    review_overdue_hours: Optional[int] = Field(None, ge=1, le=720)
    is_active: Optional[bool] = None
    lines: Optional[List[InspectionSchemeLineCreate]] = None


class InspectionSchemeResponse(InspectionSchemeBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    lines: Optional[List[InspectionSchemeLineResponse]] = None


class InspectionSchemeListResponse(BaseModel):
    items: List[InspectionSchemeResponse]
    total: int
    skip: int
    limit: int


# ---------- 设备方案绑定 ----------

class SchemeBindingBase(BaseModel):
    equipment_id: int
    scheme_id: int
    scheme_type: str = Field(default="spot_check", max_length=32)


class SchemeBindingCreate(SchemeBindingBase):
    pass


class SchemeBindingBulkReplace(BaseModel):
    equipment_id: int
    scheme_type: str = Field(default="spot_check", max_length=32)
    scheme_ids: List[int] = Field(default_factory=list)


class SchemeBindingResponse(SchemeBindingBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    equipment_uuid: str
    created_at: datetime
    updated_at: datetime


# ---------- 巡检路线步骤 ----------

class PatrolRouteStepBase(BaseModel):
    sort_order: int = 0
    equipment_id: int
    scheme_id: Optional[int] = None
    equipment_code: Optional[str] = None
    equipment_name: Optional[str] = None


class PatrolRouteStepCreate(PatrolRouteStepBase):
    pass


class PatrolRouteStepResponse(PatrolRouteStepBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    route_id: int
    equipment_uuid: str


# ---------- 巡检路线 ----------

class PatrolRouteBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    workshop_id: Optional[int] = None
    workshop_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    is_active: bool = True


class PatrolRouteCreate(PatrolRouteBase):
    steps: Optional[List[PatrolRouteStepCreate]] = None


class PatrolRouteUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    workshop_id: Optional[int] = None
    workshop_name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    steps: Optional[List[PatrolRouteStepCreate]] = None


class PatrolRouteResponse(PatrolRouteBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    steps: Optional[List[PatrolRouteStepResponse]] = None


class PatrolRouteListResponse(BaseModel):
    items: List[PatrolRouteResponse]
    total: int
    skip: int
    limit: int


# ---------- 保养项 ----------

class MaintenanceItemBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_active: bool = True


class MaintenanceItemCreate(MaintenanceItemBase):
    pass


class MaintenanceItemUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None
    is_active: Optional[bool] = None


class MaintenanceItemResponse(MaintenanceItemBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class MaintenanceItemListResponse(BaseModel):
    items: List[MaintenanceItemResponse]
    total: int
    skip: int
    limit: int


# ---------- 保养方案行 ----------

class MaintenanceSchemeLineBase(BaseModel):
    item_id: int
    sort_order: int = 0
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    standard_hours: Optional[Decimal] = None


class MaintenanceSchemeLineCreate(MaintenanceSchemeLineBase):
    pass


class MaintenanceSchemeLineResponse(MaintenanceSchemeLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scheme_id: int


# ---------- 保养方案 ----------

class MaintenanceSchemeBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    maintenance_type: str = Field(..., max_length=50, description="维护类型（日常保养、小修、中修、大修）")
    cycle_type: str = Field(..., max_length=50, description="周期类型（按时间、按运行时长、按使用次数）")
    cycle_value: Optional[int] = Field(None, ge=0, description="周期值")
    cycle_unit: Optional[str] = Field(None, max_length=20, description="周期单位（天、小时、次等）")
    is_active: bool = True

    @field_validator("maintenance_type")
    @classmethod
    def validate_maintenance_type(cls, v: str) -> str:
        allowed = ["日常保养", "小修", "中修", "大修"]
        if v not in allowed:
            raise ValueError(f"维护类型必须是 {allowed} 之一")
        return v

    @field_validator("cycle_type")
    @classmethod
    def validate_cycle_type(cls, v: str) -> str:
        allowed = ["按时间", "按运行时长", "按使用次数"]
        if v not in allowed:
            raise ValueError(f"周期类型必须是 {allowed} 之一")
        return v


class MaintenanceSchemeCreate(MaintenanceSchemeBase):
    lines: Optional[List[MaintenanceSchemeLineCreate]] = None


class MaintenanceSchemeUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    maintenance_type: Optional[str] = Field(None, max_length=50)
    cycle_type: Optional[str] = Field(None, max_length=50)
    cycle_value: Optional[int] = Field(None, ge=0)
    cycle_unit: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None
    lines: Optional[List[MaintenanceSchemeLineCreate]] = None

    @field_validator("maintenance_type")
    @classmethod
    def validate_maintenance_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ["日常保养", "小修", "中修", "大修"]
        if v not in allowed:
            raise ValueError(f"维护类型必须是 {allowed} 之一")
        return v

    @field_validator("cycle_type")
    @classmethod
    def validate_cycle_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ["按时间", "按运行时长", "按使用次数"]
        if v not in allowed:
            raise ValueError(f"周期类型必须是 {allowed} 之一")
        return v


class MaintenanceSchemeResponse(MaintenanceSchemeBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    lines: Optional[List[MaintenanceSchemeLineResponse]] = None


class MaintenanceSchemeListResponse(BaseModel):
    items: List[MaintenanceSchemeResponse]
    total: int
    skip: int
    limit: int


# ---------- 点检单 preview / 行 ----------

class SpotCheckPreviewLine(BaseModel):
    line_no: int
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    method: Optional[str] = None
    judgment_standard: Optional[str] = None
    value_type: Optional[str] = None
    unit: Optional[str] = None
    numeric_min: Optional[Decimal] = None
    numeric_max: Optional[Decimal] = None
    is_critical: bool = False
    photo_required: bool = False
    measured_value: Optional[str] = None
    is_pass: bool = True


class SpotCheckPreviewResponse(BaseModel):
    equipment_id: int
    scheme_id: int
    scheme_code: Optional[str] = None
    scheme_name: Optional[str] = None
    cycle_type: Optional[str] = None
    capture_mode: str = "A"
    lines: List[SpotCheckPreviewLine]


class SpotCheckLineInput(BaseModel):
    line_no: int = 1
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    method: Optional[str] = None
    judgment_standard: Optional[str] = None
    value_type: Optional[str] = None
    unit: Optional[str] = None
    numeric_min: Optional[Decimal] = None
    numeric_max: Optional[Decimal] = None
    measured_value: Optional[str] = None
    # None 时按 value_type + 数值上下限自动判定
    is_pass: Optional[bool] = None
    photo_required: bool = False
    remark: Optional[str] = None
    attachments: Optional[List[dict]] = None


class SpotCheckLineResponse(SpotCheckLineInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    spot_check_id: int


class SpotCheckCreate(BaseModel):
    equipment_id: int
    scheme_id: Optional[int] = None
    check_date: Optional[date] = None
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    plan_id: Optional[int] = None
    plan_uuid: Optional[str] = None
    remark: Optional[str] = None
    attachments: Optional[List[dict]] = None
    lines: Optional[List[SpotCheckLineInput]] = None


class SpotCheckUpdate(BaseModel):
    check_date: Optional[date] = None
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    attachments: Optional[List[dict]] = None
    lines: Optional[List[SpotCheckLineInput]] = None


class SpotCheckResponse(AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    equipment_id: int
    equipment_uuid: str
    equipment_code: Optional[str] = None
    equipment_name: Optional[str] = None
    scheme_id: Optional[int] = None
    scheme_code: Optional[str] = None
    scheme_name: Optional[str] = None
    plan_id: Optional[int] = None
    plan_uuid: Optional[str] = None
    period_key: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    shift_name: Optional[str] = None
    capture_mode: Optional[str] = None
    check_date: date
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    reviewer_user_id: Optional[int] = None
    reviewer_user_name: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    status: str
    has_abnormality: bool
    abnormality_description: Optional[str] = None
    fault_report_uuid: Optional[str] = None
    attachments: Optional[List[dict]] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: Optional[List[SpotCheckLineResponse]] = None


class SpotCheckRejectRequest(BaseModel):
    reject_reason: str = Field(..., min_length=1, description="驳回原因")


class SpotCheckListResponse(BaseModel):
    items: List[SpotCheckResponse]
    total: int
    skip: int
    limit: int


# ---------- 巡检单 preview / 行 ----------

class RoutePatrolPreviewLine(BaseModel):
    step_no: int
    equipment_id: int
    equipment_uuid: str
    equipment_code: Optional[str] = None
    equipment_name: Optional[str] = None
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    capture_mode: str = "A"
    requirement: Optional[str] = None
    method: Optional[str] = None
    judgment_standard: Optional[str] = None
    value_type: Optional[str] = None
    unit: Optional[str] = None
    photo_required: bool = False
    measured_value: Optional[str] = None
    is_pass: bool = True


class RoutePatrolPreviewResponse(BaseModel):
    route_id: int
    route_code: Optional[str] = None
    route_name: Optional[str] = None
    lines: List[RoutePatrolPreviewLine]


class RoutePatrolLineInput(BaseModel):
    step_no: int = 1
    equipment_id: int
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    capture_mode: Optional[str] = "A"
    requirement: Optional[str] = None
    method: Optional[str] = None
    judgment_standard: Optional[str] = None
    value_type: Optional[str] = None
    unit: Optional[str] = None
    photo_required: bool = False
    measured_value: Optional[str] = None
    is_pass: bool = True
    remark: Optional[str] = None
    attachments: Optional[List[dict]] = None


class RoutePatrolLineResponse(RoutePatrolLineInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    route_patrol_id: int
    equipment_uuid: str
    equipment_code: Optional[str] = None
    equipment_name: Optional[str] = None
    fault_report_uuid: Optional[str] = None


class RoutePatrolCreate(BaseModel):
    route_id: int
    patrol_date: Optional[date] = None
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[RoutePatrolLineInput]] = None


class RoutePatrolUpdate(BaseModel):
    patrol_date: Optional[date] = None
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[RoutePatrolLineInput]] = None


class RoutePatrolResponse(AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    document_no: str
    route_id: int
    route_code: Optional[str] = None
    route_name: Optional[str] = None
    patrol_date: date
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    status: str
    has_abnormality: bool
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: Optional[List[RoutePatrolLineResponse]] = None


class RoutePatrolListResponse(BaseModel):
    items: List[RoutePatrolResponse]
    total: int
    skip: int
    limit: int


# ---------- 报废申请 ----------

class ScrapApplicationBase(BaseModel):
    equipment_id: int
    reason: str
    scrap_date: Optional[date] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = Field(None, max_length=100)
    remark: Optional[str] = None
    attachments: Optional[List[dict]] = None


class ScrapApplicationCreate(ScrapApplicationBase):
    pass


class ScrapApplicationUpdate(BaseModel):
    reason: Optional[str] = None
    scrap_date: Optional[date] = None
    remark: Optional[str] = None
    attachments: Optional[List[dict]] = None


class ScrapApplicationReject(BaseModel):
    reject_reason: str


class ScrapApplicationResponse(ScrapApplicationBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    application_no: str
    equipment_uuid: str
    equipment_code: Optional[str] = None
    equipment_name: Optional[str] = None
    status: str
    approver_id: Optional[int] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ScrapApplicationListResponse(BaseModel):
    items: List[ScrapApplicationResponse]
    total: int
    skip: int
    limit: int


# ---------- 设备调拨 ----------

class TransferApplicationBase(BaseModel):
    equipment_id: int
    to_workshop_id: Optional[int] = None
    to_workshop_name: Optional[str] = Field(None, max_length=200)
    to_workstation_id: Optional[int] = None
    to_workstation_name: Optional[str] = Field(None, max_length=200)
    to_status: Optional[str] = Field(None, max_length=50)
    reason: str
    transfer_date: Optional[date] = None
    remark: Optional[str] = None


class TransferApplicationCreate(TransferApplicationBase):
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = Field(None, max_length=100)


class TransferApplicationUpdate(BaseModel):
    to_workshop_id: Optional[int] = None
    to_workshop_name: Optional[str] = Field(None, max_length=200)
    to_workstation_id: Optional[int] = None
    to_workstation_name: Optional[str] = Field(None, max_length=200)
    to_status: Optional[str] = Field(None, max_length=50)
    reason: Optional[str] = None
    transfer_date: Optional[date] = None
    remark: Optional[str] = None


class TransferApplicationReject(BaseModel):
    reject_reason: str


class TransferApplicationResponse(TransferApplicationBase, AuditActorFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    tenant_id: int
    application_no: str
    equipment_uuid: str
    equipment_code: Optional[str] = None
    equipment_name: Optional[str] = None
    from_workshop_id: Optional[int] = None
    from_workshop_name: Optional[str] = None
    from_workstation_id: Optional[int] = None
    from_workstation_name: Optional[str] = None
    applicant_id: Optional[int] = None
    applicant_name: Optional[str] = None
    status: str
    approver_id: Optional[int] = None
    approver_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TransferApplicationListResponse(BaseModel):
    items: List[TransferApplicationResponse]
    total: int
    skip: int
    limit: int
