"""销售订单关联质检只读可见性。"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from apps.kuaizhizao.services.kuaizhizao_data_scope import (
    assert_sales_order_row_visible_or_quality_linked,
)


@pytest.mark.asyncio
async def test_sales_order_visible_when_row_in_data_scope():
    order = SimpleNamespace(id=318)
    user = SimpleNamespace(id=99)
    with patch(
        "apps.kuaizhizao.services.kuaizhizao_data_scope.DataScopeService.row_visible",
        new=AsyncMock(return_value=True),
    ):
        await assert_sales_order_row_visible_or_quality_linked(
            order,
            tenant_id=1,
            user=user,  # type: ignore[arg-type]
        )


@pytest.mark.asyncio
async def test_sales_order_visible_when_linked_fqc_and_quality_read():
    order = SimpleNamespace(id=318)
    user = SimpleNamespace(id=99)
    with (
        patch(
            "apps.kuaizhizao.services.kuaizhizao_data_scope.DataScopeService.row_visible",
            new=AsyncMock(return_value=False),
        ),
        patch(
            "apps.kuaizhizao.services.kuaizhizao_data_scope._sales_order_linked_from_quality_inspection",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "core.services.authorization.user_permission_service.UserPermissionService.has_any_permission",
            new=AsyncMock(return_value=True),
        ),
    ):
        await assert_sales_order_row_visible_or_quality_linked(
            order,
            tenant_id=1,
            user=user,  # type: ignore[arg-type]
        )


@pytest.mark.asyncio
async def test_sales_order_denied_when_not_linked_and_out_of_scope():
    order = SimpleNamespace(id=318)
    user = SimpleNamespace(id=99)
    with (
        patch(
            "apps.kuaizhizao.services.kuaizhizao_data_scope.DataScopeService.row_visible",
            new=AsyncMock(return_value=False),
        ),
        patch(
            "apps.kuaizhizao.services.kuaizhizao_data_scope._sales_order_linked_from_quality_inspection",
            new=AsyncMock(return_value=False),
        ),
        patch(
            "apps.kuaizhizao.services.kuaizhizao_data_scope.DataScopeService.assert_row_visible",
            new=AsyncMock(
                side_effect=HTTPException(status_code=403, detail={"message": "权限不足"}),
            ),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await assert_sales_order_row_visible_or_quality_linked(
                order,
                tenant_id=1,
                user=user,  # type: ignore[arg-type]
            )
        assert exc.value.status_code == 403
