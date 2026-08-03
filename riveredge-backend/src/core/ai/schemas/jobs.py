"""AI 异步任务契约。"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class AiJobCreateRequest(BaseModel):
    job_type: str = Field(..., description="任务类型，如 ocr_extract / rag_reindex")
    payload: Dict[str, Any] = Field(default_factory=dict)


class AiJobStatusResponse(BaseModel):
    job_id: str
    job_type: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)
