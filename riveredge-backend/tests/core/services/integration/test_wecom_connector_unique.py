"""企微连接器跨租户 CorpId + AgentId 唯一性。"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.integration.wecom_connector_guidance import (
    assert_wecom_corp_agent_unique_across_tenants,
)
from infra.exceptions.exceptions import ValidationError


@pytest.mark.asyncio
async def test_rejects_duplicate_across_tenants():
    other = MagicMock()
    other.tenant_id = 99
    other.uuid = "other-uuid"
    other.config = {"corp_id": "wwabc", "agent_id": 10001}

    with patch(
        "core.services.integration.wecom_connector_guidance.IntegrationConfig.filter",
    ) as filt:
        filt.return_value.all = AsyncMock(return_value=[other])
        with pytest.raises(ValidationError) as exc:
            await assert_wecom_corp_agent_unique_across_tenants(
                tenant_id=1,
                config={"corp_id": "wwabc", "agent_id": 10001},
            )
    assert "其他组织" in str(exc.value)


@pytest.mark.asyncio
async def test_allows_same_tenant_row():
    with patch(
        "core.services.integration.wecom_connector_guidance.IntegrationConfig.filter",
    ) as filt:
        filt.return_value.all = AsyncMock(return_value=[])
        await assert_wecom_corp_agent_unique_across_tenants(
            tenant_id=1,
            config={"corp_id": "wwabc", "agent_id": 10001},
        )
