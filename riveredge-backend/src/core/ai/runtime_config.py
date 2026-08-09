"""AI 运行时配置：站点 DeepSeek 集成为唯一模型真源。"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from core.services.system.site_setting_service import SiteSettingService
from core.utils.integration_settings import (
    DEEPSEEK_DEFAULT_BASE_URL,
    DEEPSEEK_DEFAULT_MODEL,
    build_deepseek_public_status,
    get_deepseek_integration,
    normalize_rag_backend,
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

    @classmethod
    async def load(cls, tenant_id: int) -> "AiRuntimeConfig":
        site_settings = await SiteSettingService.get_settings(tenant_id)
        settings = site_settings.settings or {}
        deepseek = get_deepseek_integration(settings)

        if not deepseek.get("enabled"):
            raise ValidationError("DeepSeek 集成未启用，请在系统配置 → 应用连接器中开启 KU-AI")
        api_key = deepseek.get("api_key")
        if not isinstance(api_key, str) or not api_key.strip():
            raise ValidationError("未配置 DeepSeek API Key，请在系统配置 → 应用连接器中填写")

        vision = await get_deepseek_runtime_config(tenant_id)
        custom_prompt = deepseek.get("custom_system_prompt")
        if isinstance(custom_prompt, str):
            custom_prompt = custom_prompt.strip() or None
        else:
            custom_prompt = None

        tools_enabled = deepseek.get("tools_enabled")
        if tools_enabled is None:
            tools_enabled = True
        rag_enabled = deepseek.get("rag_enabled")
        if rag_enabled is None:
            rag_enabled = True
        stream_enabled = deepseek.get("stream_enabled")
        if stream_enabled is None:
            stream_enabled = True

        return cls(
            tenant_id=tenant_id,
            chat_api_key=vision["chat_api_key"],
            chat_base_url=vision["chat_base_url"],
            chat_model=vision["chat_model"],
            ocr_base_url=vision.get("ocr_base_url"),
            ocr_model=vision.get("ocr_model"),
            ocr_api_key=vision.get("ocr_api_key"),
            ocr_configured=bool(vision.get("ocr_configured")),
            tools_enabled=bool(tools_enabled),
            rag_enabled=bool(rag_enabled),
            rag_use_embedding=deepseek.get("rag_use_embedding", True) is not False,
            rag_backend=normalize_rag_backend(deepseek.get("rag_backend")),
            rag_top_k=int(deepseek.get("rag_top_k") or 5),
            stream_enabled=bool(stream_enabled),
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
        site_settings = await SiteSettingService.get_settings(tenant_id)
        return build_deepseek_public_status(site_settings.settings or {})
