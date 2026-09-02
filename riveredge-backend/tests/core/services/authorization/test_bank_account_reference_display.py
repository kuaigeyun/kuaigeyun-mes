"""销售/采购建单引用银行账户隐式 display 鉴权。"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from core.services.authorization.access_control_service import AccessControlService


@pytest.mark.asyncio
async def test_bank_account_display_allowed_with_sales_order_create():
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
    assert decision.allowed is True
    assert decision.reason == "implicit_host_grant"


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
