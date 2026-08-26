"""销售端子单列表须按源销售订单数据权限过滤。"""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from infra.models.user import User

from apps.kuaizhizao.services.kuaizhizao_data_scope import (
    SALES_ORDER_SCOPE_RESOURCE,
    apply_sales_order_child_list_scope,
)
from apps.kuaizhizao.services.sales_order_change_service import SalesOrderChangeService


class TestSalesSideDataScope(unittest.IsolatedAsyncioTestCase):
    async def test_list_change_orders_applies_parent_order_scope(self):
        user = User(id=5, tenant_id=1, username="sales5", full_name="销售五")
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count = AsyncMock(return_value=0)
        mock_query.order_by.return_value.offset.return_value.limit = AsyncMock(return_value=[])

        with patch(
            "apps.kuaizhizao.services.sales_order_change_service.SalesOrderChangeOrder.filter",
            return_value=mock_query,
        ):
            with patch(
                "apps.kuaizhizao.services.sales_order_change_service.apply_sales_order_child_list_scope",
                new_callable=AsyncMock,
                return_value=mock_query,
            ) as mock_scope:
                await SalesOrderChangeService().list_change_orders(
                    tenant_id=1,
                    current_user=user,
                )
                mock_scope.assert_awaited_once()
                self.assertEqual(
                    mock_scope.await_args.kwargs["order_id_field"],
                    "source_order_id",
                )

    async def test_apply_sales_order_child_list_scope_delegates_to_sales_order(self):
        user = User(id=5, tenant_id=1, username="sales5", full_name="销售五")
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query

        with patch(
            "apps.kuaizhizao.models.sales_order.SalesOrder.filter",
            return_value=MagicMock(),
        ):
            with patch(
                "apps.kuaizhizao.services.kuaizhizao_data_scope.DataScopeService.apply",
                new_callable=AsyncMock,
                return_value=MagicMock(values_list=AsyncMock(return_value=[1, 2])),
            ) as mock_apply:
                await apply_sales_order_child_list_scope(
                    mock_query,
                    tenant_id=1,
                    current_user=user,
                    order_id_field="sales_order_id",
                )
                mock_apply.assert_awaited_once()
                self.assertEqual(
                    mock_apply.await_args.kwargs["resource"],
                    SALES_ORDER_SCOPE_RESOURCE,
                )


if __name__ == "__main__":
    unittest.main()
