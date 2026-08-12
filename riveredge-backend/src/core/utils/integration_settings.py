"""
站点集成设置工具

对话 LLM 密钥存应用连接器 IntegrationConfig；KU-AI 能力/OCR/选用连接存 integrations.kuaiai。
历史 integrations.{provider} 密钥在读取站点设置时一次性迁入连接行后清空。
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Optional

INTEGRATION_API_KEY_MASK = "********"

DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash"
DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com"
RAG_BACKEND_NATIVE = "native"
RAG_BACKEND_LLAMAINDEX = "llamaindex"

# 内置 OpenAI 兼容提供商（应用连接器 AI 分类）
LLM_PROVIDER_SPECS: Dict[str, Dict[str, str]] = {
    "deepseek": {
        "name": "DeepSeek",
        "default_base_url": DEEPSEEK_DEFAULT_BASE_URL,
        "default_model": DEEPSEEK_DEFAULT_MODEL,
    },
    "openai": {
        "name": "OpenAI",
        "default_base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o-mini",
    },
    "qwen": {
        "name": "通义千问",
        "default_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "default_model": "qwen-plus",
    },
    "zhipu": {
        "name": "智谱 GLM",
        "default_base_url": "https://open.bigmodel.cn/api/paas/v4",
        "default_model": "glm-4-flash",
    },
    "moonshot": {
        "name": "月之暗面 Kimi",
        "default_base_url": "https://api.moonshot.cn/v1",
        "default_model": "moonshot-v1-auto",
    },
    "siliconflow": {
        "name": "硅基流动",
        "default_base_url": "https://api.siliconflow.cn/v1",
        "default_model": "deepseek-ai/DeepSeek-V3",
    },
}

LLM_PROVIDER_IDS: List[str] = list(LLM_PROVIDER_SPECS.keys())

# 仅存在于 integrations.kuaiai 的能力/OCR/选用字段
KUAIAI_SETTING_KEYS = (
    "active_provider",
    "active_connection_uuid",
    "tools_enabled",
    "rag_enabled",
    "rag_use_embedding",
    "rag_backend",
    "rag_top_k",
    "stream_enabled",
    "custom_system_prompt",
    "ocr_base_url",
    "ocr_model",
    "ocr_api_key",
)

# 由站点密钥槽迁出的连接 code 前缀
LLM_CONNECTION_CODE_PREFIX = "llm_"

# 历史写在 deepseek 上的能力字段，首次读取时上收到 kuaiai
_LEGACY_CAPABILITY_KEYS = (
    "tools_enabled",
    "rag_enabled",
    "rag_use_embedding",
    "rag_backend",
    "rag_top_k",
    "stream_enabled",
    "custom_system_prompt",
    "ocr_base_url",
    "ocr_model",
    "ocr_api_key",
    "vision_base_url",
    "vision_model",
)


def normalize_rag_backend(value: Any) -> str:
    raw = str(value or RAG_BACKEND_NATIVE).strip().lower()
    if raw == RAG_BACKEND_LLAMAINDEX:
        return RAG_BACKEND_LLAMAINDEX
    return RAG_BACKEND_NATIVE


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _is_masked_api_key(value: Any) -> bool:
    return isinstance(value, str) and value.strip() == INTEGRATION_API_KEY_MASK


def is_llm_api_key_configured(provider: Dict[str, Any]) -> bool:
    api_key = provider.get("api_key")
    return bool(isinstance(api_key, str) and api_key.strip() and not _is_masked_api_key(api_key))


def is_deepseek_api_key_configured(deepseek: Dict[str, Any]) -> bool:
    """兼容旧调用名。"""
    return is_llm_api_key_configured(deepseek)


def is_ocr_api_key_configured(kuaiai: Dict[str, Any], provider: Dict[str, Any]) -> bool:
    ocr_api_key = kuaiai.get("ocr_api_key")
    if isinstance(ocr_api_key, str) and ocr_api_key.strip() and not _is_masked_api_key(ocr_api_key):
        return True
    return is_llm_api_key_configured(provider)


def is_deepseek_ocr_api_key_configured(deepseek: Dict[str, Any]) -> bool:
    """兼容旧调用：传入的是合并后的 runtime 视图。"""
    ocr_api_key = deepseek.get("ocr_api_key")
    if isinstance(ocr_api_key, str) and ocr_api_key.strip() and not _is_masked_api_key(ocr_api_key):
        return True
    return is_llm_api_key_configured(deepseek)


def is_ocr_endpoint_configured(kuaiai: Dict[str, Any]) -> bool:
    ocr_base = kuaiai.get("ocr_base_url") or kuaiai.get("vision_base_url")
    ocr_model = kuaiai.get("ocr_model") or kuaiai.get("vision_model")
    return bool(
        isinstance(ocr_base, str)
        and ocr_base.strip()
        and isinstance(ocr_model, str)
        and ocr_model.strip()
    )


def is_deepseek_ocr_endpoint_configured(deepseek: Dict[str, Any]) -> bool:
    """兼容旧调用：传入合并视图。"""
    ocr_base = deepseek.get("ocr_base_url") or deepseek.get("vision_base_url")
    ocr_model = deepseek.get("ocr_model") or deepseek.get("vision_model")
    return bool(
        isinstance(ocr_base, str)
        and ocr_base.strip()
        and isinstance(ocr_model, str)
        and ocr_model.strip()
    )


def _integrations(settings: Dict[str, Any]) -> Dict[str, Any]:
    integrations = settings.get("integrations") if isinstance(settings, dict) else None
    return integrations if isinstance(integrations, dict) else {}


def promote_legacy_deepseek_into_kuaiai(integrations: Dict[str, Any]) -> bool:
    """
    将历史写在 deepseek 上的能力/OCR 字段上收到 kuaiai，并整理 deepseek 仅保留密钥字段。
    就地修改；返回是否发生变更（供落库）。
    """
    changed = False
    deepseek = integrations.get("deepseek")
    if not isinstance(deepseek, dict):
        deepseek = {}
    else:
        integrations["deepseek"] = deepseek

    kuaiai = integrations.get("kuaiai")
    if not isinstance(kuaiai, dict):
        kuaiai = {}
        integrations["kuaiai"] = kuaiai
        changed = True

    if not kuaiai.get("active_provider"):
        kuaiai["active_provider"] = "deepseek"
        changed = True

    # 已配置 Key 但未写 enabled 时，视为启用（旧数据常见）
    if is_llm_api_key_configured(deepseek) and "enabled" not in deepseek:
        deepseek["enabled"] = True
        changed = True

    for key in _LEGACY_CAPABILITY_KEYS:
        if key in ("vision_base_url", "vision_model"):
            continue
        if key not in kuaiai and key in deepseek:
            kuaiai[key] = deepseek[key]
            changed = True

    if "ocr_base_url" not in kuaiai:
        legacy = deepseek.get("ocr_base_url") or deepseek.get("vision_base_url")
        if legacy:
            kuaiai["ocr_base_url"] = legacy
            changed = True
    if "ocr_model" not in kuaiai:
        legacy = deepseek.get("ocr_model") or deepseek.get("vision_model")
        if legacy:
            kuaiai["ocr_model"] = legacy
            changed = True
    if "ocr_api_key" not in kuaiai and deepseek.get("ocr_api_key"):
        kuaiai["ocr_api_key"] = deepseek["ocr_api_key"]
        changed = True

    # deepseek 只保留连接器密钥字段，避免双源
    for key in _LEGACY_CAPABILITY_KEYS:
        if key in deepseek:
            del deepseek[key]
            changed = True

    return changed


def migrate_legacy_ai_integrations(settings: Dict[str, Any]) -> bool:
    """对 settings.integrations 做 DeepSeek → kuaiai 结构迁移；返回是否变更。"""
    if not isinstance(settings, dict):
        return False
    integrations = settings.get("integrations")
    if not isinstance(integrations, dict):
        return False
    return promote_legacy_deepseek_into_kuaiai(integrations)


def _merge_kuaiai_capabilities(kuaiai: Dict[str, Any], **credential_fields: Any) -> Dict[str, Any]:
    return {
        **credential_fields,
        "tools_enabled": kuaiai.get("tools_enabled", True) is not False,
        "rag_enabled": kuaiai.get("rag_enabled", True) is not False,
        "rag_use_embedding": kuaiai.get("rag_use_embedding", True) is not False,
        "rag_backend": normalize_rag_backend(kuaiai.get("rag_backend")),
        "rag_top_k": int(kuaiai.get("rag_top_k") or 5),
        "stream_enabled": kuaiai.get("stream_enabled", True) is not False,
        "custom_system_prompt": kuaiai.get("custom_system_prompt") or "",
        "ocr_base_url": kuaiai.get("ocr_base_url") or "",
        "ocr_model": kuaiai.get("ocr_model") or "",
        "ocr_api_key": kuaiai.get("ocr_api_key"),
    }


async def migrate_llm_providers_to_connections(tenant_id: int, settings: Dict[str, Any]) -> bool:
    """
    将 integrations.{provider} 中的 API Key 迁入 IntegrationConfig 行，并清空站点密钥槽。
    就地修改 settings；返回是否变更（供落库）。
    """
    from core.models.integration_config import IntegrationConfig

    if not isinstance(settings, dict):
        return False
    integrations = settings.get("integrations")
    if not isinstance(integrations, dict):
        return False

    changed = promote_legacy_deepseek_into_kuaiai(integrations)
    kuaiai = integrations.get("kuaiai")
    if not isinstance(kuaiai, dict):
        kuaiai = {}
        integrations["kuaiai"] = kuaiai
        changed = True

    migrated_uuids: Dict[str, str] = {}
    for provider_id, spec in LLM_PROVIDER_SPECS.items():
        provider = integrations.get(provider_id)
        if not isinstance(provider, dict):
            continue
        code = f"{LLM_CONNECTION_CODE_PREFIX}{provider_id}"
        existing = await IntegrationConfig.filter(tenant_id=tenant_id, code=code).first()

        if is_llm_api_key_configured(provider):
            enabled = provider.get("enabled")
            is_active = True if enabled is None else enabled is True
            cfg = {
                "base_url": provider.get("base_url") or spec["default_base_url"],
                "model": provider.get("model") or spec["default_model"],
                "api_key": str(provider.get("api_key")).strip(),
            }
            if existing is None:
                existing = await IntegrationConfig.create(
                    tenant_id=tenant_id,
                    name=spec["name"],
                    code=code,
                    type=provider_id,
                    description="由站点 AI 密钥迁移",
                    config=cfg,
                    is_active=is_active,
                )
            else:
                # 含软删除行：恢复并写入密钥（一次性迁移）
                existing.name = existing.name or spec["name"]
                existing.type = provider_id
                existing.description = existing.description or "由站点 AI 密钥迁移"
                existing.config = {**(existing.config or {}), **cfg}
                existing.is_active = is_active
                existing.deleted_at = None
                await existing.save()
            migrated_uuids[provider_id] = str(existing.uuid)
            # 清空站点槽密钥，避免双源
            if provider.get("api_key"):
                provider["api_key"] = ""
                changed = True
            for key in ("base_url", "model", "enabled", "api_key_configured"):
                if key in provider:
                    del provider[key]
                    changed = True
        elif existing is not None and existing.deleted_at is None:
            migrated_uuids[provider_id] = str(existing.uuid)

    active_uuid = str(kuaiai.get("active_connection_uuid") or "").strip()
    if not active_uuid and migrated_uuids:
        active_provider = str(kuaiai.get("active_provider") or "deepseek").strip()
        if active_provider not in LLM_PROVIDER_SPECS:
            active_provider = "deepseek"
        picked = migrated_uuids.get(active_provider) or next(iter(migrated_uuids.values()))
        kuaiai["active_connection_uuid"] = picked
        for pid, uid in migrated_uuids.items():
            if uid == picked:
                kuaiai["active_provider"] = pid
                break
        changed = True

    return changed


def get_kuaiai_integration(settings: Dict[str, Any]) -> Dict[str, Any]:
    integrations = _integrations(settings)
    promote_legacy_deepseek_into_kuaiai(integrations)
    kuaiai = integrations.get("kuaiai")
    return kuaiai if isinstance(kuaiai, dict) else {}


def get_llm_provider_integration(settings: Dict[str, Any], provider_id: str) -> Dict[str, Any]:
    integrations = _integrations(settings)
    provider = integrations.get(provider_id)
    return provider if isinstance(provider, dict) else {}


def get_active_provider_id(settings: Dict[str, Any]) -> str:
    kuaiai = get_kuaiai_integration(settings)
    active = str(kuaiai.get("active_provider") or "deepseek").strip()
    if active not in LLM_PROVIDER_SPECS:
        return "deepseek"
    return active


def get_active_connection_uuid(settings: Dict[str, Any]) -> str:
    kuaiai = get_kuaiai_integration(settings)
    return str(kuaiai.get("active_connection_uuid") or "").strip()


def merge_llm_connection_with_kuaiai(
    kuaiai: Dict[str, Any],
    *,
    provider_id: str,
    connection_uuid: Optional[str],
    is_active: bool,
    config: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """连接行凭证 + kuaiai 能力合并视图。"""
    spec = LLM_PROVIDER_SPECS.get(provider_id, LLM_PROVIDER_SPECS["deepseek"])
    cfg = config if isinstance(config, dict) else {}
    return _merge_kuaiai_capabilities(
        kuaiai,
        provider=provider_id,
        connection_uuid=connection_uuid,
        enabled=is_active is True,
        api_key=cfg.get("api_key"),
        base_url=cfg.get("base_url") or spec["default_base_url"],
        model=cfg.get("model") or spec["default_model"],
    )


def get_active_llm_integration(settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    仅合并 kuaiai 能力 + 站点槽遗留字段（无 DB）。
    运行时请用 resolve_active_llm_integration(tenant_id)。
    """
    kuaiai = get_kuaiai_integration(settings)
    provider_id = get_active_provider_id(settings)
    provider = get_llm_provider_integration(settings, provider_id)
    spec = LLM_PROVIDER_SPECS.get(provider_id, LLM_PROVIDER_SPECS["deepseek"])
    return _merge_kuaiai_capabilities(
        kuaiai,
        provider=provider_id,
        connection_uuid=get_active_connection_uuid(settings) or None,
        enabled=provider.get("enabled") is True,
        api_key=provider.get("api_key"),
        base_url=provider.get("base_url") or spec["default_base_url"],
        model=provider.get("model") or spec["default_model"],
    )


