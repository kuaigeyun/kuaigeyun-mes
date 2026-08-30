"""主数据同步 schema。"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema

VALID_SYNC_MODES = frozenset({"manual_full", "scheduled_full", "scheduled_incremental"})


class MasterDataSyncBindingOut(BaseSchema):
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


class MasterDataSyncBindingUpsert(BaseSchema):
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    match_key_field: Optional[str] = None
    sync_mode: Optional[str] = None
    schedule_interval_minutes: Optional[int] = None


class MasterDataSyncFromSourceRequest(BaseSchema):
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    save_binding: bool = False
    skip_prerequisite_syncs: bool = False
    sync_mode: Optional[str] = None
    schedule_interval_minutes: Optional[int] = None
    incremental: Optional[bool] = None
    """仅同步有效主数据（已审核未禁用）或未完成单据（已审核未关闭）。默认开启。"""
    active_only: bool = True


class MasterDataSyncFromSourceOut(BaseSchema):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    """源端本轮拉取行数（增量无变更时为 0）。"""
    fetched: int = 0
    """full=全量拉取；incremental=按水位增量。"""
    mode: str = "full"
    errors: List[str] = Field(default_factory=list)
