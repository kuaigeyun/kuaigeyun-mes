"""即时库存同步绑定与执行 schema。"""
from datetime import datetime
from typing import Dict, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema
from core.schemas.sync_binding_contract import SyncSourceItem


class InventorySyncBindingOut(BaseSchema):
    sources: List[SyncSourceItem] = Field(default_factory=list)
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Dict[str, str] = Field(default_factory=dict)
    match_key_field: str = "material_code"
    sync_mode: str = "manual_full"
    sync_direction: str = "pull"
    schedule_interval_minutes: int = 15
    last_success_at: Optional[datetime] = None
    last_attempt_at: Optional[datetime] = None
    last_error: Optional[str] = None


class InventorySyncBindingUpsert(BaseSchema):
    sources: Optional[List[SyncSourceItem]] = None
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    match_key_field: Optional[str] = None
    sync_mode: Optional[str] = None
    sync_direction: Optional[str] = None
    schedule_interval_minutes: Optional[int] = None


class InventorySyncFromSourceRequest(BaseSchema):
    sources: Optional[List[SyncSourceItem]] = None
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    save_binding: bool = False
    skip_prerequisite_syncs: bool = False
    sync_mode: Optional[str] = None
    sync_direction: Optional[str] = None
    schedule_interval_minutes: Optional[int] = None
    incremental: Optional[bool] = None
    active_only: bool = True


class InventorySyncFromSourceOut(BaseSchema):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    fetched: int = 0
    mode: str = "full"
    """达到单次最大拉取页数，源端还有数据未拉完。"""
    truncated: bool = False
    errors: List[str] = Field(default_factory=list)
