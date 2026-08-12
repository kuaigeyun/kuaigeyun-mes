"""AI 运行时配置：应用连接器选用行 + KU-AI 能力为唯一真源。"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from core.utils.integration_settings import (
    DEEPSEEK_DEFAULT_BASE_URL,
    DEEPSEEK_DEFAULT_MODEL,
    build_deepseek_public_status_for_tenant,
    normalize_rag_backend,
    resolve_active_llm_integration,
)
from core.utils.deepseek_vision_client import get_deepseek_runtime_config
from infra.exceptions.exceptions import ValidationError


class AiRuntimeConfig(BaseModel):
    """租户 AI 运行时配置（chat + OCR + 功能开关）。"""

    tenant_id: int
    chat_api_key: str
    chat_base_url: str = Field(default=DEEPSEEK_DEFAULT_BASE_URL)
    chat_model: str = Field(default=DEEPSEEK_DEFAULT_MODEL)
    ocr_base_url: Optional[str] = None
    ocr_model: Optional[str] = None
    ocr_api_key: Optional[str] = None
    ocr_configured: bool = False
    tools_enabled: bool = True
    rag_enabled: bool = True
    rag_use_embedding: bool = True
    rag_backend: str = "native"
    rag_top_k: int = 5
    stream_enabled: bool = True
    custom_system_prompt: Optional[str] = None
    provider: str = "deepseek"
    connection_uuid: Optional[str] = None

    @classmethod
    async def load(cls, tenant_id: int) -> "AiRuntimeConfig":
        active = await resolve_active_llm_integration(tenant_id)

        if not active.get("enabled"):
            raise ValidationError(
                "AI 连接器未启用，请在应用连接器中启用并填写 API Key，并在 KU-AI → 模型设置中选用"
            )
        api_key = active.get("api_key")
        if not isinstance(api_key, str) or not api_key.strip():
            raise ValidationError("未配置 AI API Key，请在系统配置 → 应用连接器中填写")

        vision = await get_deepseek_runtime_config(tenant_id)
        custom_prompt = active.get("custom_system_prompt")
        if isinstance(custom_prompt, str):
            custom_prompt = custom_prompt.strip() or None
        else:
            custom_prompt = None

        return cls(
            tenant_id=tenant_id,
            provider=str(active.get("provider") or "deepseek"),
            connection_uuid=active.get("connection_uuid"),
            chat_api_key=vision["chat_api_key"],
            chat_base_url=vision["chat_base_url"],
            chat_model=vision["chat_model"],
            ocr_base_url=vision.get("ocr_base_url"),
            ocr_model=vision.get("ocr_model"),
            ocr_api_key=vision.get("ocr_api_key"),
            ocr_configured=bool(vision.get("ocr_configured")),
            tools_enabled=bool(active.get("tools_enabled", True)),
            rag_enabled=bool(active.get("rag_enabled", True)),
            rag_use_embedding=active.get("rag_use_embedding", True) is not False,
            rag_backend=normalize_rag_backend(active.get("rag_backend")),
            rag_top_k=int(active.get("rag_top_k") or 5),
            stream_enabled=bool(active.get("stream_enabled", True)),
            custom_system_prompt=custom_prompt,
        )

    def to_chat_provider_config(self) -> Dict[str, Any]:
        return {
            "api_key": self.chat_api_key,
            "base_url": self.chat_base_url.rstrip("/"),
            "model": self.chat_model,
        }

    @staticmethod
    async def public_status(tenant_id: int) -> Dict[str, Any]:
        return await build_deepseek_public_status_for_tenant(tenant_id)
