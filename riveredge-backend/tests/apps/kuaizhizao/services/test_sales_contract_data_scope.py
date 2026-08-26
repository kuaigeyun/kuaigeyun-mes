"""销售合同列表须走 DataScopeService（与报价/销售订单一致）。"""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from infra.models.user import User

from apps.kuaizhizao.services.sales_contract_service import (
    SALES_CONTRACT_DATA_SCOPE_RESOURCE,
    SalesContractService,
)


class TestSalesContractDataScope(unittest.IsolatedAsyncioTestCase):
    async def test_list_contracts_applies_data_scope(self):
        user = User(id=5, tenant_id=1, username="sales5", full_name="销售五")
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count = AsyncMock(return_value=0)
        mock_query.order_by.return_value.offset.return_value.limit = AsyncMock(return_value=[])

        with patch(
            "apps.kuaizhizao.services.sales_contract_service.SalesContract.filter",
            return_value=mock_query,
        ):
            with patch(
                "apps.kuaizhizao.services.sales_contract_service.DataScopeService.apply",
                new_callable=AsyncMock,
                return_value=mock_query,
            ) as mock_apply:
                await SalesContractService().list_contracts(
                    tenant_id=1,
                    current_user=user,
                )
                mock_apply.assert_awaited_once()
                self.assertEqual(
                    mock_apply.await_args.kwargs["resource"],
                    SALES_CONTRACT_DATA_SCOPE_RESOURCE,
                )


if __name__ == "__main__":
    unittest.main()
