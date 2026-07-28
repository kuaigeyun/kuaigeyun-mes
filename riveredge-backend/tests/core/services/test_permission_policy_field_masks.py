"""字段权限 effective masks：默认 full 与显式收敛合并。"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from core.models.field_permission_policy import FieldMaskLevel, FieldPermissionPolicy
from core.services.authorization.permission_policy_service import PermissionPolicyService
INVENTORY_RESOURCE = "kuaizhizao:warehouse-management-inventory"


def test_merge_field_mask_levels_picks_strictest():
    nested: dict[str, dict[str, str]] = {
        INVENTORY_RESOURCE: {"total_amount": FieldMaskLevel.FULL},
    }
    PermissionPolicyService._merge_field_mask_levels(
        nested,
        resource=INVENTORY_RESOURCE,
        field="total_amount",
        level=FieldMaskLevel.MASKED,
    )
    assert nested[INVENTORY_RESOURCE]["total_amount"] == FieldMaskLevel.MASKED

    PermissionPolicyService._merge_field_mask_levels(
        nested,
        resource=INVENTORY_RESOURCE,
        field="total_amount",
        level=FieldMaskLevel.FULL,
    )
    assert nested[INVENTORY_RESOURCE]["total_amount"] == FieldMaskLevel.MASKED

    PermissionPolicyService._merge_field_mask_levels(
        nested,
        resource=INVENTORY_RESOURCE,
        field="total_amount",
        level=FieldMaskLevel.HIDDEN,
    )
    assert nested[INVENTORY_RESOURCE]["total_amount"] == FieldMaskLevel.HIDDEN


def test_get_user_effective_field_masks_defaults_full_without_db_rows():
    async def _run():
        with patch.object(
            PermissionPolicyService,
            "_collect_user_role_uuids",
            new=AsyncMock(return_value=["role-a"]),
        ), patch.object(
            PermissionPolicyService,
            "_load_tenant_field_alias_map",
            new=AsyncMock(return_value={}),
        ), patch.object(
            PermissionPolicyService,
            "_collect_user_granted_field_policy_resources",
            new=AsyncMock(return_value={INVENTORY_RESOURCE}),
        ), patch.object(
            FieldPermissionPolicy,
            "filter",
            return_value=MagicMock(all=AsyncMock(return_value=[])),
        ):
            return await PermissionPolicyService.get_user_effective_field_masks(
                tenant_id=1,
                user_id=99,
            )

    masks = asyncio.run(_run())
    assert masks[INVENTORY_RESOURCE]["total_amount"] == FieldMaskLevel.FULL
    assert masks[INVENTORY_RESOURCE]["amount"] == FieldMaskLevel.FULL
