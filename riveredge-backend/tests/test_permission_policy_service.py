from core.services.authorization.permission_policy_service import PermissionPolicyService


def test_permission_code_to_resource_key_maps_standard_code() -> None:
    assert (
        PermissionPolicyService._permission_code_to_resource_key(
            "master-data:supply-chain:customer:read"
        )
        == "master-data:supply-chain:customer"
    )


def test_permission_code_to_resource_key_skips_generic_workspace() -> None:
    assert PermissionPolicyService._permission_code_to_resource_key("haoligo:workspace:read") is None


def test_build_synthetic_field_policy_responses() -> None:
    existing = {("kuaizhizao:sales-order", "tax_amount")}
    rows = PermissionPolicyService._build_synthetic_field_policy_responses(
        role_uuid="role-1",
        resources=["kuaizhizao:sales-order"],
        existing_keys=existing,
        alias_map={},
    )
    field_names = {r.field_name for r in rows}
    assert "tax_amount" not in field_names
    assert "unit_price" in field_names
    assert all(r.resource == "kuaizhizao:sales-order" for r in rows)


def test_role_field_policy_resource_keys_from_codes() -> None:
    key = PermissionPolicyService._permission_code_to_resource_key(
        "kuaizhizao:sales-order:read"
    )
    assert key == "kuaizhizao:sales-order"
