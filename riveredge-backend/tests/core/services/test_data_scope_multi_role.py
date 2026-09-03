"""多角色数据权限：默认「全部」须按角色并集，不得被另一角色的收敛策略覆盖。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.authorization.data_scope_service import DataScopeService


@pytest.mark.asyncio
async def test_apply_implicit_all_role_unions_over_restrictive_role():
    qs = MagicMock()
    qs.filter.return_value = qs

    role_all = SimpleNamespace(uuid="role-a", role_type="internal", external_partner_type=None)
    role_self = SimpleNamespace(uuid="role-b", role_type="internal", external_partner_type=None)
    self_policy = SimpleNamespace(
        role_uuid="role-b",
        scope_type="scope_self",
        scope_payload=None,
    )

    with patch.object(DataScopeService, "_admin_bypass", new=AsyncMock(return_value=False)), patch.object(
        DataScopeService,
        "_load_active_roles",
        new=AsyncMock(return_value=[role_all, role_self]),
    ), patch.object(
        DataScopeService,
        "_filter_roles_with_function_resource",
        new=AsyncMock(return_value=[role_all, role_self]),
    ), patch.object(
        DataScopeService,
        "_load_policies",
        new=AsyncMock(return_value=[self_policy]),
    ), patch.object(
        DataScopeService,
        "_department_context",
        new=AsyncMock(return_value=(None, [1])),
    ):
        result = await DataScopeService.apply(
            qs,
            tenant_id=1,
            user=SimpleNamespace(id=1),
            resource="haoligo:finance-equipment-contracts",
        )

    assert result is qs
    qs.filter.assert_not_called()


@pytest.mark.asyncio
async def test_apply_restrictive_roles_or_filters():
    qs = MagicMock()
    filtered = MagicMock()
    qs.filter.return_value = filtered

    role_a = SimpleNamespace(uuid="role-a", role_type="internal", external_partner_type=None)
    role_b = SimpleNamespace(uuid="role-b", role_type="internal", external_partner_type=None)
    policies = [
        SimpleNamespace(role_uuid="role-a", scope_type="scope_self", scope_payload=None),
        SimpleNamespace(role_uuid="role-b", scope_type="scope_self", scope_payload=None),
    ]

    with patch.object(DataScopeService, "_admin_bypass", new=AsyncMock(return_value=False)), patch.object(
        DataScopeService,
        "_load_active_roles",
        new=AsyncMock(return_value=[role_a, role_b]),
    ), patch.object(
        DataScopeService,
        "_filter_roles_with_function_resource",
        new=AsyncMock(return_value=[role_a, role_b]),
    ), patch.object(
        DataScopeService,
        "_load_policies",
        new=AsyncMock(return_value=policies),
    ), patch.object(
        DataScopeService,
        "_department_context",
        new=AsyncMock(return_value=(None, [1])),
    ), patch.object(
        DataScopeService,
        "_policy_to_q",
        new=AsyncMock(side_effect=[MagicMock(), MagicMock()]),
    ):
        result = await DataScopeService.apply(
            qs,
            tenant_id=1,
            user=SimpleNamespace(id=1),
            resource="haoligo:finance-equipment-contracts",
        )

    assert result is filtered
    qs.filter.assert_called_once()


@pytest.mark.asyncio
async def test_apply_external_partner_ignores_self_uses_manufacturer_code():
    """设备制造商等外协：有 partner_code_field 时按绑定厂商编码，不被 scope_self（登记人）挡住。"""
    from tortoise.expressions import Q

    qs = MagicMock()
    filtered = MagicMock()
    qs.filter.return_value = filtered

    role = SimpleNamespace(
        uuid="role-mfr",
        role_type="external",
        external_partner_type="manufacturer",
    )
    self_policy = SimpleNamespace(
        role_uuid="role-mfr",
        scope_type="scope_self",
        scope_payload=None,
    )
    profile = SimpleNamespace(
        partner_code_field="manufacturer_code",
        applicant_user_id_field="reporter_user_id",
        created_by_user_id_field=None,
        partner_dimension="manufacturer",
        no_policy_default_resolver=None,
    )
    partner_q = Q(manufacturer_code__in=["ZW"])

    with patch.object(DataScopeService, "_admin_bypass", new=AsyncMock(return_value=False)), patch(
        "core.services.authorization.data_scope_service.get_resource_profile",
        return_value=profile,
    ), patch.object(
        DataScopeService,
        "_load_active_roles",
        new=AsyncMock(return_value=[role]),
    ), patch.object(
        DataScopeService,
        "_filter_roles_with_function_resource",
        new=AsyncMock(return_value=[role]),
    ), patch.object(
        DataScopeService,
        "_load_policies",
        new=AsyncMock(return_value=[self_policy]),
    ), patch.object(
        DataScopeService,
        "_department_context",
        new=AsyncMock(return_value=(None, [9])),
    ), patch.object(
        DataScopeService,
        "_external_partner_q_for_role",
        new=AsyncMock(return_value=partner_q),
    ) as partner_mock, patch.object(
        DataScopeService,
        "_policy_to_q",
        new=AsyncMock(),
    ) as policy_mock:
        result = await DataScopeService.apply(
            qs,
            tenant_id=1,
            user=SimpleNamespace(id=9),
            resource="haoligo:finance-equipment-contracts",
        )

    assert result is filtered
    partner_mock.assert_awaited_once()
    policy_mock.assert_not_called()
    qs.filter.assert_called_once()
