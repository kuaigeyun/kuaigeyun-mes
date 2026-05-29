"""菜单接管：禁用时归还 source 应用菜单"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from core.config.menu_takeover import META_SUPPRESSED_BY_TAKEOVER
from core.services.system.menu_takeover_service import MenuTakeoverService


class _FakeMenu:
    def __init__(self, *, path: str, is_active: bool, meta: dict | None = None):
        self.path = path
        self.is_active = is_active
        self.meta = meta
        self.saved_fields: list[str] | None = None

    async def save(self, update_fields=None):
        self.saved_fields = update_fields


@pytest.mark.asyncio
async def test_revert_takeover_restores_suppressed_master_data_process_menus():
    suppressed = _FakeMenu(
        path="/apps/master-data/process/drawings",
        is_active=False,
        meta={META_SUPPRESSED_BY_TAKEOVER: "kuaiplm"},
    )
    unrelated = _FakeMenu(
        path="/apps/master-data/materials",
        is_active=False,
        meta=None,
    )

    class _FakeQuery:
        async def all(self):
            return [suppressed, unrelated]

    with patch.object(
        MenuTakeoverService,
        "_get_app_uuid",
        new=AsyncMock(return_value="master-data-uuid"),
    ), patch(
        "core.services.system.menu_takeover_service.Menu.filter",
        return_value=_FakeQuery(),
    ):
        restored = await MenuTakeoverService.revert_takeover(tenant_id=1, consumer_app_code="kuaiplm")

    assert restored == 1
    assert suppressed.is_active is True
    assert META_SUPPRESSED_BY_TAKEOVER not in (suppressed.meta or {})
    assert unrelated.is_active is False


@pytest.mark.asyncio
async def test_sync_for_application_lifecycle_disable_calls_revert():
    with patch.object(
        MenuTakeoverService,
        "revert_takeover",
        new=AsyncMock(return_value=2),
    ) as revert_mock, patch(
        "core.services.system.menu_service.MenuService._clear_menu_cache",
        new=AsyncMock(),
    ):
        await MenuTakeoverService.sync_for_application_lifecycle(
            tenant_id=9, app_code="kuaiplm", enabled=False
        )

    revert_mock.assert_awaited_once_with(9, "kuaiplm")
