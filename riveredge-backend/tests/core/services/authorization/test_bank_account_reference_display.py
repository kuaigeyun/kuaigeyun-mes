"""银行账户引用回显：须显式 read/display，不再宿主隐式放行。"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from core.services.authorization.access_control_service import AccessControlService


@pytest.mark.asyncio
async def test_bank_account_display_allowed_with_explicit_display():
    with patch(
        "core.services.authorization.access_control_service.UserPermissionService.is_admin_bypass_flags",
        new=AsyncMock(return_value=False),
    ), patch(
        "core.services.authorization.access_control_service.UserPermissionService.get_user_permissions",
        new=AsyncMock(return_value={"kuaicaiwu:bank-account:display"}),
    ):
        decision = await AccessControlService.check_reference_display(
            user_id=1,
            tenant_id=1,
            resource_key="kuaicaiwu:bank-account",
            host_resource="kuaizhizao:sales-order",
        )
    assert decision.allowed is True
    assert decision.reason == "explicit_read_or_display"


@pytest.mark.asyncio
async def test_bank_account_display_denied_with_only_host_create():
    with patch(
        "core.services.authorization.access_control_service.UserPermissionService.is_admin_bypass_flags",
        new=AsyncMock(return_value=False),
    ), patch(
        "core.services.authorization.access_control_service.UserPermissionService.get_user_permissions",
        new=AsyncMock(return_value={"kuaizhizao:sales-order:create"}),
    ):
        decision = await AccessControlService.check_reference_display(
            user_id=1,
            tenant_id=1,
            resource_key="kuaicaiwu:bank-account",
            host_resource="kuaizhizao:sales-order",
        )
    assert decision.allowed is False
    assert decision.reason == "reference_display_denied"


@pytest.mark.asyncio
async def test_bank_account_display_denied_without_host_or_module_perm():
    with patch(
        "core.services.authorization.access_control_service.UserPermissionService.is_admin_bypass_flags",
        new=AsyncMock(return_value=False),
    ), patch(
        "core.services.authorization.access_control_service.UserPermissionService.get_user_permissions",
        new=AsyncMock(return_value=set()),
    ):
        decision = await AccessControlService.check_reference_display(
            user_id=1,
            tenant_id=1,
            resource_key="kuaicaiwu:bank-account",
            host_resource="kuaizhizao:sales-order",
        )
    assert decision.allowed is False
    assert decision.reason == "reference_display_denied"
