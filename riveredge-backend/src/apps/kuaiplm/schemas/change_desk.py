"""
变更工作台 / 仪表盘 Schema

Author: RiverEdge Team
Date: 2026-05-28
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ChangeDeskItem(BaseModel):
    id: int = Field(..., description="内部主键，供 uni-audit 使用")
    category: str = Field(..., description="bom | process_route")
    change_type: str = Field(..., description="业务变更类型，如 item_modify / operation_change")
    uuid: str
    status: str
    change_content: Optional[Dict[str, Any]] = None
    change_reason: Optional[str] = None
    applicant_id: Optional[int] = None
    created_at: datetime
    entity_code: Optional[str] = None
    entity_name: Optional[str] = None
    extra: Dict[str, Any] = Field(default_factory=dict)
    audit: Optional[Dict[str, Any]] = Field(None, description="统一审核相位（record.audit）")

    model_config = ConfigDict(from_attributes=True)


class ChangeDeskListResponse(BaseModel):
    items: List[ChangeDeskItem] = Field(default_factory=list)
    total: int = 0


class ChangeApproveRequest(BaseModel):
    change_type: str = Field(..., description="bom | process_route")
    approved: bool = True
    approval_comment: Optional[str] = None


class ChangeExecuteRequest(BaseModel):
    change_type: str = Field(..., description="bom | process_route")


class ChangeSubmitRequest(BaseModel):
    change_type: str = Field(..., description="bom | process_route")


class ChangeBatchItem(BaseModel):
    change_uuid: str = Field(..., description="变更UUID")
    change_type: str = Field(..., description="bom | process_route")


class ChangeBatchApproveRequest(BaseModel):
    items: List[ChangeBatchItem] = Field(default_factory=list, min_length=1)
    approved: bool = True
    approval_comment: Optional[str] = None


class ChangeBatchExecuteRequest(BaseModel):
    items: List[ChangeBatchItem] = Field(default_factory=list, min_length=1)


class ChangeBatchDeleteRequest(BaseModel):
    items: List[ChangeBatchItem] = Field(default_factory=list, min_length=1)


class ChangeBatchActionResponse(BaseModel):
    success_count: int = 0
    failed_count: int = 0
    failed_items: List[ChangeBatchItem] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


class DashboardSummaryResponse(BaseModel):
    project_total: int = 0
    project_rd_total: int = 0
    project_delivery_total: int = 0
    project_in_progress: int = 0
    project_on_hold: int = 0
    project_completed: int = 0
    open_tasks: int = 0
    pending_gate_reviews: int = 0
    pending_bom_changes: int = 0
    pending_route_changes: int = 0
    kb_article_total: int = 0
    requirement_total: int = 0
    design_review_pending: int = 0
    fmea_total: int = 0
    recent_projects: List[Dict[str, Any]] = Field(default_factory=list)
    project_gantt: List[Dict[str, Any]] = Field(default_factory=list)
    my_tasks: List[Dict[str, Any]] = Field(default_factory=list)


class MyTaskItem(BaseModel):
    id: int
    project_id: int
    project_code: str
    project_name: str
    task_name: str
    status: str
    due_date: Optional[str] = None
    gate_name: Optional[str] = None
    assignee_name: Optional[str] = None
