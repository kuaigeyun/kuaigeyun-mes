"""客户池归属变更与主数据写入收口 — 单元测试（mock ORM）。"""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from tortoise.expressions import Q

from apps.kuaizhizao.services.customer_pool_service import CustomerPoolService
from apps.master_data.schemas.supply_chain_schemas import CustomerUpdate
from apps.master_data.services import supply_chain_service as scs
from apps.master_data.services.supply_chain_service import SupplyChainService
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User


class _FakeCustomer:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", 1)
        self.uuid = kwargs.get("uuid", "cust-uuid")
        self.tenant_id = kwargs.get("tenant_id", 1)
        self.salesman_id = kwargs.get("salesman_id")
        self.salesman_name = kwargs.get("salesman_name")
        self.pool_status = kwargs.get("pool_status", "pool")
        self.assigned_at = kwargs.get("assigned_at")
        self.recycle_at = kwargs.get("recycle_at")
        self.last_follow_up_at = kwargs.get("last_follow_up_at")

    async def save(self):
        return None


class CustomerPoolOwnershipTests(unittest.IsolatedAsyncioTestCase):
    async def test_apply_assign_enforces_target_capacity(self):
        customer = _FakeCustomer(id=10, pool_status="pool")
        target = User(id=2, tenant_id=1, username="sales2", full_name="销售二")
        operator = User(id=1, tenant_id=1, username="admin", full_name="管理员")
        operator.is_tenant_admin = True

        rule = MagicMock()
        rule.max_owned_customers = 1
        rule.recycle_enabled = False

        with patch.object(CustomerPoolService, "_get_rule", AsyncMock(return_value=rule)):
            with patch(
                "apps.kuaizhizao.services.customer_pool_service.Customer.filter"
            ) as mock_filter:
                mock_filter.return_value.exclude.return_value.count = AsyncMock(return_value=1)
                with self.assertRaises(ValidationError):
                    await CustomerPoolService.apply_assign(
                        tenant_id=1,
                        customer=customer,
                        target_user=target,
                        operator=operator,
                    )

    async def test_apply_release_clears_owned_state(self):
        customer = _FakeCustomer(
            id=11,
            salesman_id=3,
            salesman_name="张三",
            pool_status="owned",
            assigned_at="2026-01-01T00:00:00Z",
            recycle_at="2026-01-16T00:00:00Z",
        )
        operator = User(id=3, tenant_id=1, username="sales3", full_name="张三")
        operator.is_regular_user = MagicMock(return_value=False)

        with patch.object(CustomerPoolService, "_write_log", AsyncMock()):
            with patch.object(CustomerPoolService, "_clear_collaborators", AsyncMock()) as mock_clear:
                result = await CustomerPoolService.apply_release(
                    tenant_id=1,
                    customer=customer,
                    operator=operator,
                    skip_own_check=True,
                )

        mock_clear.assert_awaited_once()
        self.assertIsNone(result.salesman_id)
        self.assertEqual(result.pool_status, "pool")
        self.assertIsNone(result.recycle_at)

    def test_strip_customer_pool_managed_fields(self):
        payload = {
            "name": "客户A",
            "pool_status": "owned",
            "assigned_at": "x",
            "recycle_at": "y",
            "is_public": True,
            "salesman_name": "不应写入",
        }
        scs._strip_customer_pool_managed_fields(payload)
        self.assertEqual(payload, {"name": "客户A"})

    async def test_update_customer_delegates_assign_to_pool_service(self):
        customer = _FakeCustomer(
            id=1,
            uuid="cust-uuid",
            salesman_id=None,
            pool_status="pool",
        )
        customer.code = "C001"
        customer.name = "客户A"
        admin = User(id=1, tenant_id=1, username="admin", full_name="管理员")
        admin.is_tenant_admin = True
        target = User(id=2, tenant_id=1, username="sales2", full_name="销售二")
        assigned = _FakeCustomer(
            id=1,
            uuid="cust-uuid",
            salesman_id=2,
            salesman_name="销售二",
            pool_status="owned",
        )
        assigned.code = "C001"
        assigned.name = "客户A"

        with patch(
            "apps.master_data.services.supply_chain_service.Customer.filter"
        ) as mock_customer_filter:
            mock_customer_filter.return_value.first = AsyncMock(return_value=customer)
            with patch(
                "apps.master_data.services.supply_chain_service.User.filter"
            ) as mock_user_filter:
                mock_user_filter.return_value.first = AsyncMock(return_value=target)
                with patch.object(
                    CustomerPoolService,
                    "apply_assign",
                    AsyncMock(return_value=assigned),
                ) as mock_assign:
                    with patch.object(
                        scs,
                        "_to_customer_response",
                        side_effect=lambda c: c,
                    ):
                        result = await SupplyChainService.update_customer(
                            tenant_id=1,
                            customer_uuid="cust-uuid",
                            data=CustomerUpdate(salesmanId=2),
                            current_user=admin,
                        )

        mock_assign.assert_awaited_once()
        call_kwargs = mock_assign.await_args.kwargs
        self.assertEqual(call_kwargs["reason"], "master-data update")
        self.assertEqual(call_kwargs["target_user"].id, 2)
        self.assertEqual(result.salesman_id, 2)

    async def test_list_customers_regular_user_sees_own_and_pool_only(self):
        user = User(id=5, tenant_id=1, username="sales5", full_name="销售五")

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count = AsyncMock(return_value=0)
        mock_query.offset.return_value.limit.return_value.order_by.return_value.all = AsyncMock(
            return_value=[]
        )

        with patch(
            "apps.master_data.services.supply_chain_service.Customer.filter",
            return_value=mock_query,
        ):
            with patch(
                "apps.master_data.services.supply_chain_service.DataScopeService.apply",
                new_callable=AsyncMock,
                return_value=mock_query,
            ) as mock_apply:
                await SupplyChainService.list_customers(tenant_id=1, current_user=user)
                mock_apply.assert_awaited_once()
                self.assertEqual(
                    mock_apply.await_args.kwargs["resource"],
                    "master-data:supply-chain:customer",
                )


    async def test_list_customer_pool_mine_includes_owned_and_collaborators(self):
        user = User(id=5, tenant_id=1, username="sales5", full_name="销售五")
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count = AsyncMock(return_value=0)
        mock_query.order_by.return_value.offset.return_value.limit = AsyncMock(return_value=[])

        with patch(
            "apps.kuaizhizao.services.customer_pool_service.list_collaborator_customer_ids",
            AsyncMock(return_value=[88, 89]),
        ):
            with patch(
                "apps.kuaizhizao.services.customer_pool_service.Customer.filter",
                return_value=mock_query,
            ):
                with patch(
                    "apps.kuaizhizao.services.customer_pool_service.DataScopeService.apply",
                    new_callable=AsyncMock,
                    return_value=mock_query,
                ):
                    with patch.object(
                        CustomerPoolService,
                        "_load_collaborators_map",
                        AsyncMock(return_value={}),
                    ):
                        await CustomerPoolService.list_customers(
                            tenant_id=1,
                            current_user=user,
                            scope="mine",
                        )

        pool_status_filter = any(
            "pool_status" in call.kwargs and call.kwargs.get("pool_status") == "owned"
            for call in mock_query.filter.call_args_list
        )
        mine_scope_filter = any(
            call.args and isinstance(call.args[0], Q) for call in mock_query.filter.call_args_list
        )
        self.assertFalse(pool_status_filter)
        self.assertTrue(mine_scope_filter)

    async def test_list_customer_pool_all_applies_data_scope(self):
        user = User(id=5, tenant_id=1, username="sales5", full_name="销售五")
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count = AsyncMock(return_value=0)
        mock_query.order_by.return_value.offset.return_value.limit = AsyncMock(return_value=[])

        with patch(
            "apps.kuaizhizao.services.customer_pool_service.Customer.filter",
            return_value=mock_query,
        ):
            with patch(
                "apps.kuaizhizao.services.customer_pool_service.DataScopeService.apply",
                new_callable=AsyncMock,
                return_value=mock_query,
            ) as mock_apply:
                await CustomerPoolService.list_customers(
                    tenant_id=1,
                    current_user=user,
                    scope="all",
                )
                mock_apply.assert_awaited_once()
                self.assertEqual(
                    mock_apply.await_args.kwargs["resource"],
                    "kuaizhizao:customer-pool",
                )

    async def test_list_customer_pool_filters_salesman_and_pool_status(self):
        user = User(id=5, tenant_id=1, username="sales5", full_name="销售五")
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.count = AsyncMock(return_value=0)
        mock_query.order_by.return_value.offset.return_value.limit = AsyncMock(return_value=[])

        with patch(
            "apps.kuaizhizao.services.customer_pool_service.Customer.filter",
            return_value=mock_query,
        ):
            with patch(
                "apps.kuaizhizao.services.customer_pool_service.DataScopeService.apply",
                new_callable=AsyncMock,
                return_value=mock_query,
            ):
                await CustomerPoolService.list_customers(
                    tenant_id=1,
                    current_user=user,
                    scope="all",
                    salesman_id=9,
                    pool_status="owned",
                )

        salesman_filter = None
        pool_status_filter = None
        effective_owned_filter = False
        for call in mock_query.filter.call_args_list:
            kwargs = call.kwargs
            if kwargs.get("salesman_id") == 9:
                salesman_filter = kwargs
            if kwargs.get("pool_status") == "owned":
                pool_status_filter = kwargs
            if call.args and isinstance(call.args[0], Q):
                effective_owned_filter = True
        self.assertIsNotNone(salesman_filter)
        self.assertIsNone(pool_status_filter)
        self.assertTrue(effective_owned_filter)


