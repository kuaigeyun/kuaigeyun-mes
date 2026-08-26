"""成品检验客户快照：从销售订单解析客户名称。"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.kuaizhizao.services.quality_service import _resolve_fqc_customer_snapshot


@pytest.mark.asyncio
async def test_resolve_fqc_customer_snapshot_returns_existing_name():
    customer_id, customer_name = await _resolve_fqc_customer_snapshot(
        1,
        sales_order_id=99,
        customer_id=10,
        customer_name="  山东才俊化学  ",
    )
    assert customer_id == 10
    assert customer_name == "山东才俊化学"


@pytest.mark.asyncio
async def test_resolve_fqc_customer_snapshot_from_sales_order():
    so = MagicMock()
    so.customer_id = 42
    so.customer_name = "山东才俊化学"

    with patch(
        "apps.kuaizhizao.models.sales_order.SalesOrder.get_or_none",
        new=AsyncMock(return_value=so),
    ):
        customer_id, customer_name = await _resolve_fqc_customer_snapshot(
            1,
            sales_order_id=99,
        )

    assert customer_id == 42
    assert customer_name == "山东才俊化学"


@pytest.mark.asyncio
async def test_resolve_fqc_customer_snapshot_without_sales_order():
    customer_id, customer_name = await _resolve_fqc_customer_snapshot(
        1,
        sales_order_id=None,
    )
    assert customer_id is None
    assert customer_name is None
