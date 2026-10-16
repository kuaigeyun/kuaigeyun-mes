"""PostgreSQL 用例仅允许显式指定的一次性 codex 测试容器。

纯函数用例（CSV 偏移 / FK 映射）不依赖容器，可随时跑。
事务层碰撞用例仍验证：未 remap 时外租户主键冲突整单回滚、不误删。
跨租户恢复的避让在 restore_tenant_backup_from_dump → _remap_import_plan_serial_ids_if_needed。
"""
import os
import subprocess
import tempfile
from pathlib import Path
from types import SimpleNamespace

import pytest

from core.services.system import data_backup_jobs as jobs


def test_shift_csv_int_columns_adds_offset_and_skips_null():
    csv_text = "id,parent_id,name\n1,10,a\n,20,b\nnull,30,c\n"
    out = jobs._shift_csv_int_columns(csv_text, {"id": 1000, "parent_id": 500})
    assert out.splitlines() == [
        "id,parent_id,name",
        "1001,510,a",
        ",520,b",
        "null,530,c",
    ]


def test_shift_csv_int_columns_noop_when_offset_zero():
    csv_text = "id,name\n1,a\n"
    assert jobs._shift_csv_int_columns(csv_text, {"id": 0}) == csv_text


def test_serial_id_pk_tables_skips_composite_pk():
    plan = {
        "a": (["id", "name"], "id,name\n1,x\n"),
        "b": (["id", "name"], "id,name\n1,x\n"),
    }
    assert jobs._serial_id_pk_tables(plan, {"a": ["id"], "b": ["id", "name"]}) == ["a"]


def test_serial_id_pk_tables_includes_unique_id_without_pk():
    plan = {
        "core_apis": (["id", "code"], "id,code\n1,x\n"),
    }
    assert jobs._serial_id_pk_tables(
        plan, {}, unique_id_tables={"core_apis"}
    ) == ["core_apis"]


def test_fk_columns_to_serial_parents_maps_child_cols():
    plan = {
        "parents": (["id"], "id\n1\n"),
        "children": (["id", "parent_id"], "id,parent_id\n1,1\n"),
    }
    fk_rows = [
        {
            "child_table": "children",
            "parent_table": "parents",
            "child_column": "parent_id",
            "parent_column": "id",
        }
    ]
    assert jobs._fk_columns_to_serial_parents(fk_rows, {"parents"}, plan) == {
        "children": {"parent_id": "parents"}
    }


def restore(composite=False):
    columns = ["id", "tenant_id", "name"]
    pk = ["id", "name"] if composite else ["id"]
    jobs._run_tenant_restore_transaction(
        delete_order=["restore_fixture"], insert_order=["restore_fixture"],
        import_plan={"restore_fixture": (columns, "id,tenant_id,name\n900,1,fixture\n")},
        target_tenant_id=1, source_tenant_id=1,
        table_pk_map={"restore_fixture": pk}, table_column_meta={},
        table_column_map={"restore_fixture": columns}, fk_rows=[], fk_constraints=[],
    )


@pytest.mark.parametrize("composite", [False, True])
def test_no_global_primary_key_delete(monkeypatch, composite):
    scripts = []

    def capture(cmd, **kwargs):
        scripts.append(Path(cmd[-1]).read_text())
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(jobs.subprocess, "run", capture)
    monkeypatch.setattr(jobs, "_psql_base_cmd", lambda: ["fixture"])
    monkeypatch.setattr(jobs, "_psql_env", lambda: {})
    restore(composite)
    deletes = [line for line in scripts[0].splitlines() if line.startswith('DELETE FROM "restore_fixture"')]
    assert deletes == ['DELETE FROM "restore_fixture" WHERE tenant_id = 1;']


@pytest.fixture
def postgres(monkeypatch):
    container = os.environ.get("BACKUP_TEST_CONTAINER")
    directory = os.environ.get("BACKUP_TEST_SHARED_DIR")
    if not container or not directory:
        pytest.skip("需要一次性 PostgreSQL 容器与共享临时目录")
    if not container.startswith("codex-") or not Path(directory).resolve().is_relative_to("/private/tmp"):
        pytest.fail("拒绝在非 codex 测试环境执行恢复测试")
    cmd = ["docker", "exec", "-i", container, "psql", "-U", "postgres", "-d", "codex_stock_test", "-v", "ON_ERROR_STOP=1"]

    def query(sql):
        return subprocess.run([*cmd, "-At"], input=sql, text=True, capture_output=True, check=True).stdout.strip()

    query('''
        DROP TABLE IF EXISTS restore_fixture;
        CREATE TABLE IF NOT EXISTS core_users (id integer PRIMARY KEY, tenant_id integer);
        CREATE TABLE IF NOT EXISTS core_roles (id integer PRIMARY KEY, tenant_id integer);
        CREATE TABLE IF NOT EXISTS core_access_policies (id integer PRIMARY KEY, tenant_id integer);
        CREATE TABLE IF NOT EXISTS core_user_roles (user_id integer, role_id integer);
        CREATE TABLE IF NOT EXISTS core_role_permissions (role_id integer);
        CREATE TABLE IF NOT EXISTS core_policy_bindings (policy_id integer, subject_type text, subject_id integer);
    ''')
    monkeypatch.setattr(jobs, "_psql_base_cmd", lambda: cmd)
    monkeypatch.setattr(jobs, "_psql_env", lambda: os.environ.copy())
    monkeypatch.setattr(tempfile, "tempdir", directory)
    yield query
    query("DROP TABLE IF EXISTS restore_fixture")


@pytest.mark.parametrize("composite", [False, True])
def test_foreign_tenant_collision_rolls_back_entire_restore(postgres, composite):
    pk = "id, name" if composite else "id"
    postgres(f"CREATE TABLE restore_fixture (id integer, tenant_id integer, name text, PRIMARY KEY ({pk}));")
    postgres("INSERT INTO restore_fixture VALUES (1,1,'original'), (900,2,'fixture');")
    with pytest.raises(RuntimeError, match="已回滚"):
        restore(composite)
    assert postgres("SELECT id || ':' || tenant_id || ':' || name FROM restore_fixture ORDER BY id") == "1:1:original\n900:2:fixture"


def test_target_tenant_can_restore_its_own_primary_key(postgres):
    postgres("CREATE TABLE restore_fixture (id integer PRIMARY KEY, tenant_id integer, name text);")
    postgres("INSERT INTO restore_fixture VALUES (900,1,'old'), (901,2,'untouched');")
    restore()
    assert postgres("SELECT id || ':' || tenant_id || ':' || name FROM restore_fixture ORDER BY id") == "900:1:fixture\n901:2:untouched"
