"""报工同步绑定与执行 schema。"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class ReportingSyncBindingOut(BaseSchema):
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Dict[str, str] = Field(default_factory=dict)
    match_key_field: str = "id"
    sync_mode: str = "manual_full"
    sync_direction: str = "pull"
    schedule_interval_minutes: int = 15
    last_success_at: Optional[datetime] = None
    last_attempt_at: Optional[datetime] = None
    last_error: Optional[str] = None


class ReportingSyncBindingUpsert(BaseSchema):
    source_type: Optional[str] = None
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None
    match_key_field: Optional[str] = None
    sync_mode: Optional[str] = None
    sync_direction: Optional[str] = None
    schedule_interval_minutes: Optional[int] = None


class ReportingSyncFromSourceRequest(BaseSchema):
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


class ReportingSyncFromSourceOut(BaseSchema):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    fetched: int = 0
    mode: str = "full"
    """达到单次最大拉取页数，源端还有数据未拉完。"""
    truncated: bool = False
    errors: List[str] = Field(default_factory=list)


class ReportingSyncHistoryItem(BaseSchema):
    """同步运行历史（来自 core_sync_run_logs，只读）。"""

    id: int = Field(..., description="日志主键")
    entity_type: str = Field("reporting", description="实体类型")
    mode: str = Field("full", description="full | incremental")
    status: str = Field("success", description="success | partial | failed")
    created: int = Field(0, description="新建条数")
    updated: int = Field(0, description="更新条数")
    skipped: int = Field(0, description="跳过条数")
    failed: int = Field(0, description="失败条数")
    fetched: int = Field(0, description="源端拉取行数")
    truncated: bool = Field(False, description="源端分页未拉完（水位未推进）")
    duration_ms: int = Field(0, description="耗时（毫秒）")
    error_summary: Optional[str] = Field(None, description="错误摘要")
    started_at: Optional[datetime] = Field(None, description="开始时间")
    finished_at: Optional[datetime] = Field(None, description="结束时间")
    created_at: Optional[datetime] = Field(None, description="记录时间")


class ReportingSyncHistoryListResponse(BaseSchema):
    """同步运行历史分页响应。"""

    data: List[ReportingSyncHistoryItem] = Field(default_factory=list)
    total: int = Field(0, description="总行数")
    success: bool = Field(True, description="是否成功")
