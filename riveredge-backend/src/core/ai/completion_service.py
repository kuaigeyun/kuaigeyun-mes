"""DeepSeek Chat Completions 代理（非流式 + SSE 流式）。"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator, Dict, Optional

import httpx
from loguru import logger

from core.ai.runtime_config import AiRuntimeConfig
from infra.exceptions.exceptions import ValidationError
from infra.infrastructure.http import get_http_client


class CompletionService:
    """统一 LLM HTTP 代理，error mapping 与 httpx 复用 platform 连接池。"""

    @staticmethod
    def _chat_url(config: AiRuntimeConfig) -> str:
        return f"{config.chat_base_url.rstrip('/')}/chat/completions"

    @staticmethod
    def _headers(config: AiRuntimeConfig) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {config.chat_api_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    async def complete(
        config: AiRuntimeConfig,
        payload: Dict[str, Any],
        *,
        timeout: float = 120.0,
        error_prefix: str = "DeepSeek 调用失败",
    ) -> Dict[str, Any]:
        payload = {**payload, "stream": False}
        url = CompletionService._chat_url(config)
        client = get_http_client()
        try:
            response = await client.post(
                url,
                json=payload,
                headers=CompletionService._headers(config),
                timeout=timeout,
            )
        except httpx.RequestError as exc:
            logger.error(
                "AI completion request failed tenant_id={} url={} error={}",
                config.tenant_id,
                url,
                exc,
            )
            raise ValidationError("无法连接 DeepSeek 服务，请检查网络或 Base URL") from exc

        if response.status_code >= 400:
            detail = response.text
            try:
                body = response.json()
                detail = body.get("error", {}).get("message") or body.get("message") or detail
            except Exception:
                pass
            logger.warning(
                "AI completion error tenant_id={} status={} detail={}",
                config.tenant_id,
                response.status_code,
                detail,
            )
            if response.status_code >= 504 or "timeout" in str(detail).lower():
                raise ValidationError(f"{error_prefix}：请求超时")
            raise ValidationError(f"{error_prefix}：{detail}")

        try:
            return response.json()
        except ValueError as exc:
            raise ValidationError("DeepSeek 返回了无效的 JSON 响应") from exc

    @staticmethod
    async def stream_chat(
        config: AiRuntimeConfig,
        payload: Dict[str, Any],
        *,
        timeout: float = 120.0,
        error_prefix: str = "DeepSeek 流式调用失败",
    ) -> AsyncIterator[bytes]:
        if not config.stream_enabled:
            raise ValidationError("站点未启用流式对话")

        stream_payload = {**payload, "stream": True}
        url = CompletionService._chat_url(config)
        client = get_http_client()

        try:
            async with client.stream(
                "POST",
                url,
                json=stream_payload,
                headers=CompletionService._headers(config),
                timeout=timeout,
            ) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    detail = body.decode("utf-8", errors="replace")
                    try:
                        parsed = json.loads(detail)
                        detail = (
                            parsed.get("error", {}).get("message")
                            or parsed.get("message")
                            or detail
                        )
                    except Exception:
                        pass
                    raise ValidationError(f"{error_prefix}：{detail}")

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data:"):
                        yield f"{line}\n\n".encode("utf-8")
                    else:
                        yield f"data: {line}\n\n".encode("utf-8")
                yield b"data: [DONE]\n\n"
        except ValidationError:
            raise
        except httpx.RequestError as exc:
            logger.error(
                "AI stream request failed tenant_id={} url={} error={}",
                config.tenant_id,
                url,
                exc,
            )
            raise ValidationError("无法连接 DeepSeek 服务，请检查网络或 Base URL") from exc

    @staticmethod
    def wrap_sse_from_completion(body: Dict[str, Any]) -> AsyncIterator[bytes]:
        """将完整 completion 转为 SSE（Agent 工具循环后的兜底）。"""

        async def _gen() -> AsyncIterator[bytes]:
            chunk = {
                "choices": [
                    {
                        "index": 0,
                        "delta": {
                            "role": "assistant",
                            "content": (
                                (body.get("choices") or [{}])[0]
                                .get("message", {})
                                .get("content", "")
                            ),
                        },
                    }
                ],
            }
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n".encode("utf-8")
            yield b"data: [DONE]\n\n"

        return _gen()
