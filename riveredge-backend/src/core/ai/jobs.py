"""AI 异步长任务（TaskIQ + 内存状态）。"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from loguru import logger

from core.ai.schemas.jobs import AiJobStatusResponse
from infra.exceptions.exceptions import NotFoundError, ValidationError


@dataclass
class _AiJobRecord:
    job_id: str
    tenant_id: int
    user_id: int
    job_type: str
    status: str
    payload: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: Optional[int] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class AiJobService:
    _jobs: Dict[str, _AiJobRecord] = {}

    @classmethod
    async def create_job(
        cls,
        *,
        tenant_id: int,
        user_id: int,
        job_type: str,
        payload: Dict[str, Any],
    ) -> AiJobStatusResponse:
        job_type = (job_type or "").strip()
        if not job_type:
            raise ValidationError("job_type 不能为空")

        job_id = str(uuid.uuid4())
        record = _AiJobRecord(
            job_id=job_id,
            tenant_id=tenant_id,
            user_id=user_id,
            job_type=job_type,
            status="pending",
            payload=payload,
        )
        cls._jobs[job_id] = record

        try:
            from core.tasks.ai_tasks import run_ai_job

            await run_ai_job.kiq(
                job_id=job_id,
                tenant_id=tenant_id,
                user_id=user_id,
                job_type=job_type,
                payload=payload,
            )
            record.status = "queued"
        except Exception as exc:
            logger.warning("TaskIQ 投递 AI 任务失败，同步标记 failed job_id={} error={}", job_id, exc)
            record.status = "failed"
            record.error = str(exc)

        record.updated_at = datetime.now(timezone.utc)
        return cls._to_response(record)

    @classmethod
    async def get_job(cls, *, tenant_id: int, job_id: str) -> AiJobStatusResponse:
        record = cls._jobs.get(job_id)
        if not record or record.tenant_id != tenant_id:
            raise NotFoundError(message="AI 任务不存在")
        return cls._to_response(record)

    @classmethod
    def update_job(
        cls,
        job_id: str,
        *,
        status: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        progress: Optional[int] = None,
    ) -> None:
        record = cls._jobs.get(job_id)
        if not record:
            return
        if status is not None:
            record.status = status
        if result is not None:
            record.result = result
        if error is not None:
            record.error = error
        if progress is not None:
            record.progress = progress
        record.updated_at = datetime.now(timezone.utc)

    @classmethod
    def _to_response(cls, record: _AiJobRecord) -> AiJobStatusResponse:
        return AiJobStatusResponse(
            job_id=record.job_id,
            job_type=record.job_type,
            status=record.status,
            result=record.result,
            error=record.error,
            progress=record.progress,
        )
