"""
设备运营扩展 Schema：点检/巡检/保养主数据与业务单据。

Author: RiverEdge
Date: 2026-06-29
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field, ConfigDict


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
    value_type: Optional[str] = Field(None, max_length=32)
    unit: Optional[str] = Field(None, max_length=32)
    numeric_min: Optional[Decimal] = None
    numeric_max: Optional[Decimal] = None
    is_active: Optional[bool] = None


class InspectionItemResponse(InspectionItemBase):
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
    value_type: Optional[str] = None
    unit: Optional[str] = None
    numeric_min: Optional[Decimal] = None
    numeric_max: Optional[Decimal] = None


class InspectionSchemeLineCreate(InspectionSchemeLineBase):
    pass


class InspectionSchemeLineResponse(InspectionSchemeLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scheme_id: int


# ---------- 点检方案 ----------

class InspectionSchemeBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    is_active: bool = True


class InspectionSchemeCreate(InspectionSchemeBase):
    lines: Optional[List[InspectionSchemeLineCreate]] = None


class InspectionSchemeUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    lines: Optional[List[InspectionSchemeLineCreate]] = None


class InspectionSchemeResponse(InspectionSchemeBase):
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


class SchemeBindingResponse(SchemeBindingBase):
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


class PatrolRouteResponse(PatrolRouteBase):
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


class MaintenanceItemResponse(MaintenanceItemBase):
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
    is_active: bool = True


class MaintenanceSchemeCreate(MaintenanceSchemeBase):
    lines: Optional[List[MaintenanceSchemeLineCreate]] = None


class MaintenanceSchemeUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    lines: Optional[List[MaintenanceSchemeLineCreate]] = None


class MaintenanceSchemeResponse(MaintenanceSchemeBase):
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
    value_type: Optional[str] = None
    unit: Optional[str] = None
    numeric_min: Optional[Decimal] = None
    numeric_max: Optional[Decimal] = None
    measured_value: Optional[str] = None
    is_pass: bool = True


class SpotCheckPreviewResponse(BaseModel):
    equipment_id: int
    scheme_id: int
    scheme_code: Optional[str] = None
    scheme_name: Optional[str] = None
    lines: List[SpotCheckPreviewLine]


class SpotCheckLineInput(BaseModel):
    line_no: int = 1
    item_id: Optional[int] = None
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    requirement: Optional[str] = None
    value_type: Optional[str] = None
    unit: Optional[str] = None
    measured_value: Optional[str] = None
    is_pass: bool = True
    remark: Optional[str] = None


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
    remark: Optional[str] = None
    lines: Optional[List[SpotCheckLineInput]] = None


class SpotCheckUpdate(BaseModel):
    check_date: Optional[date] = None
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None
    lines: Optional[List[SpotCheckLineInput]] = None


class SpotCheckResponse(BaseModel):
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
    check_date: date
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    status: str
    has_abnormality: bool
    abnormality_description: Optional[str] = None
    fault_report_uuid: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: Optional[List[SpotCheckLineResponse]] = None


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
    measured_value: Optional[str] = None
    is_pass: bool = True
    remark: Optional[str] = None


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


class RoutePatrolResponse(BaseModel):
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


class ScrapApplicationResponse(ScrapApplicationBase):
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


class TransferApplicationResponse(TransferApplicationBase):
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
