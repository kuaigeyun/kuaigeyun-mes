"""生产工单同步绑定与执行 schema。"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class WorkOrderSyncBindingOut(BaseSchema):
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Dict[str, str] = Field(default_factory=dict)
    match_key_field: str = "code"
    sync_mode: str = "manual_full"
    schedule_interval_minutes: int = 15
    last_success_at: Optional[datetime] = None
    last_attempt_at: Optional[datetime] = None
    last_error: Optional[str] = None


class WorkOrderSyncBindingUpsert(BaseSchema):
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    match_key_field: Optional[str] = None
    sync_mode: Optional[str] = None
    schedule_interval_minutes: Optional[int] = None


class WorkOrderSyncFromSourceRequest(BaseSchema):
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    save_binding: bool = False
    sync_mode: Optional[str] = None
    schedule_interval_minutes: Optional[int] = None
    incremental: Optional[bool] = None
    skip_prerequisite_syncs: bool = False
    """仅同步有效主数据或未完成单据。默认开启。"""
    active_only: bool = True


class WorkOrderSyncFromSourceOut(BaseSchema):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    errors: List[str] = Field(default_factory=list)


class WorkOrderPushBindingOut(BaseSchema):
    connection_code: Optional[str] = None
    save_api_uuid: Optional[str] = None
    sync_mode: str = "manual_full"
    schedule_interval_minutes: int = 15
    last_success_at: Optional[datetime] = None
    last_attempt_at: Optional[datetime] = None
    last_error: Optional[str] = None


class WorkOrderPushBindingUpsert(BaseSchema):
    connection_code: Optional[str] = None
    save_api_uuid: Optional[str] = None
    sync_mode: Optional[str] = None
    schedule_interval_minutes: Optional[int] = None


class WorkOrderPushCandidateOut(BaseSchema):
    id: int
    code: Optional[str] = None
    name: Optional[str] = None
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    quantity: Optional[float] = None
    status: Optional[str] = None
    planned_start_date: Optional[datetime] = None


class WorkOrderPushCandidateListOut(BaseSchema):
    items: List[WorkOrderPushCandidateOut] = Field(default_factory=list)
    total: int = 0
