"""
KU-AI 对话 API

代理 DeepSeek Chat Completions，API Key 由站点设置统一管理。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from apps.kuaiai.services.deepseek_service import DeepSeekService
from core.api.deps.access import AuthContext, get_auth_context, require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User
from loguru import logger

router = APIRouter(prefix="/chat", tags=["App · KU-AI · Chat"])


class ChatCompletionRequest(BaseModel):
    messages: List[Dict[str, Any]] = Field(..., min_length=1)
    model: Optional[str] = None
    stream: bool = False
    temperature: Optional[float] = Field(default=0.7, ge=0, le=2)


class ChatStatusResponse(BaseModel):
    configured: bool
    enabled: bool
    model: str


@router.get(
    "/status",
    response_model=ChatStatusResponse,
    dependencies=[Depends(require_permission_codes("kuaiai:entry:read"))],
)
async def get_chat_status(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """查询当前租户 DeepSeek 集成是否可用。"""
    return await DeepSeekService.get_public_status(tenant_id)


@router.post(
    "/completions",
    dependencies=[Depends(require_permission_codes("kuaiai:entry:read"))],
)
async def create_chat_completion(
    body: ChatCompletionRequest,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """代理 DeepSeek Chat Completions（OpenAI 兼容格式）。"""
    try:
        return await DeepSeekService.create_chat_completion(
            tenant_id,
            body.messages,
            model=body.model,
            temperature=body.temperature,
            stream=body.stream,
            user=current_user,
            is_infra_admin=auth.is_infra_admin,
            is_tenant_admin=auth.is_tenant_admin,
        )
    except ValidationError as exc:
        raise _validation_http_exception(exc) from exc
    except Exception as exc:
        logger.error("KU-AI 对话失败 tenant_id={} error={}", tenant_id, exc)
        raise _validation_http_exception(ValidationError("对话请求失败，请稍后重试")) from exc


def _validation_http_exception(exc: ValidationError):
    from fastapi import HTTPException

    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
