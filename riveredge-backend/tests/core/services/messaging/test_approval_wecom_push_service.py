"""审批消息企微推送配置解析与链接变量。"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.messaging import approval_wecom_push_service as svc


@pytest.mark.asyncio
async def test_resolve_prefers_default_wecom_push():
    wecom_default = MagicMock()
    wecom_default.config = {"provider": "wecom"}

    with patch.object(
        svc.MessageConfigService,
        "get_default_config",
        new=AsyncMock(return_value=wecom_default),
    ):
        hit = await svc.resolve_active_wecom_push_config(1)
    assert hit is wecom_default


@pytest.mark.asyncio
async def test_ensure_approval_document_url_from_detail_path():
    variables: dict = {"detail_path": "/personal/tasks?highlight=9"}
    tenant = MagicMock()
    tenant.domain = "default"

    settings = MagicMock()
    settings.BASE_URL = "https://erp.example.com:16666"
    with patch.object(svc, "infra_settings", settings):
        with patch.object(svc.Tenant, "get_or_none", new=AsyncMock(return_value=tenant)):
            await svc.ensure_approval_document_url(1, variables)

    assert (
        variables["document_url"]
        == "https://erp.example.com:16666/default?redirect=/personal/tasks%3Fhighlight%3D9"
    )
