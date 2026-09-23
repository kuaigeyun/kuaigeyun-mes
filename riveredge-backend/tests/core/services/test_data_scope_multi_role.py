"""多角色数据权限：先并集有效访问再鉴权；默认「全部」按角色并集，不得被另一角色收敛覆盖。"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.services.authorization.data_scope_service import DataScopeService
from core.services.authorization.effective_access_service import EffectiveUserAccess


def _access(*, roles, role_resource_keys=None, is_admin_bypass=False):
    keys = role_resource_keys
    if keys is None:
        keys = {
            (getattr(r, "uuid", None) or ""): frozenset({"kuaizhizao:work-order"})
            for r in roles
            if (getattr(r, "uuid", None) or "")
        }
    return EffectiveUserAccess(
        user_id=1,
        tenant_id=1,
        roles=tuple(roles),
        permission_codes=frozenset(),
        role_resource_keys=keys,
        is_admin_bypass=is_admin_bypass,
    )


@pytest.mark.asyncio
async def test_apply_no_explicit_policies_is_all_for_internal():
    """未落库策略时厂内角色默认全部，与矩阵「默认：全部」一致，不得静默收敛为本人。"""
    qs = MagicMock()
    qs.filter.return_value = qs

    role = SimpleNamespace(uuid="role-a", role_type="internal", external_partner_type=None)
    access = _access(roles=[role], role_resource_keys={"role-a": frozenset({"kuaizhizao:work-order"})})

    with patch(
        "core.services.authorization.effective_access_service.EffectiveAccessService.get",
        new=AsyncMock(return_value=access),
    ), patch.object(
        DataScopeService,
        "_load_policies",
        new=AsyncMock(return_value=[]),
    ), patch.object(
        DataScopeService,
        "_default_external_partner_q",
        new=AsyncMock(return_value=None),
    ):
        result = await DataScopeService.apply(
            qs,
            tenant_id=1,
            user=SimpleNamespace(id=1),
            resource="kuaizhizao:work-order",
        )

    assert result is qs
    qs.filter.assert_not_called()


@pytest.mark.asyncio
async def test_effective_access_is_unique_merge_source_for_apply():
    """DataScope.apply 须走 EffectiveAccessService，禁止再按角色循环 filter_roles。"""
    import inspect

    src = inspect.getsource(DataScopeService.apply)
    assert "EffectiveAccessService" in src
    assert "filter_roles_granting_resource" not in src
    assert "_filter_roles_with_function_resource" not in src


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
    resource = "haoligo:finance-equipment-contracts"
    access = _access(
        roles=[role_all, role_self],
        role_resource_keys={
            "role-a": frozenset({resource}),
            "role-b": frozenset({resource}),
        },
    )

    with patch(
        "core.services.authorization.effective_access_service.EffectiveAccessService.get",
        new=AsyncMock(return_value=access),
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
            resource=resource,
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
    resource = "haoligo:finance-equipment-contracts"
    access = _access(
        roles=[role_a, role_b],
        role_resource_keys={
            "role-a": frozenset({resource}),
            "role-b": frozenset({resource}),
        },
    )

    with patch(
        "core.services.authorization.effective_access_service.EffectiveAccessService.get",
        new=AsyncMock(return_value=access),
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
            resource=resource,
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
    resource = "haoligo:finance-equipment-contracts"
    access = _access(
        roles=[role],
        role_resource_keys={"role-mfr": frozenset({resource})},
    )

    with patch(
        "core.services.authorization.effective_access_service.EffectiveAccessService.get",
        new=AsyncMock(return_value=access),
    ), patch(
        "core.services.authorization.data_scope_service.get_resource_profile",
        return_value=profile,
    ), patch.object(
        DataScopeService,
        "_load_policies",
        new=AsyncMock(return_value=[self_policy]),
    ), patch.object(
        DataScopeService,
        "_department_context",
        new=AsyncMock(return_value=(None, [1])),
    ), patch.object(
        DataScopeService,
        "_external_partner_q_for_role",
        new=AsyncMock(return_value=partner_q),
    ):
        result = await DataScopeService.apply(
            qs,
            tenant_id=1,
            user=SimpleNamespace(id=1),
            resource=resource,
        )

    assert result is filtered
    qs.filter.assert_called_once()


@pytest.mark.asyncio
async def test_roles_for_data_scope_prefers_granting_roles_only():
    role_sales = SimpleNamespace(uuid="r-sales", role_type="internal", external_partner_type=None)
    role_other = SimpleNamespace(uuid="r-other", role_type="internal", external_partner_type=None)
    access = EffectiveUserAccess(
        user_id=1,
        tenant_id=1,
        roles=(role_sales, role_other),
        permission_codes=frozenset({"kuaizhizao:sales-order:read"}),
        role_resource_keys={
            "r-sales": frozenset({"kuaizhizao:sales-order"}),
            "r-other": frozenset({"kuaizhizao:work-order"}),
        },
        is_admin_bypass=False,
    )
    scoped = access.roles_for_data_scope("kuaizhizao:sales-order")
    assert scoped == [role_sales]
