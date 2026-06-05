"""租户隔离备份 RBAC 关联表导出/校验单元测试。"""

import pytest

from core.services.system.data_backup_jobs import (
    TENANT_JUNCTION_TABLES,
    _append_tenant_junction_deletes,
    _build_tenant_junction_copy_sql,
    _parse_tenant_dump_sections,
    _validate_csv_header,
)


def test_tenant_junction_tables_cover_rbac_links():
    assert "core_user_roles" in TENANT_JUNCTION_TABLES
    assert "core_role_permissions" in TENANT_JUNCTION_TABLES


def test_build_tenant_junction_copy_sql_scopes_by_tenant():
    user_roles_sql = _build_tenant_junction_copy_sql("core_user_roles", 42)
    assert "core_user_roles" in user_roles_sql
    assert "tenant_id = 42" in user_roles_sql
    assert "core_users" in user_roles_sql
    assert "core_roles" in user_roles_sql

    role_perm_sql = _build_tenant_junction_copy_sql("core_role_permissions", 7)
    assert "core_role_permissions" in role_perm_sql
    assert "tenant_id = 7" in role_perm_sql

    policy_sql = _build_tenant_junction_copy_sql("core_policy_bindings", 3)
    assert "core_policy_bindings" in policy_sql
    assert "core_access_policies" in policy_sql
    assert "tenant_id = 3" in policy_sql


def test_build_tenant_junction_copy_sql_rejects_unknown_table():
    with pytest.raises(ValueError, match="未知租户关联表"):
        _build_tenant_junction_copy_sql("core_unknown", 1)


def test_validate_csv_header_junction_table_without_tenant_id():
    _validate_csv_header("core_user_roles", "id,user_id,role_id,created_at\n1,2,3,2026-01-01\n")


def test_validate_csv_header_junction_table_requires_header():
    with pytest.raises(ValueError, match="缺少 CSV 表头"):
        _validate_csv_header("core_role_permissions", "")


def test_validate_csv_header_regular_table_requires_tenant_id():
    with pytest.raises(ValueError, match="不包含 tenant_id"):
        _validate_csv_header("core_users", "id,username\n1,admin\n")


def test_parse_tenant_dump_includes_junction_sections(tmp_path):
    dump_text = """-- Tenant Isolated Backup
--- TABLE: core_users ---
id,tenant_id,username
1,10,admin

--- TABLE: core_user_roles ---
id,user_id,role_id,created_at
1,1,2,2026-01-01

--- TABLE: core_role_permissions ---
role_id,permission_id,created_at
2,100,2026-01-01
"""
    dump_path = tmp_path / "db_dump.sql"
    dump_path.write_text(dump_text, encoding="utf-8")

    sections = _parse_tenant_dump_sections(str(dump_path))
    assert "core_users" in sections
    assert "core_user_roles" in sections
    assert "core_role_permissions" in sections
    assert "user_id" in sections["core_user_roles"]


def test_append_tenant_junction_deletes_scopes_all_junction_tables():
    lines: list[str] = []
    _append_tenant_junction_deletes(lines, {10, 20})
    script = "\n".join(lines)
    assert 'DELETE FROM "core_user_roles"' in script
    assert 'DELETE FROM "core_role_permissions"' in script
    assert 'DELETE FROM "core_policy_bindings"' in script
    assert "tenant_id IN (10, 20)" in script