async def resolve_active_llm_integration(tenant_id: int) -> Dict[str, Any]:
    """当前选用应用连接的密钥 + KU-AI 能力（运行时唯一路径）。"""
    from core.models.integration_config import IntegrationConfig
    from core.services.system.site_setting_service import SiteSettingService

    site_settings = await SiteSettingService.get_settings(tenant_id)
    settings = site_settings.settings or {}
    kuaiai = get_kuaiai_integration(settings)
    conn_uuid = str(kuaiai.get("active_connection_uuid") or "").strip()

    connection = None
    if conn_uuid:
        connection = await IntegrationConfig.filter(
            tenant_id=tenant_id,
            uuid=conn_uuid,
            deleted_at__isnull=True,
        ).first()

    if connection is None:
        provider_id = get_active_provider_id(settings)
        return merge_llm_connection_with_kuaiai(
            kuaiai,
            provider_id=provider_id,
            connection_uuid=None,
            is_active=False,
            config={},
        )

    provider_id = connection.type if connection.type in LLM_PROVIDER_SPECS else "deepseek"
    return merge_llm_connection_with_kuaiai(
        kuaiai,
        provider_id=provider_id,
        connection_uuid=str(connection.uuid),
        is_active=bool(connection.is_active),
        config=connection.get_config(),
    )


