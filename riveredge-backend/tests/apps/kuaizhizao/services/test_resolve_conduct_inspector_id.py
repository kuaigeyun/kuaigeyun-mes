"""Tests for quality inspection conduct inspector resolution."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaizhizao.services.quality_service import _resolve_conduct_inspector_id


@pytest.mark.asyncio
async def test_resolve_conduct_inspector_id_prefers_numeric_id():
    resolved = await _resolve_conduct_inspector_id(1, {"inspector_id": 42}, 99)
    assert resolved == 42


@pytest.mark.asyncio
async def test_resolve_conduct_inspector_id_resolves_uuid():
    with patch(
        "infra.models.user.User.get_or_none",
        new_callable=AsyncMock,
        return_value=SimpleNamespace(id=7),
    ) as mock_get:
        resolved = await _resolve_conduct_inspector_id(
            1,
            {"inspector_uuid": "user-uuid-1"},
            99,
        )
    assert resolved == 7
    mock_get.assert_awaited_once_with(tenant_id=1, uuid="user-uuid-1")


@pytest.mark.asyncio
async def test_resolve_conduct_inspector_id_falls_back_to_operator():
    resolved = await _resolve_conduct_inspector_id(1, {}, 99)
    assert resolved == 99
