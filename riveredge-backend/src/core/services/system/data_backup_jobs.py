"""
数据备份与恢复任务实现（同步/异步工具函数）

供后台事件处理器调用：pg_dump、打包 zip、pg_restore、租户 ID 替换等。
"""

from __future__ import annotations

import csv
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from collections import defaultdict, deque
from datetime import datetime
from typing import Any, Optional

from loguru import logger
from tortoise import Tortoise

from core.services.system.backup_storage import resolve_data_backup_dir
from infra.config.infra_config import infra_settings

TENANT_BACKUP_EXCLUDED_TABLES = {
    # 超大运行日志表：对业务恢复价值有限，但会显著拖慢租户级备份
    "core_operation_logs",
    "core_login_logs",
    "core_user_activities",
    # 备份管理自身数据不参与租户业务迁移
    "core_data_backups",
}

TENANT_BACKUP_EXCLUDED_TABLE_PREFIXES = (
    # 平台级基础设施表：租户级导出/恢复必须跳过，避免影响平台级数据
    "infra_",
)


def _is_platform_level_table(table: str) -> bool:
    return any(table.startswith(prefix) for prefix in TENANT_BACKUP_EXCLUDED_TABLE_PREFIXES)


def _build_tenant_user_reference_subqueries(
    *,
    tenant_id: int,
    export_tables: list[str],
    env: dict[str, str],
) -> list[str]:
    """收集租户子表引用 core_users 的 user_id，用于导出时一并打包关联用户。"""
    db_user = infra_settings.DB_USER
    db_host = infra_settings.DB_HOST
    db_port = infra_settings.DB_PORT
    db_name = infra_settings.DB_NAME
    fk_query = """
        SELECT tc.table_name AS child_table, kcu.column_name AS child_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name = kcu.table_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        JOIN information_schema.columns tenant_col
          ON tenant_col.table_schema = 'public'
         AND tenant_col.table_name = tc.table_name
         AND tenant_col.column_name = 'tenant_id'
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND ccu.table_name = 'core_users'
          AND ccu.column_name = 'id'
    """
    cmd = [
        "psql",
        "-h",
        db_host,
        "-p",
        str(db_port),
        "-U",
        db_user,
        "-d",
        db_name,
        "-t",
        "-A",
        "-F",
        "|",
        "-c",
        fk_query,
    ]
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        logger.warning("查询 user 外键引用失败，core_users 仍仅按 tenant_id 导出: {}", result.stderr)
        return []

    export_set = set(export_tables)
    subqueries: list[str] = []
    for line in result.stdout.splitlines():
        parts = line.strip().split("|")
        if len(parts) != 2:
            continue
        child_table, child_column = parts[0].strip(), parts[1].strip()
        if not child_table or not child_column or child_table not in export_set:
            continue
        if child_table == "core_users":
            continue
        subqueries.append(
            f'SELECT DISTINCT "{child_column}" FROM "{child_table}" '
            f"WHERE tenant_id = {int(tenant_id)} AND \"{child_column}\" IS NOT NULL"
        )
    return subqueries


def _build_tenant_table_copy_sql(table: str, tenant_id: int, user_ref_subqueries: list[str]) -> str:
    if table == "core_users" and user_ref_subqueries:
        refs = " UNION ".join(user_ref_subqueries)
        return (
            f'SELECT * FROM "core_users" WHERE tenant_id = {int(tenant_id)} '
            f"OR id IN ({refs})"
        )
    return f'SELECT * FROM "{table}" WHERE tenant_id = {int(tenant_id)}'


