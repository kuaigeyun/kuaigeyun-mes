"""企微 CorpId + AgentId 反查租户。"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.integration.wecom_tenant_resolve import resolve_tenant_by_wecom_corp_agent


@pytest.mark.asyncio
async def test_resolve_unique_match():
    row = MagicMock()
    row.tenant_id = 7
    row.config = {"corp_id": "wwabc", "agent_id": 10001}
    row.type = "wecom"
    row.is_active = True

    tenant = MagicMock()
    tenant.domain = "factory-a"

    with patch(
        "core.services.integration.wecom_tenant_resolve.IntegrationConfig.filter",
    ) as filt, patch(
        "core.services.integration.wecom_tenant_resolve.Tenant.get_or_none",
        new_callable=AsyncMock,
        return_value=tenant,
    ):
        filt.return_value.all = AsyncMock(return_value=[row])
        result = await resolve_tenant_by_wecom_corp_agent(corp_id="wwabc", agent_id=10001)

    assert result is not None
    assert result.tenant_id == 7
    assert result.tenant_domain == "factory-a"


@pytest.mark.asyncio
async def test_resolve_ambiguous_returns_none():
    rows = [
        MagicMock(tenant_id=1, config={"corp_id": "wwabc", "agent_id": 10001}),
        MagicMock(tenant_id=2, config={"corp_id": "wwabc", "agent_id": 10001}),
    ]
    with patch(
        "core.services.integration.wecom_tenant_resolve.IntegrationConfig.filter",
    ) as filt:
        filt.return_value.all = AsyncMock(return_value=rows)
        result = await resolve_tenant_by_wecom_corp_agent(corp_id="wwabc", agent_id=10001)

    assert result is None
