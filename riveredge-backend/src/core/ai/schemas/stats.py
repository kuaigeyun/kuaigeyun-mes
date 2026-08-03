"""AI 统计与审计契约。"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class AiCapabilityStat(BaseModel):
    capability: Optional[str] = None
    count: int = 0


class AiDayStat(BaseModel):
    day: str
    count: int = 0


class AiStatsOverviewResponse(BaseModel):
    days: int = 7
    total_calls: int = 0
    avg_latency_ms: Optional[int] = None
    pulse_suggestion_count: int = 0
    knowledge_document_count: int = 0
    by_capability: List[AiCapabilityStat] = Field(default_factory=list)
    by_day: List[AiDayStat] = Field(default_factory=list)
    empty_reason: Optional[str] = None


class AiAuditLogItem(BaseModel):
    uuid: str
    route: str
    capability: Optional[str] = None
    model: Optional[str] = None
    latency_ms: Optional[int] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    status_code: Optional[int] = None
    error_message: Optional[str] = None
    created_at: str
    user_id: Optional[int] = None


class AiAuditLogListResponse(BaseModel):
    items: List[AiAuditLogItem] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20
    empty_reason: Optional[str] = None
