"""
阶段门模板 Schema

Author: RiverEdge Team
Date: 2026-07-07
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class GateTemplateDeliverableInput(BaseModel):
    id: Optional[int] = None
    name: str
    deliverable_type: Optional[str] = None
    sort_order: int = 0


class GateTemplateDeliverableResponse(GateTemplateDeliverableInput):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    stage_id: int
    created_at: datetime
    updated_at: datetime


class GateTemplateStageInput(BaseModel):
    id: Optional[int] = None
    gate_key: str
    gate_name: str
    sort_order: int = 0
    milestone_role: str = "none"
    deliverables: List[GateTemplateDeliverableInput] = Field(default_factory=list)


class GateTemplateStageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    template_id: int
    gate_key: str
    gate_name: str
    sort_order: int
    milestone_role: str
    created_at: datetime
    updated_at: datetime
    deliverables: List[GateTemplateDeliverableResponse] = Field(default_factory=list)


class GateTemplateCreate(BaseModel):
    project_type: str
    template_code: Optional[str] = None
    template_name: str
    notes: Optional[str] = None
    copy_from_id: Optional[int] = None


class GateTemplateUpdate(BaseModel):
    template_name: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class GateTemplateSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    tenant_id: int
    project_type: str
    template_code: str
    template_name: str
    is_default: bool
    is_active: bool
    notes: Optional[str] = None
    stage_count: int = 0
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class GateTemplateDetailResponse(GateTemplateSummaryResponse):
    stages: List[GateTemplateStageResponse] = Field(default_factory=list)


class GateTemplateStagesSave(BaseModel):
    stages: List[GateTemplateStageInput]
