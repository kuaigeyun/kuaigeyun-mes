"""菜单徽章 COUNT 须走 DataScopeService（与列表 data_scope_key 对齐）。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaizhizao.services.menu_badge_scope import BadgeScopeCtx, badge_count


@pytest.mark.asyncio
async def test_badge_count_applies_data_scope_when_resource_set():
    user = SimpleNamespace(id=42)
    ctx = BadgeScopeCtx(tenant_id=1, user=user)
    base_qs = AsyncMock()
    scoped_qs = AsyncMock()
    scoped_qs.count = AsyncMock(return_value=3)
    apply_mock = AsyncMock(return_value=scoped_qs)

    with patch(
        "apps.kuaizhizao.services.menu_badge_scope.DataScopeService.apply",
        apply_mock,
    ):
        total = await badge_count(base_qs, ctx, "kuaizhizao:sales-order")

    assert total == 3
    apply_mock.assert_awaited_once_with(
        base_qs,
        tenant_id=1,
        user=user,
        resource="kuaizhizao:sales-order",
    )
    scoped_qs.count.assert_awaited_once()


@pytest.mark.asyncio
async def test_badge_count_skips_scope_when_resource_none():
    user = SimpleNamespace(id=7)
    ctx = BadgeScopeCtx(tenant_id=2, user=user)
    qs = AsyncMock()
    qs.count = AsyncMock(return_value=5)

    with patch(
        "apps.kuaizhizao.services.menu_badge_scope.DataScopeService.apply",
        AsyncMock(),
    ) as apply_mock:
        total = await badge_count(qs, ctx, None)

    assert total == 5
    apply_mock.assert_not_awaited()
    qs.count.assert_awaited_once()
