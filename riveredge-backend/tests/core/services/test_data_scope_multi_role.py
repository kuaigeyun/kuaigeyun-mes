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


@pytest.mark.asyncio
async def test_apply_external_partner_explicit_all_sees_everything():
    """管理员显式配「全部」必须生效，不得被外协默认的绑定收敛吃掉。"""
    qs = MagicMock()
    qs.filter.return_value = qs

    role = SimpleNamespace(
        uuid="role-mfr",
        role_type="external",
        external_partner_type="manufacturer",
    )
    all_policy = SimpleNamespace(
        role_uuid="role-mfr",
        scope_type="scope_all",
        scope_payload=None,
    )
    profile = SimpleNamespace(
        partner_code_field="manufacturer_code",
        applicant_user_id_field="reporter_user_id",
        created_by_user_id_field=None,
        partner_dimension="manufacturer",
        no_policy_default_resolver=None,
    )

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
        new=AsyncMock(return_value=[all_policy]),
    ), patch.object(
        DataScopeService,
        "_department_context",
        new=AsyncMock(return_value=(None, [9])),
    ), patch.object(
        DataScopeService,
        "_external_partner_q_for_role",
        new=AsyncMock(),
    ) as partner_mock:
        result = await DataScopeService.apply(
            qs,
            tenant_id=1,
            user=SimpleNamespace(id=9),
            resource="haoligo:finance-equipment-contracts",
        )

    assert result is qs
    qs.filter.assert_not_called()
    partner_mock.assert_not_called()


def test_scope_all_is_persisted_not_dropped():
    """回归：scope_all 若不落库，「全部」与「未配置」不可区分，外协永远被收敛。"""
    import inspect

    from core.services.authorization.permission_policy_service import PermissionPolicyService

    source = inspect.getsource(PermissionPolicyService.save_data_policies)
    assert "if scope != DataScopeType.ALL" not in source


def test_implicit_scope_reports_partner_convergence_for_external_role():
    """矩阵默认值必须与引擎一致：外协 + 合作方资源显示「按绑定合作方」而非「全部」。"""
    from core.models.data_permission_policy import DataScopeType
    from core.services.authorization.data_scope_resource_registry import (
        DataScopeResourceProfile,
        register_resource_profile,
    )
    from core.services.authorization.permission_policy_service import PermissionPolicyService

    resource = "haoligo:finance-equipment-contracts"
    register_resource_profile(
        resource,
        DataScopeResourceProfile(
            applicant_user_id_field="reporter_user_id",
            partner_code_field="manufacturer_code",
            partner_dimension="manufacturer",
        ),
    )

    external = SimpleNamespace(role_type="external", external_partner_type="manufacturer")
    scope_type, payload = PermissionPolicyService._implicit_scope_for_resource(external, resource)
    assert scope_type == DataScopeType.CUSTOM
    assert payload == {
        "resolver": "partner",
        "dimension": "manufacturer",
        "code_field": "manufacturer_code",
    }

    internal = SimpleNamespace(role_type="internal", external_partner_type=None)
    assert PermissionPolicyService._implicit_scope_for_resource(internal, resource) == (
        DataScopeType.ALL,
        None,
    )
