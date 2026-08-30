"""销售订单同步绑定与执行 schema。"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class SalesOrderSyncBindingOut(BaseSchema):
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Dict[str, str] = Field(default_factory=dict)
    match_key_field: str = "order_code"
    sync_mode: str = "manual_full"
    schedule_interval_minutes: int = 15
    last_success_at: Optional[datetime] = None
    last_attempt_at: Optional[datetime] = None
    last_error: Optional[str] = None


class SalesOrderSyncBindingUpsert(BaseSchema):
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    match_key_field: Optional[str] = None
    sync_mode: Optional[str] = None
    schedule_interval_minutes: Optional[int] = None


class SalesOrderSyncFromSourceRequest(BaseSchema):
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


class SalesOrderSyncFromSourceOut(BaseSchema):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    fetched: int = 0
    mode: str = "full"
    errors: List[str] = Field(default_factory=list)
