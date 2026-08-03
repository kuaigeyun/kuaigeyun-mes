"""KU-AI 业务上下文契约。"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class AiBusinessContext(BaseModel):
    """页面 / 单据上下文，供 ContextBroker 与 Agent 注入。"""

    screen: Optional[str] = Field(default=None, description="当前页面标识")
    resource_key: Optional[str] = Field(default=None, description="业务资源键")
    record_id: Optional[int] = Field(default=None, description="业务记录 ID")
    record_uuid: Optional[str] = Field(default=None, description="业务记录 UUID")
    extra: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "扩展字段。约定键：capability_mode（ask|query|guide，默认 ask）、"
            "preset_prompt（中枢卡片带入的首条用户问题）"
        ),
    )

    def to_broker_dict(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {}
        if self.screen:
            payload["screen"] = self.screen
        if self.resource_key:
            payload["resource_key"] = self.resource_key
        if self.record_id is not None:
            payload["record_id"] = self.record_id
        if self.record_uuid:
            payload["record_uuid"] = self.record_uuid
        if self.extra:
            payload.update(self.extra)
        return payload
