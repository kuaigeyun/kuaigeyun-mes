"""租户隔离备份 RBAC 关联表导出/校验单元测试。"""

import pytest

from core.services.system.data_backup_jobs import (
    TENANT_JUNCTION_TABLES,
    _append_tenant_junction_deletes,
    _build_tenant_junction_copy_sql,
    _build_tenant_table_copy_sql,
    _parse_tenant_dump_sections,
    _validate_tenant_backup_user_refs,
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


def test_build_tenant_table_copy_sql_filters_user_fk_children():
    sql = _build_tenant_table_copy_sql(
        "core_user_preferences",
        17,
        [],
        {"core_user_preferences": "user_id"},
    )
    assert "core_user_preferences" in sql
    assert "EXISTS" in sql
    assert "core_users" in sql
    assert "tenant_id = 17" in sql


def test_validate_tenant_backup_user_refs_rejects_missing_users():
    table_csv_map = {
        "core_users": "id,tenant_id,username\n2,17,bob\n",
        "core_saved_searches": (
            "id,uuid,tenant_id,user_id,page_path,name,is_shared,is_pinned,search_params\n"
            "1,s1,17,64,/a,n,False,False,{}\n"
            "2,s2,17,2,/b,n,False,False,{}\n"
        ),
    }
    table_column_map = {
        "core_users": ["id", "tenant_id", "username"],
        "core_saved_searches": ["id", "tenant_id", "user_id", "page_path"],
    }
    with pytest.raises(ValueError, match="无效 user_id 引用"):
        _validate_tenant_backup_user_refs(table_csv_map, table_column_map)


def test_validate_tenant_backup_user_refs_rejects_empty_users_csv():
    table_csv_map = {
        "core_users": "id,tenant_id,username\n",
        "core_saved_searches": (
            "id,uuid,tenant_id,user_id,page_path,name,is_shared,is_pinned,search_params\n"
            "1,s1,17,64,/a,n,False,False,{}\n"
        ),
    }
    table_column_map = {
        "core_users": ["id", "tenant_id", "username"],
        "core_saved_searches": ["id", "tenant_id", "user_id", "page_path"],
    }
    with pytest.raises(ValueError, match="core_users 无有效 id"):
        _validate_tenant_backup_user_refs(table_csv_map, table_column_map)
