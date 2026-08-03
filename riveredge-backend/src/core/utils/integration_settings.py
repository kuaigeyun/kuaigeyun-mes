"""
站点集成设置工具

用于站点 settings.integrations 的脱敏展示与更新合并（如 DeepSeek API Key）。
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Optional

INTEGRATION_API_KEY_MASK = "********"

DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash"
DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com"
RAG_BACKEND_NATIVE = "native"
RAG_BACKEND_LLAMAINDEX = "llamaindex"


def normalize_rag_backend(value: Any) -> str:
    raw = str(value or RAG_BACKEND_NATIVE).strip().lower()
    if raw == RAG_BACKEND_LLAMAINDEX:
        return RAG_BACKEND_LLAMAINDEX
    return RAG_BACKEND_NATIVE


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _is_masked_api_key(value: Any) -> bool:
    return isinstance(value, str) and value.strip() == INTEGRATION_API_KEY_MASK


def is_deepseek_api_key_configured(deepseek: Dict[str, Any]) -> bool:
    """判断 DeepSeek API Key 是否已配置（内部读取，含明文）。"""
    api_key = deepseek.get("api_key")
    return bool(isinstance(api_key, str) and api_key.strip() and not _is_masked_api_key(api_key))


def is_deepseek_ocr_api_key_configured(deepseek: Dict[str, Any]) -> bool:
    """判断 OCR 视觉端点 API Key 是否已配置（未单独配置时沿用 DeepSeek Key）。"""
    ocr_api_key = deepseek.get("ocr_api_key")
    if isinstance(ocr_api_key, str) and ocr_api_key.strip() and not _is_masked_api_key(ocr_api_key):
        return True
    return is_deepseek_api_key_configured(deepseek)


def is_deepseek_ocr_endpoint_configured(deepseek: Dict[str, Any]) -> bool:
    """OCR 视觉端点 base_url + model 是否已配置。"""
    ocr_base = deepseek.get("ocr_base_url") or deepseek.get("vision_base_url")
    ocr_model = deepseek.get("ocr_model") or deepseek.get("vision_model")
    return bool(
        isinstance(ocr_base, str)
        and ocr_base.strip()
        and isinstance(ocr_model, str)
        and ocr_model.strip()
    )


def build_deepseek_public_status(settings: Dict[str, Any]) -> Dict[str, Any]:
    """构建 DeepSeek 集成对外状态（KU-AI 对话门控与站点设置展示共用）。"""
    deepseek = get_deepseek_integration(settings)
    configured = is_deepseek_api_key_configured(deepseek)
    enabled = bool(deepseek.get("enabled"))
    model = deepseek.get("model") or DEEPSEEK_DEFAULT_MODEL
    return {
        "configured": configured,
        "enabled": enabled and configured,
        "model": model,
        "rag_backend": normalize_rag_backend(deepseek.get("rag_backend")),
    }


def mask_integrations_for_response(settings: Dict[str, Any]) -> Dict[str, Any]:
    """GET 站点设置时对 integrations 脱敏，不返回明文 API Key。"""
    if not settings or "integrations" not in settings:
        return settings

    result = deepcopy(settings)
    integrations = result.get("integrations")
    if not isinstance(integrations, dict):
        return result

    deepseek = integrations.get("deepseek")
    if isinstance(deepseek, dict):
        deepseek["api_key_configured"] = is_deepseek_api_key_configured(deepseek)
        deepseek["api_key"] = ""
        deepseek["ocr_api_key_configured"] = is_deepseek_ocr_api_key_configured(deepseek)
        deepseek["ocr_api_key"] = ""
        deepseek["ocr_configured"] = is_deepseek_ocr_endpoint_configured(deepseek)

    return result


def merge_integrations_update(
    current_integrations: Optional[Dict[str, Any]],
    incoming_integrations: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """PUT 站点设置时合并 integrations；API Key 留空或掩码则不覆盖。"""
    merged: Dict[str, Any] = deepcopy(current_integrations) if isinstance(current_integrations, dict) else {}

    if not isinstance(incoming_integrations, dict):
        return merged

    for provider, incoming_provider in incoming_integrations.items():
        if not isinstance(incoming_provider, dict):
            merged[provider] = incoming_provider
            continue

        current_provider = merged.get(provider)
        if not isinstance(current_provider, dict):
            current_provider = {}

        next_provider = {**current_provider, **incoming_provider}
        incoming_api_key = incoming_provider.get("api_key")
        if _is_blank(incoming_api_key) or _is_masked_api_key(incoming_api_key):
            if current_provider.get("api_key"):
                next_provider["api_key"] = current_provider["api_key"]
            else:
                next_provider.pop("api_key", None)

        incoming_ocr_api_key = incoming_provider.get("ocr_api_key")
        if _is_blank(incoming_ocr_api_key) or _is_masked_api_key(incoming_ocr_api_key):
            if current_provider.get("ocr_api_key"):
                next_provider["ocr_api_key"] = current_provider["ocr_api_key"]
            else:
                next_provider.pop("ocr_api_key", None)

        merged[provider] = next_provider

    return merged


def get_deepseek_integration(settings: Dict[str, Any]) -> Dict[str, Any]:
    """读取租户 DeepSeek 集成配置（内部使用，含明文 api_key）。"""
    integrations = settings.get("integrations") if isinstance(settings, dict) else None
    if not isinstance(integrations, dict):
        return {}

    deepseek = integrations.get("deepseek")
    return deepseek if isinstance(deepseek, dict) else {}
