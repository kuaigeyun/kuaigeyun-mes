from pathlib import Path
from types import SimpleNamespace

import pytest

from core.services.system import data_backup_jobs as jobs


@pytest.mark.parametrize("source_tenant_id", [1, 2])
def test_restore_only_clears_target_tenant(monkeypatch, source_tenant_id):
    scripts = []

    def capture(cmd, **kwargs):
        scripts.append(Path(cmd[-1]).read_text())
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(jobs.subprocess, "run", capture)
    monkeypatch.setattr(jobs, "_psql_base_cmd", lambda: ["psql-fixture"])
    monkeypatch.setattr(jobs, "_psql_env", lambda: {})
    jobs._run_tenant_restore_transaction(
        delete_order=["core_files"],
        insert_order=["core_files"],
        import_plan={"core_files": (["tenant_id", "file_path"], "tenant_id,file_path\n1,1/a.pdf\n")},
        target_tenant_id=1,
        source_tenant_id=source_tenant_id,
        table_pk_map={},
        table_column_meta={},
        table_column_map={"core_files": ["tenant_id", "file_path"]},
        fk_rows=[],
        fk_constraints=[],
    )
    sql = scripts[0]
    assert 'DELETE FROM "core_files" WHERE tenant_id = 1;' in sql
    assert 'WHERE tenant_id = 2' not in sql
    assert 'tenant_id IN (1, 2)' not in sql
    assert 'tenant_id IN (1)' in sql  # 关联表仍清理目标租户
    assert sql.startswith("BEGIN;") and sql.endswith("COMMIT;\n")
    if source_tenant_id != 1:
        assert "WHERE tenant_id = 1 AND file_path LIKE '2/%'" in sql


def test_cross_system_csv_still_maps_tenant_and_file_path():
    columns, csv = jobs._prepare_csv_for_import(
        "core_files", "tenant_id,file_path\n2,2/a.pdf\n",
        target_tenant_id=1, source_tenant_id=2,
        table_columns=["tenant_id", "file_path"],
    )
    assert columns == ["tenant_id", "file_path"]
    assert "1,1/a.pdf" in csv
    assert "2/a.pdf" not in csv


def test_department_self_fk_nullified_before_constraint_restore(monkeypatch):
    """悬空 parent_id 须在重建 FK 前置空，不能因自引用删整行部门。"""
    scripts = []

    def capture(cmd, **kwargs):
        scripts.append(Path(cmd[-1]).read_text())
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(jobs.subprocess, "run", capture)
    monkeypatch.setattr(jobs, "_psql_base_cmd", lambda: ["psql-fixture"])
    monkeypatch.setattr(jobs, "_psql_env", lambda: {})

    fk_rows = [
        {
            "child_table": "core_departments",
            "child_column": "parent_id",
            "parent_table": "core_departments",
            "parent_column": "id",
        },
        {
            "child_table": "core_departments",
            "child_column": "manager_id",
            "parent_table": "core_users",
            "parent_column": "id",
        },
    ]
    fk_constraints = [
        {
            "constraint_name": "fk_core_departments_parent_id",
            "child_table": "core_departments",
            "constraint_def": (
                "FOREIGN KEY (parent_id) REFERENCES core_departments(id)"
            ),
        },
    ]
    jobs._run_tenant_restore_transaction(
        delete_order=["core_departments"],
        insert_order=["core_departments"],
        import_plan={
            "core_departments": (
                ["id", "tenant_id", "name", "parent_id"],
                "id,tenant_id,name,parent_id\n2,1,子部门,1\n",
            ),
        },
        target_tenant_id=1,
        source_tenant_id=1,
        table_pk_map={"core_departments": ["id"]},
        table_column_meta={},
        table_column_map={
            "core_departments": ["id", "tenant_id", "name", "parent_id", "manager_id"],
            "core_users": ["id", "tenant_id"],
        },
        fk_rows=fk_rows,
        fk_constraints=fk_constraints,
    )
    sql = scripts[0]
    assert 'DROP CONSTRAINT IF EXISTS "fk_core_departments_parent_id"' in sql
    assert (
        'UPDATE "core_departments" c SET "parent_id" = NULL '
        "WHERE c.tenant_id IN (1) "
        'AND c."parent_id" IS NOT NULL '
        "AND NOT EXISTS ("
        'SELECT 1 FROM "core_departments" p '
        'WHERE p."id" = c."parent_id" '
        "AND p.tenant_id = c.tenant_id"
        ");"
    ) in sql
    assert 'DELETE FROM "core_departments" c WHERE c.tenant_id IN (1) AND c."parent_id"' not in sql
    assert sql.index('SET "parent_id" = NULL') < sql.index(
        'ADD CONSTRAINT "fk_core_departments_parent_id"'
    )


def test_tenant_export_sql_only_current_tenant():
    users = jobs._build_tenant_table_copy_sql("core_users", 24)
    assert users == 'SELECT * FROM "core_users" WHERE tenant_id = 24'
    roles = jobs._build_tenant_junction_copy_sql("core_user_roles", 24)
    assert "OR " not in roles
    policies = jobs._build_tenant_junction_copy_sql("core_policy_bindings", 24)
    assert "OR " not in policies