def get_deepseek_integration(settings: Dict[str, Any]) -> Dict[str, Any]:
    """兼容旧调用名：无 DB 的合并视图（勿用于运行时鉴权）。"""
    return get_active_llm_integration(settings)


def list_llm_provider_statuses(settings: Dict[str, Any]) -> List[Dict[str, Any]]:
    """内置提供商默认值列表（密钥已迁入连接行后 api_key_configured 多为 False）。"""
    active = get_active_provider_id(settings)
    items: List[Dict[str, Any]] = []
    for provider_id, spec in LLM_PROVIDER_SPECS.items():
        provider = get_llm_provider_integration(settings, provider_id)
        items.append(
            {
                "id": provider_id,
                "name": spec["name"],
                "default_base_url": spec["default_base_url"],
                "default_model": spec["default_model"],
                "enabled": provider.get("enabled") is True,
                "api_key_configured": is_llm_api_key_configured(provider),
                "base_url": provider.get("base_url") or spec["default_base_url"],
                "model": provider.get("model") or spec["default_model"],
                "active": provider_id == active,
            }
        )
    return items


def build_deepseek_public_status_from_active(active: Dict[str, Any]) -> Dict[str, Any]:
    """由已解析的 active LLM 视图生成公开状态。"""
    configured = is_llm_api_key_configured(active)
    enabled = bool(active.get("enabled"))
    model = active.get("model") or DEEPSEEK_DEFAULT_MODEL
    return {
        "configured": configured,
        "enabled": enabled and configured,
        "model": model,
        "provider": active.get("provider") or "deepseek",
        "connection_uuid": active.get("connection_uuid"),
        "rag_backend": normalize_rag_backend(active.get("rag_backend")),
    }


