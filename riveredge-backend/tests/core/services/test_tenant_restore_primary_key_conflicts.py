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

pytestmark = pytest.mark.asyncio


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


async def test_global_unique_uuid_collision_remaps_parent_and_fk():
    class Connection:
        async def execute_query_dict(self, sql, args=None):
            if "FROM pg_index" in sql:
                return [{"table_name": "settings", "column_name": "uuid"}]
            return [{"v": "already-used"}]

    plan = {
        "settings": (
            ["id", "tenant_id", "uuid"],
            "id,tenant_id,uuid\n1,2,already-used\n",
        ),
        "entries": (
            ["id", "tenant_id", "settings_uuid"],
            "id,tenant_id,settings_uuid\n2,2,already-used\n",
        ),
    }
    remapped = await jobs._remap_import_plan_global_unique_uuids_if_needed(
        plan,
        target_tenant_id=3,
        table_column_map={},
        fk_rows=[
            {
                "child_table": "entries",
                "child_column": "settings_uuid",
                "parent_table": "settings",
                "parent_column": "uuid",
            }
        ],
        conn=Connection(),
    )
    parent_uuid = jobs._extract_csv_column_values(remapped["settings"][1], "uuid")[0]
    child_uuid = jobs._extract_csv_column_values(remapped["entries"][1], "settings_uuid")[0]
    assert parent_uuid != "already-used"
    assert child_uuid == parent_uuid


async def test_global_unique_uuid_only_colliding_values_remapped():
    """仅真正冲突的 UUID 被重写，未冲突行保持原值（减少无谓重排）。"""
    import uuid as uuid_module

    seen_queries = []

    class Connection:
        async def execute_query_dict(self, sql, args=None):
            if "FROM pg_index" in sql:
                return [{"table_name": "settings", "column_name": "uuid"}]
            seen_queries.append((sql, args))
            return [{"v": "used-one"}]

    plan = {
        "settings": (
            ["id", "tenant_id", "uuid"],
            "id,tenant_id,uuid\n1,2,used-one\n2,2,free-two\n",
        ),
    }
    remapped = await jobs._remap_import_plan_global_unique_uuids_if_needed(
        plan, target_tenant_id=3, table_column_map={}, fk_rows=[], conn=Connection(),
    )
    values = jobs._extract_csv_column_values(remapped["settings"][1], "uuid")
    assert values[1] == "free-two"
    assert values[0] != "used-one"
    uuid_module.UUID(values[0])
    assert len(seen_queries) >= 2  # 初检 + 重检各一次


@pytest.mark.asyncio
async def test_global_unique_uuid_duplicate_in_backup_fails():
    class Connection:
        async def execute_query_dict(self, sql, args=None):
            if "FROM pg_index" in sql:
                return [{"table_name": "settings", "column_name": "uuid"}]
            return []

    with pytest.raises(ValueError, match="存在重复值"):
        await jobs._remap_import_plan_global_unique_uuids_if_needed(
            {
                "settings": (
                    ["tenant_id", "uuid"],
                    "tenant_id,uuid\n2,abc\n2,abc\n",
                )
            },
            target_tenant_id=3,
            table_column_map={},
            fk_rows=[],
            conn=Connection(),
        )


async def test_global_unique_non_uuid_conflict_raises_clear_error():
    """非 uuid 单列唯一列冲突时提前报人话错误，不等 COPY 才暴露。"""

    class Connection:
        async def execute_query_dict(self, sql, args=None):
            if "FROM pg_index" in sql:
                return [{"table_name": "orders", "column_name": "order_no"}]
            return [{"v": "NO-001"}]

    with pytest.raises(ValueError, match="唯一列 order_no 与目标库已有数据冲突"):
        await jobs._remap_import_plan_global_unique_uuids_if_needed(
            {"orders": (["tenant_id", "order_no"], "tenant_id,order_no\n2,NO-001\n")},
            target_tenant_id=3,
            table_column_map={},
            fk_rows=[],
            conn=Connection(),
        )


def test_safe_extract_rejects_zip_slip(tmp_path):
    import zipfile as zip_module

    evil = tmp_path / "evil.zip"
    with zip_module.ZipFile(evil, "w") as zf:
        zf.writestr("../escape.txt", "x")
    with zip_module.ZipFile(evil, "r") as zf:
        with pytest.raises(ValueError, match="非法路径条目"):
            jobs._safe_extract_zip_member(zf, "../escape.txt", str(tmp_path / "out"))


def test_safe_extract_enforces_allowed_prefix(tmp_path):
    import zipfile as zip_module

    zpath = tmp_path / "b.zip"
    with zip_module.ZipFile(zpath, "w") as zf:
        zf.writestr("uploads/1/a.txt", "x")
    with zip_module.ZipFile(zpath, "r") as zf:
        with pytest.raises(ValueError, match="超出允许范围"):
            jobs._safe_extract_zip_member(
                zf, "uploads/1/a.txt", str(tmp_path / "out"),
                allowed_prefixes=("database.dump",),
            )



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