class CustomerPoolCollaboratorTests(unittest.IsolatedAsyncioTestCase):
    async def test_set_collaborators_rejects_owner_as_collaborator(self):
        customer = _FakeCustomer(id=10, salesman_id=3, pool_status="owned")
        operator = User(id=3, tenant_id=1, username="sales3", full_name="张三")

        with patch.object(CustomerPoolService, "_load_customer", AsyncMock(return_value=customer)):
            with patch(
                "apps.kuaizhizao.services.customer_pool_service.DataScopeService.assert_row_visible",
                AsyncMock(),
            ):
                from apps.kuaizhizao.schemas.customer_pool import CustomerPoolCollaboratorsUpdateBody

                with self.assertRaises(ValidationError):
                    await CustomerPoolService.set_collaborators(
                        tenant_id=1,
                        customer_id=10,
                        current_user=operator,
                        body=CustomerPoolCollaboratorsUpdateBody(user_ids=[3, 4]),
                    )

    async def test_set_collaborators_rejects_pool_customer(self):
        customer = _FakeCustomer(id=10, pool_status="pool")
        operator = User(id=3, tenant_id=1, username="sales3", full_name="张三")

        with patch.object(CustomerPoolService, "_load_customer", AsyncMock(return_value=customer)):
            with patch(
                "apps.kuaizhizao.services.customer_pool_service.DataScopeService.assert_row_visible",
                AsyncMock(),
            ):
                from apps.kuaizhizao.schemas.customer_pool import CustomerPoolCollaboratorsUpdateBody

                with self.assertRaises(ValidationError):
                    await CustomerPoolService.set_collaborators(
                        tenant_id=1,
                        customer_id=10,
                        current_user=operator,
                        body=CustomerPoolCollaboratorsUpdateBody(user_ids=[4]),
                    )

    async def test_list_collaborator_customer_ids_returns_active_customer_ids(self):
        with patch(
            "apps.kuaizhizao.services.customer_pool_service.CustomerCollaborator.filter"
        ) as mock_filter:
            mock_filter.return_value.values_list = AsyncMock(return_value=[10, 20])
            from apps.kuaizhizao.services.customer_pool_service import list_collaborator_customer_ids

            ids = await list_collaborator_customer_ids(tenant_id=1, user_id=4)

        self.assertEqual(ids, [10, 20])
        mock_filter.assert_called_once_with(
            tenant_id=1,
            user_id=4,
            deleted_at__isnull=True,
        )


