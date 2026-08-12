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

class RdProjectTaskBase(BaseModel):
    task_name: str
    description: Optional[str] = None
    gate_id: Optional[int] = None
    parent_task_id: Optional[int] = None
    status: str = "TODO"
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
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
    due_date: Optional[date] = None
    sort_order: Optional[int] = None
    priority: Optional[str] = None


class RdProjectTaskResponse(RdProjectTaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    project_id: int
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
    file_url: Optional[str] = None
    file_name: Optional[str] = None


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


class RdProjectDeliverableResponse(RdProjectDeliverableBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    project_id: int
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


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


class RelatedArticleSummary(BaseModel):
    id: int
    title: str
    space_name: Optional[str] = None
    updated_at: datetime


class ProjectCollaborationSummary(BaseModel):
    requirement_count: int = 0
    design_review_count: int = 0
    fmea_count: int = 0


class RdProjectWorkbenchResponse(RdProjectResponse):
    gates: List[RdProjectGateResponse] = Field(default_factory=list)
    tasks: List[RdProjectTaskResponse] = Field(default_factory=list)
    deliverables: List[RdProjectDeliverableResponse] = Field(default_factory=list)
    links: List[RdProjectLinkResponse] = Field(default_factory=list)
    related_articles: List[RelatedArticleSummary] = Field(default_factory=list)
    progress: float = 0
    collaboration: ProjectCollaborationSummary = Field(default_factory=ProjectCollaborationSummary)


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