def run_backup_dump_and_zip_sync(
    *,
    backup_uuid: str,
    backup_name: str,
    source_tenant_id: Optional[int],
    tenant_id: Optional[int],
    backup_type: str,
    backup_scope: str,
) -> str:
    """
    执行数据库转储并打成 zip，返回最终 zip 绝对路径。
    """
    db_user = infra_settings.DB_USER
    db_password = infra_settings.DB_PASSWORD
    db_host = infra_settings.DB_HOST
    db_port = infra_settings.DB_PORT
    db_name = infra_settings.DB_NAME

    env = os.environ.copy()
    env["PGPASSWORD"] = db_password

    backup_dir = resolve_data_backup_dir()
    temp_dir = os.path.join(backup_dir, f"temp_{backup_uuid}")
    db_dump_file = os.path.join(temp_dir, "db_dump.dump")

    os.makedirs(temp_dir, exist_ok=True)

    if backup_scope == "tenant" and tenant_id is None:
        raise ValueError("租户隔离备份缺少 tenant_id，已拒绝执行以避免回退到全量备份")

    if backup_scope == "tenant" and tenant_id is not None:
        logger.info(f"开始执行租户隔离备份: tenant_id={tenant_id}")
        db_dump_path = os.path.join(temp_dir, "db_dump.sql")

        get_tables_cmd = [
            "psql",
            "-h",
            db_host,
            "-p",
            str(db_port),
            "-U",
            db_user,
            "-d",
            db_name,
            "-t",
            "-c",
            "SELECT table_name FROM information_schema.columns WHERE column_name = 'tenant_id' AND table_schema = 'public'",
        ]
        result = subprocess.run(get_tables_cmd, env=env, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"获取表列表失败: {result.stderr}")

        discovered_tables = [t.strip() for t in result.stdout.split("\n") if t.strip()]
        tables = [
            t
            for t in discovered_tables
            if t not in TENANT_BACKUP_EXCLUDED_TABLES and not _is_platform_level_table(t)
        ]
        skipped_tables = [
            t
            for t in discovered_tables
            if t in TENANT_BACKUP_EXCLUDED_TABLES or _is_platform_level_table(t)
        ]
        logger.info(
            "租户隔离备份表统计: discovered={} export={} skipped={}",
            len(discovered_tables),
            len(tables),
            len(skipped_tables),
        )
        if skipped_tables:
            logger.info("租户隔离备份跳过表: {}", skipped_tables)

        user_ref_subqueries = _build_tenant_user_reference_subqueries(
            tenant_id=int(tenant_id),
            export_tables=tables,
            env=env,
        )
        if user_ref_subqueries:
            logger.info("core_users 导出将包含 {} 个子表引用的用户 ID", len(user_ref_subqueries))

        with open(db_dump_path, "w", encoding="utf-8") as f:
            f.write("-- Tenant Isolated Backup\n")
            f.write(f"-- Tenant ID: {tenant_id}\n")
            f.write(f"-- Date: {datetime.now()}\n\n")
            if skipped_tables:
                f.write(f"-- Skipped tables: {', '.join(skipped_tables)}\n\n")

            for index, table in enumerate(tables, start=1):
                logger.info(
                    "租户隔离备份导出表 [{}/{}]: {}",
                    index,
                    len(tables),
                    table,
                )
                copy_cmd = [
                    "psql",
                    "-h",
                    db_host,
                    "-p",
                    str(db_port),
                    "-U",
                    db_user,
                    "-d",
                    db_name,
                    "-c",
                    f'COPY ({_build_tenant_table_copy_sql(table, int(tenant_id), user_ref_subqueries)}) '
                    "TO STDOUT WITH (FORMAT CSV, HEADER, ENCODING 'UTF8')",
                ]
                logger.debug(f"正在导出表: {table}")
                table_result = subprocess.run(copy_cmd, env=env, capture_output=True, text=True)
                if table_result.returncode == 0:
                    f.write(f"-- Data for table: {table}\n")
                    f.write(f"--- TABLE: {table} ---\n")
                    f.write(table_result.stdout)
                    f.write("\n\n")
                    logger.info(
                        "租户隔离备份导出完成表 {}，bytes={}",
                        table,
                        len(table_result.stdout.encode("utf-8", errors="ignore")),
                    )
                else:
                    logger.error(f"导出表 {table} 失败: {table_result.stderr}")
    else:
        cmd = [
            "pg_dump",
            "-h",
            db_host,
            "-p",
            str(db_port),
            "-U",
            db_user,
            "-F",
            "c",
            "-b",
            "-v",
            "-f",
            db_dump_file,
            db_name,
        ]
        logger.info(f"执行数据库全量转储: {' '.join(cmd)}")
        result = subprocess.run(cmd, env=env, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"pg_dump 失败: {result.stderr}")

    final_zip_name = f"{backup_name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
    final_zip_path = os.path.join(backup_dir, final_zip_name)

    dump_path = db_dump_file if backup_scope != "tenant" else os.path.join(temp_dir, "db_dump.sql")
    with zipfile.ZipFile(final_zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(dump_path, "database.dump")
        metadata: dict[str, Any] = {"source_tenant_id": source_tenant_id, "backup_scope": backup_scope}
        zipf.writestr("backup_metadata.json", json.dumps(metadata, ensure_ascii=False, indent=2))
        if backup_type == "full":
            upload_dir = infra_settings.FILE_UPLOAD_DIR
            if upload_dir and os.path.exists(upload_dir):
                # 租户隔离备份：仅打包当前租户 uploads 子目录；全量备份仍保留全部 uploads。
                if backup_scope == "tenant" and tenant_id is not None:
                    tenant_upload_dir = os.path.join(upload_dir, str(tenant_id))
                    if os.path.exists(tenant_upload_dir):
                        for root, _dirs, files in os.walk(tenant_upload_dir):
                            for file in files:
                                file_path = os.path.join(root, file)
                                arcname = os.path.join(
                                    "uploads",
                                    os.path.relpath(file_path, upload_dir),
                                )
                                zipf.write(file_path, arcname)
                        logger.info(
                            "租户隔离备份仅打包 uploads 子目录: {}",
                            tenant_upload_dir,
                        )
                    else:
                        logger.info(
                            "租户隔离备份未发现 uploads 子目录，跳过: {}",
                            tenant_upload_dir,
                        )
                elif backup_scope == "tenant":
                    raise ValueError(
                        "租户隔离备份缺少 tenant_id，已拒绝执行 uploads 打包以避免串租户"
                    )
                else:
                    for root, _dirs, files in os.walk(upload_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.join("uploads", os.path.relpath(file_path, upload_dir))
                            zipf.write(file_path, arcname)

    return final_zip_path


def run_full_backup_dump_and_zip(backup_dir: str, temp_dir: str, backup_name: str) -> str:
    """执行全量备份（pg_dump + zip），返回最终 zip 路径。用于恢复前的自动备份。"""
    db_user = infra_settings.DB_USER
    db_password = infra_settings.DB_PASSWORD
    db_host = infra_settings.DB_HOST
    db_port = infra_settings.DB_PORT
    db_name = infra_settings.DB_NAME
    env = os.environ.copy()
    env["PGPASSWORD"] = db_password

    os.makedirs(temp_dir, exist_ok=True)
    db_dump_file = os.path.join(temp_dir, "db_dump.dump")

    cmd = [
        "pg_dump",
        "-h",
        db_host,
        "-p",
        str(db_port),
        "-U",
        db_user,
        "-F",
        "c",
        "-b",
        "-v",
        "-f",
        db_dump_file,
        db_name,
    ]
    logger.info("执行恢复前备份: pg_dump ...")
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"pg_dump 失败: {result.stderr}")

    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    final_zip_name = f"{backup_name}_{ts}.zip"
    final_zip_path = os.path.join(backup_dir, final_zip_name)

    with zipfile.ZipFile(final_zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(db_dump_file, "database.dump")
        upload_dir = infra_settings.FILE_UPLOAD_DIR
        if upload_dir and os.path.exists(upload_dir):
            for root, _dirs, files in os.walk(upload_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.join("uploads", os.path.relpath(file_path, upload_dir))
                    zipf.write(file_path, arcname)

    return final_zip_path


async def run_tenant_id_replacement(source_tenant_id: int, target_tenant_id: int) -> int:
    """恢复后替换租户 ID。"""
    if source_tenant_id == target_tenant_id:
        return 0
    conn = Tortoise.get_connection("default")
    tables_sql = """
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'tenant_id' AND table_schema = 'public'
    """
    tables_rows = await conn.execute_query_dict(tables_sql)
    tables = [
        r["table_name"]
        for r in (tables_rows if isinstance(tables_rows, list) else [])
        if r.get("table_name") and not _is_platform_level_table(r["table_name"])
    ]
    total_updated = 0
    for table in tables:
        try:
            update_sql = f'UPDATE "{table}" SET tenant_id = $1 WHERE tenant_id = $2'
            await conn.execute_query(update_sql, [target_tenant_id, source_tenant_id])
            total_updated += 1
            logger.info(f"租户ID替换: {table} tenant_id {source_tenant_id} -> {target_tenant_id}")
        except Exception as e:
            logger.warning(f"租户ID替换跳过表 {table}: {e}")
    return total_updated


def read_backup_metadata(zip_path: str) -> dict:
    """从备份 zip 读取 backup_metadata.json"""
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            if "backup_metadata.json" in zf.namelist():
                with zf.open("backup_metadata.json") as f:
                    return json.load(f)
    except Exception as e:
        logger.warning(f"读取备份元数据失败: {e}")
    return {}


def resolve_backup_scope_for_restore(
    zip_path: str,
    *,
    record_scope: Optional[str] = None,
    event_scope: Optional[str] = None,
) -> str:
    """解析恢复范围：zip 元数据 > 任务参数 > 数据库记录 > 默认 all。"""
    metadata = read_backup_metadata(zip_path)
    for candidate in (metadata.get("backup_scope"), event_scope, record_scope):
        if candidate in ("tenant", "all", "table"):
            return candidate
    return "all"


def is_tenant_sql_dump(dump_path: str) -> bool:
    """租户级备份 database.dump 为 CSV 分表文本，而非 pg_dump 二进制。"""
    try:
        with open(dump_path, "r", encoding="utf-8", errors="ignore") as f:
            head = f.read(4096)
    except OSError:
        return False
    return "--- TABLE:" in head or "Tenant Isolated Backup" in head


def _parse_tenant_dump_sections(dump_path: str) -> dict[str, str]:
    """
    解析租户备份 database.dump（文本）中的分表 CSV 片段。

    片段格式：
    --- TABLE: table_name ---
    <csv content>
    """
    if not os.path.exists(dump_path):
        raise FileNotFoundError(f"租户备份文件不存在: {dump_path}")

    sections: dict[str, list[str]] = {}
    current_table: Optional[str] = None

    with open(dump_path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.rstrip("\n")
            if line.startswith("--- TABLE: ") and line.endswith(" ---"):
                current_table = line[len("--- TABLE: ") : -len(" ---")].strip()
                sections[current_table] = []
                continue

            # 标题注释行不参与数据解析
            if line.startswith("-- Data for table: "):
                continue

            if current_table is not None:
                sections[current_table].append(raw_line)

    parsed: dict[str, str] = {}
    for table, lines in sections.items():
        csv_text = "".join(lines).strip()
        if csv_text:
            parsed[table] = csv_text
    return parsed


def _build_topological_table_orders(
    tables: list[str],
    fk_rows: list[dict[str, Any]],
) -> tuple[list[str], list[str]]:
    """
    计算表的插入/删除顺序：
    - insert_order: 父表优先（先父后子）
    - delete_order: 子表优先（先子后父）
    """
    table_set = set(tables)
    indegree: dict[str, int] = {table: 0 for table in tables}
    adjacency: dict[str, list[str]] = defaultdict(list)

    for row in fk_rows:
        child = row.get("child_table")
        parent = row.get("parent_table")
        if not child or not parent:
            continue
        if child not in table_set or parent not in table_set:
            continue
        adjacency[parent].append(child)
        indegree[child] += 1

    queue = deque(sorted([table for table, degree in indegree.items() if degree == 0]))
    insert_order: list[str] = []

    while queue:
        node = queue.popleft()
        insert_order.append(node)
        for child in sorted(adjacency.get(node, [])):
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)

    # 有环或依赖异常时，兜底补齐剩余表（保持稳定顺序）
    if len(insert_order) < len(tables):
        remaining = sorted([table for table in tables if table not in set(insert_order)])
        insert_order.extend(remaining)

    delete_order = list(reversed(insert_order))
    return insert_order, delete_order


def _validate_csv_header(table: str, csv_text: str) -> None:
    first_line = csv_text.splitlines()[0] if csv_text else ""
    if not first_line:
        raise ValueError(f"租户备份表 {table} 缺少 CSV 表头")
    if "tenant_id" not in first_line.split(","):
        raise ValueError(f"租户备份表 {table} 不包含 tenant_id 列，无法安全恢复")


def _csv_header_columns(csv_text: str) -> list[str]:
    _ensure_csv_field_limit()
    first_line = csv_text.splitlines()[0] if csv_text else ""
    if not first_line:
        return []
    return next(csv.reader([first_line]))


def _csv_has_data_rows(csv_text: str) -> bool:
    return len(csv_text.splitlines()) > 1


def _project_csv_to_columns(csv_text: str, use_columns: list[str]) -> str:
    """将 CSV 投影为指定列，保持 HEADER 与数据行一致。"""
    if not csv_text:
        return csv_text
    lines = csv_text.splitlines()
    if len(lines) <= 1:
        return csv_text

    reader = csv.reader(lines)
    header = next(reader, [])
    index_map = {name: idx for idx, name in enumerate(header)}
    selected_indexes = [index_map[col] for col in use_columns if col in index_map]
    if not selected_indexes:
        return ""

    out_rows: list[list[str]] = [use_columns]
    for row in reader:
        # 行长度不足时补空，避免索引越界导致整表失败
        padded = row + [""] * max(0, len(header) - len(row))
        out_rows.append([padded[idx] if idx < len(padded) else "" for idx in selected_indexes])

    from io import StringIO

    buffer = StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerows(out_rows)
    return buffer.getvalue()


def _parse_pg_column_default(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    text = str(raw).strip()
    if not text:
        return None
    if "nextval(" in text or "gen_random_uuid" in text:
        return None
    if "CURRENT_TIMESTAMP" in text.upper() or text.startswith("now("):
        return None
    if "::" in text:
        literal = text.split("::", 1)[0].strip()
        if literal.startswith("'") and literal.endswith("'"):
            return literal[1:-1].replace("''", "'")
        return literal
    if text in {"true", "false"}:
        return text
    if text.lstrip("-").replace(".", "", 1).isdigit():
        return text
    return None


def _is_text_column(meta: dict[str, Optional[str]]) -> bool:
    data_type = (meta.get("data_type") or "").lower()
    udt_name = (meta.get("udt_name") or "").lower()
    return data_type in {"character varying", "text", "character", "name"} or udt_name in {
        "varchar",
        "text",
        "bpchar",
        "name",
    }


def _resolve_not_null_fill_value(col: str, meta: dict[str, Optional[str]]) -> Optional[str]:
    if meta.get("is_nullable") == "YES":
        return None
    parsed = _parse_pg_column_default(meta.get("column_default"))
    if parsed is not None:
        return parsed
    if _is_text_column(meta):
        return ""
    data_type = (meta.get("data_type") or "").lower()
    if data_type in {"integer", "bigint", "smallint", "numeric", "double precision", "real"}:
        return "0"
    if data_type == "boolean":
        return "false"
    return None


def _align_csv_to_target_schema(
    csv_text: str,
    use_columns: list[str],
    table_columns: list[str],
    column_meta: dict[str, dict[str, Optional[str]]],
) -> tuple[list[str], str]:
    """补齐目标库新增 NOT NULL 列，并将空值改写为默认值（避免 COPY 把空字段当 NULL）。"""
    if not table_columns:
        return use_columns, csv_text

    _ensure_csv_field_limit()
    lines = csv_text.splitlines()
    if len(lines) <= 1:
        return use_columns, csv_text

    reader = csv.reader(lines)
    header = next(reader, [])
    header_index = {name: idx for idx, name in enumerate(header)}

    extended_columns = list(use_columns)
    for col in table_columns:
        if col in extended_columns:
            continue
        fill_value = _resolve_not_null_fill_value(col, column_meta.get(col, {}))
        if fill_value is not None:
            extended_columns.append(col)

    out_rows: list[list[str]] = [extended_columns]
    for row in reader:
        padded = row + [""] * max(0, len(header) - len(row))
        out_row: list[str] = []
        for col in extended_columns:
            if col in header_index:
                cell = padded[header_index[col]]
            else:
                cell = ""
            meta = column_meta.get(col, {})
            if (not str(cell).strip() or str(cell).strip().lower() == "null") and meta.get(
                "is_nullable"
            ) == "NO":
                fill_value = _resolve_not_null_fill_value(col, meta)
                if fill_value is not None:
                    cell = fill_value
            out_row.append(cell)
        out_rows.append(out_row)

    from io import StringIO

    buffer = StringIO()
    writer = csv.writer(buffer, lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerows(out_rows)
    return extended_columns, buffer.getvalue()


def _force_not_null_columns_for_copy(
    use_columns: list[str],
    column_meta: dict[str, dict[str, Optional[str]]],
) -> list[str]:
    forced: list[str] = []
    for col in use_columns:
        meta = column_meta.get(col, {})
        if meta.get("is_nullable") == "NO" and _is_text_column(meta):
            forced.append(col)
    return forced


def _ensure_csv_field_limit() -> None:
    try:
        csv.field_size_limit(max(csv.field_size_limit(), 4 * 1024 * 1024))
    except OverflowError:
        csv.field_size_limit(4 * 1024 * 1024)


def infer_source_tenant_id_from_csv_map(table_csv_map: dict[str, str]) -> Optional[int]:
    """从备份 CSV 数据推断导出租户 ID（须唯一）。"""
    _ensure_csv_field_limit()

    found: set[int] = set()
    for csv_text in sorted(table_csv_map.values(), key=len):
        if not _csv_has_data_rows(csv_text):
            continue
        columns = _csv_header_columns(csv_text)
        if "tenant_id" not in columns:
            continue
        tenant_idx = columns.index("tenant_id")
        for line in csv_text.splitlines()[1:]:
            if not line.strip():
                continue
            row = next(csv.reader([line]))
            if tenant_idx < len(row) and row[tenant_idx].strip().isdigit():
                found.add(int(row[tenant_idx]))
                break
    if not found:
        return None
    if len(found) > 1:
        raise ValueError(
            f"备份 CSV 中存在多个 tenant_id（{sorted(found)}），无法安全恢复"
        )
    return next(iter(found))


def infer_source_tenant_id_from_dump_path(dump_path: str) -> Optional[int]:
    raw = _parse_tenant_dump_sections(dump_path)
    filtered = {
        table: csv_text
        for table, csv_text in raw.items()
        if not _is_platform_level_table(table)
    }
    return infer_source_tenant_id_from_csv_map(filtered)


def infer_source_tenant_id_from_zip(zip_path: str) -> Optional[int]:
    with tempfile.TemporaryDirectory(prefix="backup_infer_") as tmpdir:
        dump_path = os.path.join(tmpdir, "database.dump")
        with zipfile.ZipFile(zip_path, "r") as zf:
            if "database.dump" not in zf.namelist():
                return None
            with zf.open("database.dump") as src, open(dump_path, "wb") as dst:
                shutil.copyfileobj(src, dst)
        return infer_source_tenant_id_from_dump_path(dump_path)


def resolve_restore_source_tenant_id(
    *,
    target_tenant_id: int,
    user_source: Optional[int] = None,
    metadata_source: Optional[int] = None,
    inferred_source: Optional[int] = None,
) -> int:
    """
    确定恢复用的源租户 ID，并校验用户填写与备份内容一致。
    导入前会将 CSV 中 tenant_id 重写为 target_tenant_id。
    """
    effective = user_source
    if effective is None:
        effective = metadata_source
    if effective is None:
        effective = inferred_source
    if effective is None:
        effective = target_tenant_id

    if inferred_source is not None:
        if user_source is not None and user_source != inferred_source:
            raise ValueError(
                f"填写的导出租户编号 {user_source} 与备份文件内数据（{inferred_source}）不一致，请核对后重试"
            )
        if metadata_source is not None and metadata_source != inferred_source:
            logger.warning(
                "备份元数据 source_tenant_id={} 与 CSV 推断 {} 不一致，以 CSV 为准",
                metadata_source,
                inferred_source,
            )
        effective = inferred_source

    return int(effective)


def _rewrite_csv_tenant_id(csv_text: str, target_tenant_id: int) -> str:
    _ensure_csv_field_limit()
    lines = csv_text.splitlines()
    if len(lines) <= 1:
        return csv_text
    reader = csv.reader(lines)
    header = next(reader, [])
    if "tenant_id" not in header:
        return csv_text
    tenant_idx = header.index("tenant_id")
    out_rows: list[list[str]] = [header]
    target_text = str(int(target_tenant_id))
    for row in reader:
        padded = row + [""] * max(0, len(header) - len(row))
        padded[tenant_idx] = target_text
        out_rows.append(padded[: len(header)])

    from io import StringIO

    buffer = StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerows(out_rows)
    return buffer.getvalue()


def _psql_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PGPASSWORD"] = infra_settings.DB_PASSWORD
    return env


def _psql_base_cmd() -> list[str]:
    return [
        "psql",
        "-h",
        infra_settings.DB_HOST,
        "-p",
        str(infra_settings.DB_PORT),
        "-U",
        infra_settings.DB_USER,
        "-d",
        infra_settings.DB_NAME,
        "-v",
        "ON_ERROR_STOP=1",
    ]


def _prepare_csv_for_import(
    table: str,
    csv_text: str,
    *,
    target_tenant_id: int,
    table_columns: Optional[list[str]],
    column_meta: Optional[dict[str, dict[str, Optional[str]]]] = None,
) -> Optional[tuple[list[str], str]]:
    if not _csv_has_data_rows(csv_text):
        return None

    csv_text = _rewrite_csv_tenant_id(csv_text, target_tenant_id)
    csv_columns = _csv_header_columns(csv_text)
    if table_columns:
        allowed = set(table_columns)
        use_columns = [col for col in csv_columns if col in allowed]
        skipped = [col for col in csv_columns if col not in allowed]
        if skipped:
            logger.warning("表 {} CSV 列在目标库不存在，已忽略: {}", table, skipped)
        if not use_columns:
            logger.warning("表 {} CSV 列与目标库无交集，跳过", table)
            return None
        csv_text = _project_csv_to_columns(csv_text, use_columns)
        if not csv_text or not _csv_has_data_rows(csv_text):
            logger.warning("表 {} CSV 投影后为空，跳过", table)
            return None
        if column_meta is not None:
            use_columns, csv_text = _align_csv_to_target_schema(
                csv_text,
                use_columns,
                table_columns,
                column_meta,
            )
        return use_columns, csv_text
    return csv_columns, csv_text


def _sql_literal(value: str) -> str:
    text = value.strip()
    if not text or text.lower() == "null":
        return "NULL"
    if text.lstrip("-").isdigit():
        return text
    return "'" + text.replace("'", "''") + "'"


def _batched(values: list[str], size: int) -> list[list[str]]:
    return [values[i : i + size] for i in range(0, len(values), size)]


def _extract_csv_column_values(csv_text: str, column: str) -> list[str]:
    columns = _csv_header_columns(csv_text)
    if column not in columns:
        return []
    col_idx = columns.index(column)
    _ensure_csv_field_limit()
    values: list[str] = []
    for row in csv.reader(csv_text.splitlines()[1:]):
        if col_idx < len(row):
            cell = row[col_idx].strip()
            if cell:
                values.append(cell)
    return values


def _append_pk_conflict_deletes(
    script_lines: list[str],
    table: str,
    csv_text: str,
    pk_columns: list[str],
) -> None:
    """
    按 CSV 主键值删除已有行，避免上次失败残留（错误 tenant_id）导致 COPY 主键冲突。
    """
    if not pk_columns:
        return

    header = _csv_header_columns(csv_text)
    if len(pk_columns) == 1:
        col = pk_columns[0]
        if col not in header:
            return
        values = list(dict.fromkeys(_extract_csv_column_values(csv_text, col)))
        if not values:
            return
        for batch in _batched(values, 500):
            literals = ", ".join(_sql_literal(v) for v in batch)
            script_lines.append(f'DELETE FROM "{table}" WHERE "{col}" IN ({literals});')
        return

    missing = [col for col in pk_columns if col not in header]
    if missing:
        logger.warning("表 {} 备份 CSV 缺少主键列 {}，跳过按主键清理", table, missing)
        return

    _ensure_csv_field_limit()
    col_indexes = [header.index(col) for col in pk_columns]
    tuples: list[tuple[str, ...]] = []
    seen: set[tuple[str, ...]] = set()
    for row in csv.reader(csv_text.splitlines()[1:]):
        padded = row + [""] * max(0, len(header) - len(row))
        key = tuple(padded[idx].strip() for idx in col_indexes)
        if any(not part for part in key) or key in seen:
            continue
        seen.add(key)
        tuples.append(key)

    if not tuples:
        return

    col_sql = ", ".join(f'"{col}"' for col in pk_columns)
    for batch in _batched(list(tuples), 200):
        value_groups = ", ".join(
            "(" + ", ".join(_sql_literal(part) for part in key) + ")" for key in batch
        )
        script_lines.append(
            f'DELETE FROM "{table}" WHERE ({col_sql}) IN ({value_groups});'
        )


def _append_fk_orphan_cleanup(
    script_lines: list[str],
    *,
    fk_rows: list[dict[str, Any]],
    import_tables: set[str],
    tenant_ids: set[int],
    table_column_map: dict[str, list[str]],
) -> None:
    """删除租户范围内引用已不存在父表行的孤儿数据（源库可能存在的历史脏数据）。"""
    tenant_sql = ", ".join(str(t) for t in sorted(tenant_ids))
    for row in fk_rows:
        child = row.get("child_table")
        parent = row.get("parent_table")
        child_col = row.get("child_column")
        parent_col = row.get("parent_column")
        if not child or not parent or not child_col or not parent_col:
            continue
        if child not in import_tables:
            continue
        if "tenant_id" not in table_column_map.get(child, []):
            continue
        script_lines.append(
            f'DELETE FROM "{child}" c WHERE c.tenant_id IN ({tenant_sql}) '
            f'AND c."{child_col}" IS NOT NULL '
            f'AND NOT EXISTS ('
            f'SELECT 1 FROM "{parent}" p WHERE p."{parent_col}" = c."{child_col}"'
            f");"
        )


def _append_drop_import_table_fk_constraints(
    script_lines: list[str],
    fk_constraints: list[dict[str, Any]],
) -> None:
    for row in fk_constraints:
        child_table = row.get("child_table")
        constraint_name = row.get("constraint_name")
        if not child_table or not constraint_name:
            continue
        script_lines.append(
            f'ALTER TABLE "{child_table}" DROP CONSTRAINT IF EXISTS "{constraint_name}";'
        )


def _append_restore_import_table_fk_constraints(
    script_lines: list[str],
    fk_constraints: list[dict[str, Any]],
) -> None:
    for row in fk_constraints:
        child_table = row.get("child_table")
        constraint_name = row.get("constraint_name")
        constraint_def = row.get("constraint_def")
        if not child_table or not constraint_name or not constraint_def:
            continue
        script_lines.append(
            f'ALTER TABLE "{child_table}" ADD CONSTRAINT "{constraint_name}" {constraint_def};'
        )


def _append_serial_sequence_resets(
    script_lines: list[str],
    import_tables: set[str],
    table_pk_map: dict[str, list[str]],
) -> None:
    for table in sorted(import_tables):
        if table_pk_map.get(table) != ["id"]:
            continue
        script_lines.append(
            f"DO $$ DECLARE seq regclass; BEGIN "
            f"seq := pg_get_serial_sequence('\"{table}\"', 'id'); "
            f"IF seq IS NOT NULL THEN "
            f"PERFORM setval(seq, GREATEST(COALESCE((SELECT MAX(id) FROM \"{table}\"), 1), 1), true); "
            f"END IF; END $$;"
        )


def _run_tenant_restore_transaction(
    *,
    delete_order: list[str],
    insert_order: list[str],
    import_plan: dict[str, tuple[list[str], str]],
    target_tenant_id: int,
    source_tenant_id: int,
    table_pk_map: dict[str, list[str]],
    table_column_meta: dict[str, dict[str, dict[str, Optional[str]]]],
    table_column_map: dict[str, list[str]],
    fk_rows: list[dict[str, Any]],
    fk_constraints: list[dict[str, Any]],
) -> None:
    """
    在单个 psql 事务中执行 DELETE + COPY；任一步失败则整批回滚，避免只删不导。

    导入前临时 DROP 导入表上的外键（无需 superuser），COPY 完成后清理孤儿行并重建外键。
    """
    tenant_ids_to_clear = {int(target_tenant_id)}
    if int(source_tenant_id) != int(target_tenant_id):
        tenant_ids_to_clear.add(int(source_tenant_id))
    import_tables = set(import_plan.keys())

    with tempfile.TemporaryDirectory(prefix="tenant_restore_") as tmpdir:
        script_lines: list[str] = ["BEGIN;"]
        _append_drop_import_table_fk_constraints(script_lines, fk_constraints)
        for table in delete_order:
            for tenant_id in sorted(tenant_ids_to_clear):
                script_lines.append(
                    f'DELETE FROM "{table}" WHERE tenant_id = {int(tenant_id)};'
                )

        for table in insert_order:
            payload = import_plan.get(table)
            if not payload:
                continue
            use_columns, csv_text = payload
            _append_pk_conflict_deletes(
                script_lines,
                table,
                csv_text,
                table_pk_map.get(table, []),
            )
            csv_path = os.path.join(tmpdir, f"{table}.csv")
            with open(csv_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(csv_text if csv_text.endswith("\n") else f"{csv_text}\n")
            column_sql = ", ".join(f'"{col}"' for col in use_columns)
            psql_path = csv_path.replace("\\", "/")
            force_not_null = _force_not_null_columns_for_copy(
                use_columns,
                table_column_meta.get(table, {}),
            )
            force_sql = ""
            if force_not_null:
                force_cols = ", ".join(f'"{col}"' for col in force_not_null)
                force_sql = f", FORCE_NOT_NULL ({force_cols})"
            script_lines.append(
                f'\\copy "{table}" ({column_sql}) FROM \'{psql_path}\' '
                f"WITH (FORMAT CSV, HEADER, ENCODING 'UTF8'{force_sql});"
            )

        _append_fk_orphan_cleanup(
            script_lines,
            fk_rows=fk_rows,
            import_tables=import_tables,
            tenant_ids=tenant_ids_to_clear,
            table_column_map=table_column_map,
        )
        _append_restore_import_table_fk_constraints(script_lines, fk_constraints)
        _append_serial_sequence_resets(script_lines, import_tables, table_pk_map)
        script_lines.append("COMMIT;")
        script_path = os.path.join(tmpdir, "restore.sql")
        with open(script_path, "w", encoding="utf-8") as f:
            f.write("\n".join(script_lines))
            f.write("\n")

        cmd = [*_psql_base_cmd(), "-f", script_path]
        result = subprocess.run(cmd, env=_psql_env(), capture_output=True, text=True)
        if result.returncode != 0:
            err = (result.stderr or result.stdout or "").strip()
            raise RuntimeError(f"租户级恢复事务失败（已回滚）: {err[:2000]}")


def _run_psql_copy_from_stdin(
    table: str,
    csv_text: str,
    *,
    table_columns: Optional[list[str]] = None,
) -> None:
    if not _csv_has_data_rows(csv_text):
        logger.info("表 {} 无数据行，跳过导入", table)
        return

    db_user = infra_settings.DB_USER
    db_password = infra_settings.DB_PASSWORD
    db_host = infra_settings.DB_HOST
    db_port = infra_settings.DB_PORT
    db_name = infra_settings.DB_NAME
    env = os.environ.copy()
    env["PGPASSWORD"] = db_password

    csv_columns = _csv_header_columns(csv_text)
    if table_columns:
        allowed = set(table_columns)
        use_columns = [col for col in csv_columns if col in allowed]
        skipped = [col for col in csv_columns if col not in allowed]
        if skipped:
            logger.warning("表 {} CSV 列在目标库不存在，已忽略: {}", table, skipped)
        if not use_columns:
            logger.warning("表 {} CSV 列与目标库无交集，跳过", table)
            return
        csv_text = _project_csv_to_columns(csv_text, use_columns)
        if not csv_text:
            logger.warning("表 {} CSV 投影后为空，跳过", table)
            return
        column_sql = ", ".join(f'"{col}"' for col in use_columns)
        copy_sql = (
            f'COPY "{table}" ({column_sql}) '
            "FROM STDIN WITH (FORMAT CSV, HEADER, ENCODING 'UTF8')"
        )
    else:
        copy_sql = f'COPY "{table}" FROM STDIN WITH (FORMAT CSV, HEADER, ENCODING \'UTF8\')'

    cmd = [
        "psql",
        "-h",
        db_host,
        "-p",
        str(db_port),
        "-U",
        db_user,
        "-d",
        db_name,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        copy_sql,
    ]
    result = subprocess.run(
        cmd,
        env=env,
        input=csv_text,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"导入表 {table} 失败: {err[:2000]}")


async def restore_tenant_backup_from_dump(
    *,
    dump_path: str,
    target_tenant_id: int,
    source_tenant_id: Optional[int],
) -> int:
    """
    恢复租户级备份（覆盖目标租户业务数据）。

    支持跨系统迁移：CSV 内 tenant_id 会先统一重写为 target_tenant_id 再导入。
    DELETE + COPY 在同一 psql 事务中执行，失败时自动回滚，避免只删不导。
    返回备份 CSV 中推断的源租户 ID（用于 uploads 路径映射）。
    """

    raw_table_csv_map = _parse_tenant_dump_sections(dump_path)
    table_csv_map = {
        table: csv_text
        for table, csv_text in raw_table_csv_map.items()
        if not _is_platform_level_table(table)
    }
    skipped_platform_tables = sorted(set(raw_table_csv_map.keys()) - set(table_csv_map.keys()))
    if skipped_platform_tables:
        logger.warning("租户级恢复跳过平台级表: {}", skipped_platform_tables)

    if not table_csv_map:
        raise ValueError("租户备份数据为空，无法恢复")

    inferred_source = infer_source_tenant_id_from_csv_map(table_csv_map)
    effective_source = resolve_restore_source_tenant_id(
        target_tenant_id=target_tenant_id,
        user_source=source_tenant_id,
        metadata_source=None,
        inferred_source=inferred_source,
    )
    logger.info(
        "租户级恢复租户映射: source={} -> target={} (inferred={})",
        effective_source,
        target_tenant_id,
        inferred_source,
    )

    for table, csv_text in table_csv_map.items():
        if not _csv_has_data_rows(csv_text):
            continue
        _validate_csv_header(table, csv_text)

    conn = Tortoise.get_connection("default")
    table_names = sorted(table_csv_map.keys())

    columns_sql = """
        SELECT table_name, column_name, is_nullable, column_default, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position
    """
    column_rows = await conn.execute_query_dict(columns_sql, [table_names])
    table_column_map: dict[str, list[str]] = defaultdict(list)
    table_column_meta: dict[str, dict[str, dict[str, Optional[str]]]] = defaultdict(dict)
    for row in column_rows:
        table_name = row.get("table_name")
        column_name = row.get("column_name")
        if table_name and column_name:
            table_column_map[table_name].append(column_name)
            table_column_meta[table_name][column_name] = {
                "is_nullable": row.get("is_nullable"),
                "column_default": row.get("column_default"),
                "data_type": row.get("data_type"),
                "udt_name": row.get("udt_name"),
            }

    missing_tables = [table for table in table_names if table not in table_column_map]
    if missing_tables:
        logger.warning("目标库不存在以下备份表，已跳过: {}", missing_tables)
        for table in missing_tables:
            table_csv_map.pop(table, None)

    table_names = sorted(table_csv_map.keys())
    if not table_names:
        raise ValueError("备份中的表在目标库均不存在，无法恢复")

    fk_sql = """
        SELECT
            tc.table_name AS child_table,
            kcu.column_name AS child_column,
            ccu.table_name AS parent_table,
            ccu.column_name AS parent_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name = kcu.table_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
    """
    fk_rows = await conn.execute_query_dict(fk_sql)
    insert_order, delete_order = _build_topological_table_orders(table_names, fk_rows)

    pk_sql = """
        SELECT tc.table_name, kcu.column_name, kcu.ordinal_position
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name = kcu.table_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = ANY($1::text[])
        ORDER BY tc.table_name, kcu.ordinal_position
    """
    pk_rows = await conn.execute_query_dict(pk_sql, [table_names])
    table_pk_map: dict[str, list[str]] = defaultdict(list)
    for row in pk_rows:
        table_name = row.get("table_name")
        column_name = row.get("column_name")
        if table_name and column_name:
            table_pk_map[table_name].append(column_name)

    import_plan: dict[str, tuple[list[str], str]] = {}
    for table in insert_order:
        csv_text = table_csv_map.get(table)
        if not csv_text:
            continue
        prepared = _prepare_csv_for_import(
            table,
            csv_text,
            target_tenant_id=target_tenant_id,
            table_columns=table_column_map.get(table),
            column_meta=table_column_meta.get(table),
        )
        if prepared:
            import_plan[table] = prepared

    if not import_plan:
        raise ValueError("备份中没有可导入的业务数据（可能全部表为空或与目标库结构不兼容）")

    fk_constraint_sql = """
        SELECT
            con.conname AS constraint_name,
            rel.relname AS child_table,
            pg_get_constraintdef(con.oid) AS constraint_def
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = con.connamespace
        WHERE con.contype = 'f'
          AND nsp.nspname = 'public'
          AND rel.relname = ANY($1::text[])
        ORDER BY rel.relname, con.conname
    """
    fk_constraints = await conn.execute_query_dict(
        fk_constraint_sql, [sorted(import_plan.keys())]
    )
    logger.info(
        "租户级恢复将临时移除外键约束 {} 个（导入完成后重建）",
        len(fk_constraints),
    )

    logger.info(
        "租户级恢复开始: target_tenant_id={}, tables={}, importable={}",
        target_tenant_id,
        len(table_names),
        len(import_plan),
    )

    _run_tenant_restore_transaction(
        delete_order=delete_order,
        insert_order=insert_order,
        import_plan=import_plan,
        target_tenant_id=target_tenant_id,
        source_tenant_id=effective_source,
        table_pk_map=dict(table_pk_map),
        table_column_meta=dict(table_column_meta),
        table_column_map=dict(table_column_map),
        fk_rows=fk_rows if isinstance(fk_rows, list) else [],
        fk_constraints=fk_constraints if isinstance(fk_constraints, list) else [],
    )

    logger.info(
        "租户级恢复完成: target_tenant_id={}, imported_tables={}",
        target_tenant_id,
        len(import_plan),
    )
    return effective_source


def run_pg_restore(dump_path: str, backup_scope: str) -> None:
    """执行 pg_restore 恢复数据库（全量）。"""
    if backup_scope == "tenant":
        raise NotImplementedError("租户隔离备份的自动恢复暂未实现，请使用全量备份或手动恢复")

    db_user = infra_settings.DB_USER
    db_password = infra_settings.DB_PASSWORD
    db_host = infra_settings.DB_HOST
    db_port = infra_settings.DB_PORT
    db_name = infra_settings.DB_NAME
    env = os.environ.copy()
    env["PGPASSWORD"] = db_password

    check_cmd = ["pg_restore", "-l", "-h", db_host, "-p", str(db_port), "-U", db_user, dump_path]
    check = subprocess.run(check_cmd, env=env, capture_output=True, text=True)
    if check.returncode != 0:
        raise ValueError("备份文件不是 pg_dump 格式，可能为租户隔离备份。请使用全量备份恢复。")

    drop_sql = """
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO postgres;
        GRANT ALL ON SCHEMA public TO public;
    """
    drop_cmd = [
        "psql",
        "-h",
        db_host,
        "-p",
        str(db_port),
        "-U",
        db_user,
        "-d",
        db_name,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        drop_sql.strip(),
    ]
    logger.info("清空 public schema (DROP CASCADE)...")
    drop_result = subprocess.run(drop_cmd, env=env, capture_output=True, text=True, timeout=60)
    if drop_result.returncode != 0:
        raise RuntimeError(f"清空 schema 失败: {drop_result.stderr or drop_result.stdout}")

    cmd = [
        "pg_restore",
        "-h",
        db_host,
        "-p",
        str(db_port),
        "-U",
        db_user,
        "-d",
        db_name,
        "--no-owner",
        "--no-acl",
        "-v",
        dump_path,
    ]
    logger.info(f"执行 pg_restore: {' '.join(cmd[:8])}...")
    try:
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=1800)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("pg_restore 超时（30分钟），数据库可能过大") from exc
    if result.returncode != 0:
        err_msg = result.stderr or result.stdout or "无输出"
        raise RuntimeError(f"pg_restore 失败 (exit={result.returncode}): {err_msg[:2000]}")


def restore_uploads_from_zip(zip_path: str, extract_dir: str) -> None:
    """从备份 zip 恢复 uploads 目录到配置的上传目录（全量备份）"""
    upload_dir = infra_settings.FILE_UPLOAD_DIR
    if not upload_dir:
        return
    upload_dir = os.path.abspath(upload_dir)
    uploads_in_zip = "uploads/"
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            names = [n for n in zf.namelist() if n.startswith(uploads_in_zip)]
            if not names:
                logger.info("备份中无 uploads 目录，跳过")
                return
            for name in names:
                zf.extract(name, extract_dir)
            src = os.path.join(extract_dir, "uploads")
            if os.path.exists(src):
                os.makedirs(upload_dir, exist_ok=True)
                for item in os.listdir(src):
                    s = os.path.join(src, item)
                    d = os.path.join(upload_dir, item)
                    if os.path.isdir(s):
                        if os.path.exists(d):
                            shutil.rmtree(d)
                        shutil.copytree(s, d)
                    else:
                        shutil.copy2(s, d)
                logger.info(f"已恢复 uploads 到 {upload_dir}")
    except Exception as e:
        logger.warning(f"恢复 uploads 失败: {e}")


def restore_tenant_uploads_from_zip(
    zip_path: str,
    extract_dir: str,
    target_tenant_id: int,
    source_tenant_id: Optional[int] = None,
) -> None:
    """从租户级备份 zip 恢复 uploads 子目录（不影响其他租户）。

    跨租户迁移时从 uploads/{source_tenant_id}/ 读取，写入 uploads/{target_tenant_id}/。
    """
    upload_dir = infra_settings.FILE_UPLOAD_DIR
    if not upload_dir:
        logger.info("未配置 FILE_UPLOAD_DIR，跳过租户 uploads 恢复")
        return

    upload_dir = os.path.abspath(upload_dir)
    upload_source_id = source_tenant_id if source_tenant_id is not None else target_tenant_id
    tenant_prefix = f"uploads/{upload_source_id}/"

    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            names = [n for n in zf.namelist() if n.startswith(tenant_prefix)]
            if not names:
                logger.info("备份中无租户 uploads/{}，跳过", upload_source_id)
                return
            for name in names:
                zf.extract(name, extract_dir)

        src = os.path.join(extract_dir, "uploads", str(upload_source_id))
        if not os.path.isdir(src):
            logger.info("解压后未发现租户 uploads 目录: {}", src)
            return

        dest = os.path.join(upload_dir, str(target_tenant_id))
        if os.path.exists(dest):
            shutil.rmtree(dest)
        shutil.copytree(src, dest)
        logger.info("已恢复租户 uploads: {} -> {}", src, dest)
    except Exception as e:
        raise RuntimeError(f"恢复租户 uploads 失败: {e}") from e
