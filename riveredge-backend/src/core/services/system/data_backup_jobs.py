"""
数据备份与恢复任务实现（同步/异步工具函数）

供后台事件处理器调用：pg_dump、打包 zip、pg_restore、租户 ID 替换等。
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import zipfile
from datetime import datetime
from typing import Any, Optional

from loguru import logger
from tortoise import Tortoise

from infra.config.infra_config import infra_settings


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

    backup_dir = os.path.abspath("backups")
    os.makedirs(backup_dir, exist_ok=True)
    temp_dir = os.path.join(backup_dir, f"temp_{backup_uuid}")
    db_dump_file = os.path.join(temp_dir, "db_dump.dump")

    os.makedirs(temp_dir, exist_ok=True)

    if backup_scope == "tenant" and tenant_id:
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

        tables = [t.strip() for t in result.stdout.split("\n") if t.strip()]
        logger.info(f"发现 {len(tables)} 个租户相关表: {tables}")

        with open(db_dump_path, "w", encoding="utf-8") as f:
            f.write("-- Tenant Isolated Backup\n")
            f.write(f"-- Tenant ID: {tenant_id}\n")
            f.write(f"-- Date: {datetime.now()}\n\n")

            for table in tables:
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
                    f'COPY (SELECT * FROM "{table}" WHERE tenant_id = {tenant_id}) TO STDOUT WITH (FORMAT CSV, HEADER, ENCODING \'UTF8\')',
                ]
                logger.debug(f"正在导出表: {table}")
                table_result = subprocess.run(copy_cmd, env=env, capture_output=True, text=True)
                if table_result.returncode == 0:
                    f.write(f"-- Data for table: {table}\n")
                    f.write(f"--- TABLE: {table} ---\n")
                    f.write(table_result.stdout)
                    f.write("\n\n")
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
        if r.get("table_name")
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
    """从备份 zip 恢复 uploads 目录到配置的上传目录"""
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
