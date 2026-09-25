"""
研发项目 Schema

Author: RiverEdge Team
Date: 2026-05-28
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------- Gates ----------

class RdProjectGateBase(BaseModel):
    gate_key: str
    gate_name: str
    sort_order: int = 0
    status: str = "PENDING"
    milestone_role: Optional[str] = "none"
    planned_date: Optional[date] = None
    actual_date: Optional[date] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_notes: Optional[str] = None
    criteria: Optional[str] = None


class RdProjectGateCreate(RdProjectGateBase):
    pass


class RdProjectGateUpdate(BaseModel):
    status: Optional[str] = None
    planned_date: Optional[date] = None
    actual_date: Optional[date] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_notes: Optional[str] = None
    criteria: Optional[str] = None


class RdProjectGateResponse(RdProjectGateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    project_id: int
    created_at: datetime
    updated_at: datetime


# ---------- Tasks ----------

class RdProjectMemberInput(BaseModel):
    user_id: int
    user_name: Optional[str] = None


class RdProjectMemberResponse(BaseModel):
    user_id: int
    user_name: str


class RdProjectTaskBase(BaseModel):
    task_name: str
    description: Optional[str] = None
    gate_id: Optional[int] = None
    parent_task_id: Optional[int] = None
    status: str = "TODO"
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    members: List[RdProjectMemberInput] = Field(default_factory=list)
    due_date: Optional[date] = None
    sort_order: int = 0
    priority: str = "normal"


class RdProjectTaskCreate(RdProjectTaskBase):
    pass


class RdProjectTaskUpdate(BaseModel):
    task_name: Optional[str] = None
    description: Optional[str] = None
    gate_id: Optional[int] = None
    parent_task_id: Optional[int] = None
    status: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    members: Optional[List[RdProjectMemberInput]] = None
    due_date: Optional[date] = None
    sort_order: Optional[int] = None
    priority: Optional[str] = None


class RdProjectTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    project_id: int
    task_name: str
    description: Optional[str] = None
    gate_id: Optional[int] = None
    parent_task_id: Optional[int] = None
    status: str = "TODO"
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    members: List[RdProjectMemberResponse] = Field(default_factory=list)
    template_task_id: Optional[int] = None
    due_date: Optional[date] = None
    sort_order: int = 0
    priority: str = "normal"
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ---------- Deliverables ----------

class RdProjectDeliverableBase(BaseModel):
    name: str
    description: Optional[str] = None
    gate_id: Optional[int] = None
    deliverable_type: Optional[str] = None
    status: str = "PENDING"
    version: str = "A0"
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_uuid: Optional[str] = None
    material_code: Optional[str] = Field(None, max_length=80, description="关联料号")
    legacy_material_code: Optional[str] = Field(None, max_length=80, description="沿用旧料号")


class RdProjectDeliverableCreate(RdProjectDeliverableBase):
    pass


class RdProjectDeliverableUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    gate_id: Optional[int] = None
    deliverable_type: Optional[str] = None
    status: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_uuid: Optional[str] = None
    material_code: Optional[str] = Field(None, max_length=80)
    legacy_material_code: Optional[str] = Field(None, max_length=80)


class RdProjectDeliverableResponse(RdProjectDeliverableBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    project_id: int
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class RdProjectDeliverableVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    deliverable_id: int
    project_id: int
    version: str
    status: str
    is_effective: bool = False
    name: str
    description: Optional[str] = None
    deliverable_type: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_uuid: Optional[str] = None
    change_summary: Optional[str] = None
    effective_at: Optional[datetime] = None
    obsolete_at: Optional[datetime] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class RdProjectDeliverableVersionListResponse(BaseModel):
    items: List[RdProjectDeliverableVersionResponse]
    total: int
    audience: str
    can_view_history: bool
    can_download_history: bool = False


class RdProjectDeliverableReviseRequest(BaseModel):
    version: Optional[str] = Field(None, max_length=30, description="新版本号，空则自动递增")
    change_summary: Optional[str] = Field(None, description="升版说明")
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_uuid: Optional[str] = None


class RdProjectDeliverableRejectRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500, description="驳回原因")


# ---------- Links ----------

class RdProjectLinkBase(BaseModel):
    link_type: str
    target_type: str
    target_id: Optional[int] = None
    target_uuid: Optional[str] = None
    target_code: Optional[str] = None
    target_name: Optional[str] = None
    notes: Optional[str] = None


class RdProjectLinkCreate(RdProjectLinkBase):
    pass


class RdProjectLinkResponse(RdProjectLinkBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    project_id: int
    created_at: datetime
    updated_at: datetime


# ---------- Project ----------

class RdProjectCreate(BaseModel):
    project_code: Optional[str] = None
    project_name: str
    project_type: str = "RD"
    source_project_id: Optional[int] = None
    gate_template_id: Optional[int] = None
    description: Optional[str] = None
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    members: List[RdProjectMemberInput] = Field(default_factory=list)
    priority: str = "normal"
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    notes: Optional[str] = None


class RdProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    current_gate_key: Optional[str] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    members: Optional[List[RdProjectMemberInput]] = None
    priority: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    notes: Optional[str] = None


class RdProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    project_code: str
    project_name: str
    description: Optional[str] = None
    status: str
    project_type: str = "RD"
    source_project_id: Optional[int] = None
    source_project_code: Optional[str] = None
    gate_template_id: Optional[int] = None
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    current_gate_key: Optional[str] = None
    current_gate_name: Optional[str] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    members: List[RdProjectMemberResponse] = Field(default_factory=list)
    priority: str
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    gates: List[RdProjectGateResponse] = Field(default_factory=list)
    progress: float = 0
    not_executed: bool = False
    system_archive_summary: Optional["RdProjectSystemArchiveSummary"] = None


class RdProjectSystemArchiveUploadTemplate(BaseModel):
    title: str
    columns: List[str] = Field(default_factory=list)
    hint: Optional[str] = None


class RdProjectSystemArchiveItemResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int
    project_id: int
    archive_type_code: str
    archive_type_name: str
    sort_order: int
    fill_status: str
    modes: List[str] = Field(default_factory=list)
    link_target_types: List[str] = Field(default_factory=list)
    template_key: Optional[str] = None
    upload_template: Optional[RdProjectSystemArchiveUploadTemplate] = None
    file_uuid: Optional[str] = None
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    linked_target_type: Optional[str] = None
    linked_target_id: Optional[int] = None
    linked_target_uuid: Optional[str] = None
    linked_target_code: Optional[str] = None
    linked_target_name: Optional[str] = None
    acceptance_status: str
    acceptance_notes: Optional[str] = None
    accepted_at: Optional[datetime] = None
    accepted_by: Optional[int] = None
    accepted_by_name: Optional[str] = None
    missing_notes: Optional[str] = None
    missing_marked_at: Optional[datetime] = None
    missing_marked_by: Optional[int] = None
    missing_marked_by_name: Optional[str] = None
    notes: Optional[str] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None


class RdProjectSystemArchiveSummary(BaseModel):
    total: int
    filled: int
    empty: int
    missing_marked: int
    accepted: int
    pending_acceptance: int
    complete: bool
    all_accepted: bool


class RdProjectSystemArchiveListResponse(BaseModel):
    items: List[RdProjectSystemArchiveItemResponse]
    summary: RdProjectSystemArchiveSummary
    templates: Dict[str, RdProjectSystemArchiveUploadTemplate] = Field(default_factory=dict)


class RdProjectSystemArchiveUploadRequest(BaseModel):
    file_uuid: str
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    notes: Optional[str] = None


class RdProjectSystemArchiveLinkRequest(BaseModel):
    linked_target_type: str
    linked_target_id: Optional[int] = None
    linked_target_uuid: Optional[str] = None
    linked_target_code: Optional[str] = None
    linked_target_name: Optional[str] = None
    notes: Optional[str] = None


class RdProjectSystemArchiveMissingRequest(BaseModel):
    missing_notes: str


class RdProjectSystemArchiveAcceptRequest(BaseModel):
    acceptance_notes: Optional[str] = None


class RdProjectSystemArchiveRejectRequest(BaseModel):
    acceptance_notes: str


class RelatedArticleSummary(BaseModel):
    id: int
    title: str
    space_name: Optional[str] = None
    updated_at: datetime


class ProjectCollaborationSummary(BaseModel):
    requirement_count: int = 0
    design_review_count: int = 0
    fmea_count: int = 0
    product_firmware_count: int = 0
    sample_process_count: int = 0
    material_review_count: int = 0
    bom_collab_count: int = 0
    project_proposal_count: int = 0
    mold_sample_count: int = 0
    trial_flow_count: int = 0
    engineering_change_count: int = 0


class PendingInboxItem(BaseModel):
    """跨项目待办条目（优先一联调）。"""

    doc_type: str
    doc_id: int
    doc_code: str
    title: str
    status: str
    project_id: Optional[int] = None
    project_code: Optional[str] = None
    project_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    list_path: str


class PendingInboxListResponse(BaseModel):
    items: List[PendingInboxItem]
    total: int


class RdProjectWorkbenchResponse(RdProjectResponse):
    tasks: List[RdProjectTaskResponse] = Field(default_factory=list)
    deliverables: List[RdProjectDeliverableResponse] = Field(default_factory=list)
    links: List[RdProjectLinkResponse] = Field(default_factory=list)
    related_articles: List[RelatedArticleSummary] = Field(default_factory=list)
    collaboration: ProjectCollaborationSummary = Field(default_factory=ProjectCollaborationSummary)
    system_archive: Optional[RdProjectSystemArchiveListResponse] = None


class PushTrialWorkOrderRequest(BaseModel):
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    remarks: Optional[str] = None


class PushTrialWorkOrderResponse(BaseModel):
    work_order_id: int
    work_order_code: str
    project_link_id: int


class SpawnDeliveryProjectRequest(BaseModel):
    project_name: Optional[str] = None
    project_code: Optional[str] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None


class SpawnDeliveryProjectResponse(BaseModel):
    delivery_project_id: int
    delivery_project_code: str
    project_link_id: int
