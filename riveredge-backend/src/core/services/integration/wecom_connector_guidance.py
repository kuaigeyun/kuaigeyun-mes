"""企业微信连接器：部署说明 URL 与跨租户 Agent 唯一性校验。"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from core.models.integration_config import IntegrationConfig
from core.services.client_release_service import build_public_origin
from infra.exceptions.exceptions import ValidationError
from infra.models.tenant import Tenant


def _parse_wecom_agent_id(config: dict[str, Any] | None) -> int | None:
    if not isinstance(config, dict):
        return None
    raw = config.get("agent_id")
    if raw is None or str(raw).strip() == "":
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _normalize_corp_id(config: dict[str, Any] | None) -> str:
    if not isinstance(config, dict):
        return ""
    return str(config.get("corp_id") or "").strip()


async def assert_wecom_corp_agent_unique_across_tenants(
    *,
    tenant_id: int,
    config: dict[str, Any] | None,
    exclude_integration_uuid: str | None = None,
) -> None:
    """
    启用态下 (corp_id, agent_id) 不得被其他租户占用。
    同一租户内多条 wecom 连接仍由业务侧自行管理；仅拦截跨租户冲突。
    """
    corp_id = _normalize_corp_id(config)
    agent_id = _parse_wecom_agent_id(config)
    if not corp_id or agent_id is None:
        return

    rows = await IntegrationConfig.filter(
        type="wecom",
        is_active=True,
        deleted_at__isnull=True,
    ).all()
    for row in rows:
        if int(row.tenant_id) == int(tenant_id):
            continue
        if exclude_integration_uuid and str(row.uuid) == str(exclude_integration_uuid):
            continue
        other_corp = _normalize_corp_id(row.config if isinstance(row.config, dict) else {})
        other_agent = _parse_wecom_agent_id(row.config if isinstance(row.config, dict) else {})
        if other_corp == corp_id and other_agent == agent_id:
            raise ValidationError(
                f"企业微信 CorpID 与 AgentId 已被其他组织占用（组织 ID {row.tenant_id}），"
                "请为每个组织使用独立自建应用或不同 AgentId"
            )


async def build_wecom_deployment_guide(
    *,
    tenant_id: int,
    request_base_url: str | None,
    corp_id: str | None = None,
    agent_id: int | None = None,
) -> dict[str, Any]:
    """生成企微管理后台对照用的 URL 说明（不含密钥）。"""
    origin = build_public_origin(request_base_url).rstrip("/")
    if not origin and request_base_url:
        origin = str(request_base_url).rstrip("/")

    tenant = await Tenant.get_or_none(id=tenant_id)
    tenant_domain = (tenant.domain or "").strip().lower() if tenant else ""

    oauth_callback = f"{origin}/login?provider=wecom_work" if origin else ""
    tenant_entry = f"{origin}/{tenant_domain}" if origin and tenant_domain else ""
    login_with_agent = ""
    if origin and corp_id and agent_id is not None:
        login_with_agent = (
            f"{origin}/login?provider=wecom_work&corp_id={quote(corp_id)}"
            f"&agent_id={agent_id}"
        )

    trusted_host = ""
    if origin:
        from urllib.parse import urlparse

        parsed = urlparse(origin)
        trusted_host = parsed.hostname or ""

    return {
        "origin": origin,
        "tenant_domain": tenant_domain,
        "oauth_callback_url": oauth_callback,
        "workbench_home_url": tenant_entry,
        "login_with_agent_url": login_with_agent,
        "trusted_domain": trusted_host,
    }
