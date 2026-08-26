"""质检关联单据只读放行。"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from apps.kuaizhizao.services.kuaizhizao_data_scope import (
    allow_sales_order_detail_quality_linked_read,
    allow_work_order_detail_quality_linked_read,
)


@pytest.mark.asyncio
async def test_allow_sales_order_detail_when_linked_and_quality_read():
    with (
        patch(
            "apps.kuaizhizao.services.kuaizhizao_data_scope._sales_order_linked_from_quality_inspection",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "core.services.authorization.user_permission_service.UserPermissionService.has_any_permission",
            new=AsyncMock(return_value=True),
        ),
    ):
        allowed = await allow_sales_order_detail_quality_linked_read(1, 99, 318)
    assert allowed is True


@pytest.mark.asyncio
async def test_deny_sales_order_detail_when_not_linked():
    with patch(
        "apps.kuaizhizao.services.kuaizhizao_data_scope._sales_order_linked_from_quality_inspection",
        new=AsyncMock(return_value=False),
    ):
        allowed = await allow_sales_order_detail_quality_linked_read(1, 99, 318)
    assert allowed is False


@pytest.mark.asyncio
async def test_allow_work_order_detail_when_linked_and_quality_read():
    with (
        patch(
            "apps.kuaizhizao.services.kuaizhizao_data_scope._work_order_linked_from_quality_inspection",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "core.services.authorization.user_permission_service.UserPermissionService.has_any_permission",
            new=AsyncMock(return_value=True),
        ),
    ):
        allowed = await allow_work_order_detail_quality_linked_read(1, 99, 42)
    assert allowed is True


@pytest.mark.asyncio
async def test_deny_work_order_detail_without_quality_read():
    with (
        patch(
            "apps.kuaizhizao.services.kuaizhizao_data_scope._work_order_linked_from_quality_inspection",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "core.services.authorization.user_permission_service.UserPermissionService.has_any_permission",
            new=AsyncMock(return_value=False),
        ),
    ):
        allowed = await allow_work_order_detail_quality_linked_read(1, 99, 42)
    assert allowed is False
