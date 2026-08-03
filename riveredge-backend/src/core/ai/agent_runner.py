"""Agent 工具循环：从 DeepSeekService 抽出的平台层。"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Union

from core.ai.completion_service import CompletionService
from core.ai.runtime_config import AiRuntimeConfig
from core.ai.tool_registry import ToolRegistry
from infra.exceptions.exceptions import ValidationError

MAX_TOOL_ROUNDS = 6


class AgentRunner:
    """LLM + Tool 多轮循环；RBAC 在 tool executor 内生效。"""

    def __init__(
        self,
        *,
        config: AiRuntimeConfig,
        tool_executor: Optional[Any] = None,
        tool_definitions: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        self.config = config
        self.tool_executor = tool_executor
        ToolRegistry.ensure_defaults()
        self.tool_definitions = tool_definitions or (
            ToolRegistry.get_definitions() if tool_executor is not None else []
        )

    async def run(
        self,
        messages: List[Dict[str, Any]],
        *,
        model: Optional[str] = None,
        temperature: Optional[float] = 0.7,
        stream: bool = False,
        error_prefix: str = "DeepSeek 调用失败",
    ) -> Union[Dict[str, Any], AsyncIterator[bytes]]:
        use_tools = bool(self.tool_executor is not None and self.tool_definitions)
        working_messages = list(messages)
        last_response: Dict[str, Any] | None = None

        for round_idx in range(MAX_TOOL_ROUNDS):
            payload: Dict[str, Any] = {
                "model": model or self.config.chat_model,
                "messages": working_messages,
                "temperature": temperature if temperature is not None else 0.7,
            }
            if use_tools:
                payload["tools"] = self.tool_definitions
                payload["tool_choice"] = "auto"

            is_last_round = round_idx == MAX_TOOL_ROUNDS - 1
            can_stream = stream and not use_tools and round_idx == 0

            if can_stream:
                return CompletionService.stream_chat(
                    self.config,
                    payload,
                    error_prefix=error_prefix,
                )

            last_response = await CompletionService.complete(
                self.config,
                payload,
                error_prefix=error_prefix,
            )
            choice = (last_response.get("choices") or [{}])[0]
            message = choice.get("message") or {}
            tool_calls = message.get("tool_calls") or []

            if not use_tools or not tool_calls:
                if stream:
                    return CompletionService.wrap_sse_from_completion(last_response)
                return last_response

            working_messages.append(message)
            for call in tool_calls:
                fn = call.get("function") or {}
                name = str(fn.get("name") or "")
                raw_args = fn.get("arguments") or "{}"
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args or {})
                except json.JSONDecodeError:
                    args = {}
                result = await self.tool_executor.execute(name, args)
                working_messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id"),
                        "content": result,
                    }
                )

            if is_last_round and tool_calls:
                raise ValidationError("工具调用轮次过多，请简化问题后重试")

        if stream and last_response:
            return CompletionService.wrap_sse_from_completion(last_response)
        return last_response or {}
