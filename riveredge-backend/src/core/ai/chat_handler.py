"""统一 Chat Completion 入口（core 网关 + site-settings 薄转发）。"""

from __future__ import annotations

import importlib.util
from typing import Any, AsyncIterator, Dict, List, Optional, Union

from fastapi.responses import StreamingResponse

from core.ai.agent_runner import AgentRunner
from core.ai.completion_service import CompletionService
from core.ai.deps import AiAuth
from core.ai.runtime_config import AiRuntimeConfig
from infra.exceptions.exceptions import ValidationError


def _normalize_user_chat_messages(messages: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    normalized: List[Dict[str, str]] = []
    for item in messages:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip()
        content = item.get("content")
        if isinstance(content, str):
            text = content.strip()
        elif content is None:
            text = ""
        else:
            text = str(content).strip()
        if not text:
            continue
        if role in {"ai", "assistant"}:
            role = "assistant"
        elif role == "user":
            role = "user"
        elif role == "system":
            role = "system"
        else:
            continue
        normalized.append({"role": role, "content": text})
    return normalized


def _kuaiai_composed() -> bool:
    return importlib.util.find_spec("apps.kuaiai.services.deepseek_service") is not None


async def create_chat_completion(
    ai_auth: AiAuth,
    messages: List[Dict[str, Any]],
    *,
    model: Optional[str] = None,
    temperature: Optional[float] = 0.7,
    stream: bool = False,
    context: Optional[Dict[str, Any]] = None,
) -> Union[Dict[str, Any], StreamingResponse]:
    if not messages:
        raise ValidationError("messages 不能为空")

    normalized = _normalize_user_chat_messages(messages)
    if not normalized:
        raise ValidationError("messages 不能为空")

    if _kuaiai_composed():
        from apps.kuaiai.services.deepseek_service import DeepSeekService

        result = await DeepSeekService.create_chat_completion(
            ai_auth.tenant_id,
            normalized,
            model=model,
            temperature=temperature,
            stream=stream,
            user=ai_auth.user,
            is_infra_admin=ai_auth.auth.is_infra_admin,
            is_tenant_admin=ai_auth.auth.is_tenant_admin,
            context=context,
        )
        if isinstance(result, StreamingResponse):
            return result
        if hasattr(result, "__aiter__"):
            return StreamingResponse(result, media_type="text/event-stream")
        return result

    config = await AiRuntimeConfig.load(ai_auth.tenant_id)
    payload = {
        "model": model or config.chat_model,
        "messages": normalized,
        "temperature": temperature if temperature is not None else 0.7,
    }
    if stream:
        stream_iter = CompletionService.stream_chat(config, payload)
        return StreamingResponse(stream_iter, media_type="text/event-stream")

    runner = AgentRunner(config=config, tool_executor=None)
    return await runner.run(
        normalized,
        model=model,
        temperature=temperature,
        stream=False,
    )