class CustomerPoolScopeResolverTests(unittest.IsolatedAsyncioTestCase):
    async def test_customer_salesman_pool_includes_collaborator_ids(self):
        from core.services.authorization.data_scope_resolver_registry import ScopeResolveContext
        from core.services.authorization.data_scope_resolvers import resolve_customer_salesman_pool

        profile = MagicMock()
        profile.applicant_user_id_field = "salesman_id"
        ctx = ScopeResolveContext(
            tenant_id=1,
            user_id=5,
            resource="kuaizhizao:customer-pool",
            profile=profile,
            scope_payload=None,
            department_uuid=None,
            department_user_ids=[],
        )

        with patch(
            "apps.kuaizhizao.services.customer_pool_service.list_collaborator_customer_ids",
            AsyncMock(return_value=[99]),
        ):
            clause = await resolve_customer_salesman_pool(ctx)

        self.assertIsNotNone(clause)

    async def test_customer_owned_only_includes_collaborator_ids(self):
        from core.services.authorization.data_scope_resolver_registry import ScopeResolveContext
        from core.services.authorization.data_scope_resolvers import resolve_customer_owned_only

        profile = MagicMock()
        profile.applicant_user_id_field = "salesman_id"
        ctx = ScopeResolveContext(
            tenant_id=1,
            user_id=5,
            resource="master-data:supply-chain:customer",
            profile=profile,
            scope_payload=None,
            department_uuid=None,
            department_user_ids=[],
        )

        with patch(
            "apps.kuaizhizao.services.customer_pool_service.list_collaborator_customer_ids",
            AsyncMock(return_value=[99]),
        ):
            clause = await resolve_customer_owned_only(ctx)

        self.assertIsNotNone(clause)


