"""企业微信 CorpId + AgentId 反查 RiverEdge 租户（唯一命中才返回）。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from core.models.integration_config import IntegrationConfig
from core.services.integration.wecom_connector_guidance import (
    _normalize_corp_id,
    _parse_wecom_agent_id,
)
from infra.models.tenant import Tenant


@dataclass(frozen=True)
class WeComTenantResolveResult:
    tenant_id: int
    tenant_domain: str
    candidates_count: int = 1


async def resolve_tenant_by_wecom_corp_agent(
    *,
    corp_id: str,
    agent_id: int,
) -> WeComTenantResolveResult | None:
    corp = (corp_id or "").strip()
    if not corp:
        return None

    rows = await IntegrationConfig.filter(
        type="wecom",
        is_active=True,
        deleted_at__isnull=True,
    ).all()

    matched_tenant_ids: list[int] = []
    for row in rows:
        cfg = row.config if isinstance(row.config, dict) else {}
        if _normalize_corp_id(cfg) != corp:
            continue
        parsed_agent = _parse_wecom_agent_id(cfg)
        if parsed_agent != agent_id:
            continue
        matched_tenant_ids.append(int(row.tenant_id))

    unique_ids = sorted(set(matched_tenant_ids))
    if len(unique_ids) != 1:
        return None

    tid = unique_ids[0]
    tenant = await Tenant.get_or_none(id=tid)
    domain = (tenant.domain or "").strip() if tenant else ""
    return WeComTenantResolveResult(tenant_id=tid, tenant_domain=domain, candidates_count=1)


async def list_wecom_enabled_tenant_ids() -> list[int]:
    rows = await IntegrationConfig.filter(
        type="wecom",
        is_active=True,
        deleted_at__isnull=True,
    ).all()
    ids: list[int] = []
    seen: set[int] = set()
    for row in rows:
        cfg = row.config if isinstance(row.config, dict) else {}
        if not _normalize_corp_id(cfg) or _parse_wecom_agent_id(cfg) is None:
            continue
        tid = int(row.tenant_id)
        if tid in seen:
            continue
        seen.add(tid)
        ids.append(tid)
    return ids