def build_deepseek_public_status(settings: Dict[str, Any]) -> Dict[str, Any]:
    """无 DB 回退（仅站点槽）；优先使用 build_deepseek_public_status_for_tenant。"""
    return build_deepseek_public_status_from_active(get_active_llm_integration(settings))


async def build_deepseek_public_status_for_tenant(tenant_id: int) -> Dict[str, Any]:
    active = await resolve_active_llm_integration(tenant_id)
    return build_deepseek_public_status_from_active(active)


def mask_integrations_for_response(settings: Dict[str, Any]) -> Dict[str, Any]:
    """GET 站点设置时对 integrations 脱敏，不返回明文 API Key。"""
    if not settings or "integrations" not in settings:
        return settings

    result = deepcopy(settings)
    integrations = result.get("integrations")
    if not isinstance(integrations, dict):
        return result

    promote_legacy_deepseek_into_kuaiai(integrations)

    # 先在清空密钥前计算 configured 标志，避免二次判断时 api_key 已被置空
    provider_configured: Dict[str, bool] = {}
    for provider_id in LLM_PROVIDER_IDS:
        provider = integrations.get(provider_id)
        if isinstance(provider, dict):
            provider_configured[provider_id] = is_llm_api_key_configured(provider)

    kuaiai = integrations.get("kuaiai") if isinstance(integrations.get("kuaiai"), dict) else {}
    # OCR 专用 Key 仅看 kuaiai；对话 Key 已迁入连接行，站点响应不再用提供商槽推断
    ocr_key_configured = is_ocr_api_key_configured(kuaiai, {})
    ocr_endpoint_configured = is_ocr_endpoint_configured(kuaiai)
    deepseek_ocr_key_configured = ocr_key_configured
    deepseek_ocr_configured = ocr_endpoint_configured

    for provider_id in LLM_PROVIDER_IDS:
        provider = integrations.get(provider_id)
        if isinstance(provider, dict):
            provider["api_key_configured"] = provider_configured.get(provider_id, False)
            provider["api_key"] = ""

    if isinstance(integrations.get("kuaiai"), dict):
        kuaiai = integrations["kuaiai"]
        kuaiai["ocr_api_key_configured"] = ocr_key_configured
        kuaiai["ocr_api_key"] = ""
        kuaiai["ocr_configured"] = ocr_endpoint_configured

    deepseek = integrations.get("deepseek")
    if isinstance(deepseek, dict):
        deepseek["api_key_configured"] = provider_configured.get("deepseek", False)
        deepseek["api_key"] = ""
        deepseek["ocr_api_key_configured"] = deepseek_ocr_key_configured
        deepseek["ocr_api_key"] = ""
        deepseek["ocr_configured"] = deepseek_ocr_configured

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
        for key_name in ("api_key", "ocr_api_key"):
            incoming_key = incoming_provider.get(key_name)
            if _is_blank(incoming_key) or _is_masked_api_key(incoming_key):
                if current_provider.get(key_name):
                    next_provider[key_name] = current_provider[key_name]
                else:
                    next_provider.pop(key_name, None)

        merged[provider] = next_provider

    return merged
