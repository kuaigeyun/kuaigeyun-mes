"""
RiverEdge AI Runtime 网关

统一入口：/api/v1/core/ai/*
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.ai.chat_handler import create_chat_completion
from core.ai.deps import AiAuth, get_ai_auth, require_ai_capability
from core.ai.draft_profiles import ensure_draft_profiles
from core.ai.jobs import AiJobService
from core.ai.runtime_config import AiRuntimeConfig
from core.ai.schemas.chat import (
    AiErrorResponse,
    ChatCompletionRequest,
    ChatCompletionResponse,
)
from core.ai.schemas.draft import StructuredDraftRequest, StructuredDraftResult
from core.ai.schemas.jobs import AiJobCreateRequest, AiJobStatusResponse
from core.ai.schemas.stats import AiAuditLogListResponse, AiStatsOverviewResponse
from core.ai.stats_service import AiStatsService
from core.ai.structured_draft import StructuredDraftService
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/ai", tags=["Core - AI Runtime"])


class AiIntegrationStatusResponse(BaseModel):
    configured: bool
    enabled: bool
    model: str


@router.get(
    "/status",
    response_model=AiIntegrationStatusResponse,
    dependencies=[Depends(require_ai_capability("entry"))],
)
async def get_ai_status(ai_auth: AiAuth = Depends(get_ai_auth)):
    """查询当前租户 DeepSeek / KU-AI 集成状态。"""
    return await AiRuntimeConfig.public_status(ai_auth.tenant_id)


@router.post(
    "/chat/completions",
    response_model=None,
    dependencies=[Depends(require_ai_capability("chat"))],
    responses={
        200: {
            "description": "Chat completion (JSON or SSE)",
            "content": {
                "application/json": {"schema": ChatCompletionResponse.model_json_schema()},
                "text/event-stream": {"schema": {"type": "string"}},
            },
        },
        400: {"model": AiErrorResponse},
    },
)
async def ai_chat_completions(
    body: ChatCompletionRequest,
    ai_auth: AiAuth = Depends(get_ai_auth),
):
    try:
        result = await create_chat_completion(
            ai_auth,
            body.messages,
            model=body.model,
            temperature=body.temperature,
            stream=body.stream,
            context=body.normalized_context(),
        )
        if isinstance(result, StreamingResponse):
            return result
        return ChatCompletionResponse.model_validate(result)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/draft/structure",
    response_model=StructuredDraftResult,
    dependencies=[Depends(require_ai_capability("draft"))],
)
async def ai_draft_structure(
    body: StructuredDraftRequest,
    ai_auth: AiAuth = Depends(get_ai_auth),
):
    """OCR / 自然语言统一结构化入口。"""
    ensure_draft_profiles()
    profile = StructuredDraftService.get_profile(body.schema_name)

    try:
        if body.source_text:
            data = await StructuredDraftService.complete_json(
                ai_auth.tenant_id,
                system=profile.system_prompt,
                user_content=f"{profile.json_spec}\n\n---\n{body.source_text}",
                error_prefix=f"{body.schema_name} 结构化失败",
            )
            return StructuredDraftResult(schema_name=body.schema_name, data=data, raw_text=body.source_text)

        if body.image_base64:
            import base64

            image_bytes = base64.b64decode(body.image_base64)
            from pydantic import BaseModel

            class _AnyModel(BaseModel):
                model_config = {"extra": "allow"}

            result = await StructuredDraftService.structure_from_image(
                ai_auth.tenant_id,
                schema_name=body.schema_name,
                image_bytes=image_bytes,
                content_type=body.image_mime,
                result_type=_AnyModel,
            )
            return StructuredDraftResult(
                schema_name=body.schema_name,
                data=result.model_dump(by_alias=True),
            )

        raise ValidationError("source_text 与 image_base64 至少提供一项")
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post(
    "/agent/run",
    dependencies=[Depends(require_ai_capability("agent"))],
)
async def ai_agent_run(
    body: ChatCompletionRequest,
    ai_auth: AiAuth = Depends(get_ai_auth),
):
    """显式 Agent 入口（与 chat/completions 相同，保留扩展位）。"""
    return await ai_chat_completions(body, ai_auth)


@router.post(
    "/jobs",
    response_model=AiJobStatusResponse,
    dependencies=[Depends(require_ai_capability("jobs"))],
)
async def ai_create_job(
    body: AiJobCreateRequest,
    ai_auth: AiAuth = Depends(get_ai_auth),
):
    try:
        return await AiJobService.create_job(
            tenant_id=ai_auth.tenant_id,
            user_id=ai_auth.user.id,
            job_type=body.job_type,
            payload=body.payload,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get(
    "/jobs/{job_id}",
    response_model=AiJobStatusResponse,
    dependencies=[Depends(require_ai_capability("jobs"))],
)
async def ai_get_job(
    job_id: str,
    ai_auth: AiAuth = Depends(get_ai_auth),
):
    try:
        return await AiJobService.get_job(tenant_id=ai_auth.tenant_id, job_id=job_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/stats/overview",
    response_model=AiStatsOverviewResponse,
    dependencies=[Depends(require_ai_capability("entry"))],
)
async def ai_stats_overview(
    days: int = Query(default=7, ge=1, le=90),
    ai_auth: AiAuth = Depends(get_ai_auth),
):
    return await AiStatsService.get_overview(tenant_id=ai_auth.tenant_id, days=days)


@router.get(
    "/audit/logs",
    response_model=AiAuditLogListResponse,
    dependencies=[Depends(require_ai_capability("entry"))],
)
async def ai_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    capability: Optional[str] = Query(default=None),
    ai_auth: AiAuth = Depends(get_ai_auth),
):
    return await AiStatsService.list_audit_logs(
        tenant_id=ai_auth.tenant_id,
        page=page,
        page_size=page_size,
        capability=capability,
    )
