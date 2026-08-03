"""Chat Completions 契约。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from core.ai.schemas.context import AiBusinessContext


class ChatCompletionRequest(BaseModel):
    messages: List[Dict[str, Any]] = Field(..., min_length=1)
    model: Optional[str] = None
    stream: bool = False
    temperature: Optional[float] = Field(default=0.7, ge=0, le=2)
    context: Optional[AiBusinessContext | Dict[str, Any]] = None

    def normalized_context(self) -> Optional[Dict[str, Any]]:
        if self.context is None:
            return None
        if isinstance(self.context, AiBusinessContext):
            return self.context.to_broker_dict()
        if isinstance(self.context, dict):
            return self.context
        return None


class ChatCompletionChoiceMessage(BaseModel):
    role: Optional[str] = None
    content: Optional[str] = None


class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: Optional[ChatCompletionChoiceMessage] = None
    finish_reason: Optional[str] = None


class ChatCompletionUsage(BaseModel):
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None


class ChatCompletionResponse(BaseModel):
    id: Optional[str] = None
    object: Optional[str] = "chat.completion"
    created: Optional[int] = None
    model: Optional[str] = None
    choices: List[ChatCompletionChoice] = Field(default_factory=list)
    usage: Optional[ChatCompletionUsage] = None


class AiErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