class CustomerPoolStatusFilterTests(unittest.TestCase):
    def test_resolve_customer_pool_status_display(self):
        from apps.kuaizhizao.services.customer_pool_list_core import resolve_customer_pool_status_display

        self.assertEqual(resolve_customer_pool_status_display("pool", 9), "pool")
        self.assertEqual(resolve_customer_pool_status_display("owned", None), "owned")
        self.assertEqual(resolve_customer_pool_status_display("", 9), "owned")
        self.assertEqual(resolve_customer_pool_status_display("legacy", None), "pool")

    def test_customer_pool_mine_scope_q(self):
        from apps.kuaizhizao.services.customer_pool_list_core import customer_pool_mine_scope_q

        q = customer_pool_mine_scope_q(current_user_id=5, collaborator_customer_ids=[88, 89])
        self.assertIsInstance(q, Q)
        q_solo = customer_pool_mine_scope_q(current_user_id=5, collaborator_customer_ids=[])
        self.assertIsInstance(q_solo, Q)

    def test_effective_status_display_pairs(self):
        from apps.kuaizhizao.services.customer_pool_list_core import resolve_customer_pool_status_display

        owned_cases = [("", 3), ("owned", 3), ("owned", None)]
        public_cases = [("pool", None), ("pool", 3), ("legacy", None)]
        for pool_status, salesman_id in owned_cases:
            self.assertEqual(
                resolve_customer_pool_status_display(pool_status, salesman_id),
                "owned",
                (pool_status, salesman_id),
            )
        for pool_status, salesman_id in public_cases:
            self.assertEqual(
                resolve_customer_pool_status_display(pool_status, salesman_id),
                "pool",
                (pool_status, salesman_id),
            )


class CustomerPoolPermissionContractTests(unittest.TestCase):
    def test_customer_pool_business_permission_codes(self):
        from core.config.permission_contract import validate_permission_code

        codes = [
            "kuaizhizao:customer-pool:read",
            "kuaizhizao:customer-pool:claim",
            "kuaizhizao:customer-pool:assign",
            "kuaizhizao:customer-pool:collaborate",
            "kuaizhizao:customer-pool:release",
            "kuaizhizao:customer-pool:recycle",
            "kuaizhizao:customer-pool:update",
        ]
        for code in codes:
            self.assertIsNone(validate_permission_code(code), code)


if __name__ == "__main__":
    unittest.main()
