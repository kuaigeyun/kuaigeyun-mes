"""生产领料确认：职能域 OR 角色码策略。"""

import pytest

from apps.kuaizhizao.services.warehouse_service import ProductionPickingService


@pytest.mark.parametrize(
    "policy,user_codes,user_domains,expected",
    [
        (
            {
                "picking_confirm_warehouse_only": True,
                "effective_allowed_role_codes": ["WAREHOUSE_MANAGER"],
                "effective_allowed_functional_domains": ["warehouse"],
            },
            {"CUSTOM_CK"},
            {"warehouse"},
            True,
        ),
        (
            {
                "picking_confirm_warehouse_only": True,
                "effective_allowed_role_codes": ["WAREHOUSE_MANAGER"],
                "effective_allowed_functional_domains": ["warehouse"],
            },
            {"CUSTOM_CK"},
            set(),
            False,
        ),
        (
            {
                "picking_confirm_warehouse_only": True,
                "effective_allowed_role_codes": ["WAREHOUSE_MANAGER"],
                "effective_allowed_functional_domains": ["warehouse"],
            },
            {"WAREHOUSE_MANAGER"},
            set(),
            True,
        ),
        (
            {
                "picking_confirm_warehouse_only": False,
                "effective_allowed_role_codes": [],
                "effective_allowed_functional_domains": [],
            },
            {"ANY"},
            set(),
            True,
        ),
        (
            {
                "picking_confirm_warehouse_only": True,
                "effective_allowed_role_codes": [],
                "effective_allowed_functional_domains": ["warehouse", "production"],
            },
            set(),
            {"production"},
            True,
        ),
    ],
)
def test_picking_confirm_allowed_by_role_policy(policy, user_codes, user_domains, expected):
    svc = ProductionPickingService()
    assert (
        svc._picking_confirm_allowed_by_role_policy(policy, user_codes, user_domains)
        is expected
    )
