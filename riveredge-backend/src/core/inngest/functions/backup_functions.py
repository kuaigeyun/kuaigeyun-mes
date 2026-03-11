"""
数据备份与恢复 Inngest 函数

处理后台的数据库转储、文件打包和数据恢复任务。
支持导出/导入时租户 ID 替换：恢复时若 source_tenant_id != target_tenant_id，自动替换所有 tenant_id。
"""

import os
import json
import subprocess
import zipfile
import shutil
from datetime import datetime
from loguru import logger
from inngest import Step, TriggerEvent
import inngest

from core.inngest.client import inngest_client
from core.models.data_backup import DataBackup
from infra.config.infra_config import infra_settings


@inngest_client.create_function(
    fn_id="data_backup_workflow",
    trigger=TriggerEvent(event="database/backup.requested"),
)
async def data_backup_workflow(ctx: inngest.Context, step: Step):
    """
    数据备份工作流
    
    1. 更新记录状态为 running
    2. 执行 pg_dump 导出数据库
    3. 打包 uploads 目录 (如果是全量备份)
    4. 压缩为最终 zip 文件
    5. 更新记录状态和文件信息
    """
    event_data = ctx.event.data
    backup_uuid = event_data.get("backup_uuid")
    tenant_id = event_data.get("tenant_id")
    backup_type = event_data.get("backup_type", "full")
    
    # 获取备份记录
    backup = await DataBackup.get(uuid=backup_uuid)
    backup.status = "running"
    backup.started_at = datetime.now()
    backup.inngest_run_id = ctx.run_id
    await backup.save()
    
    # 使用绝对路径，避免 Inngest 多步执行时不同请求的工作目录不一致导致文件找不到
    backup_dir = os.path.abspath("backups")
    os.makedirs(backup_dir, exist_ok=True)
    temp_dir = os.path.join(backup_dir, f"temp_{backup_uuid}")
    db_dump_file = os.path.join(temp_dir, "db_dump.dump")
    
    try:
        # 将 dump 和 zip 合并为单一步骤：Inngest 的 step.run 可能在不同 HTTP 请求中执行，
        # 第二次请求会跳过已完成的 step，导致 create_zip 在另一进程中找不到 dump 生成的文件
        def dump_and_create_zip():
            # 获取数据库连接配置
            db_user = infra_settings.DB_USER
            db_password = infra_settings.DB_PASSWORD
            db_host = infra_settings.DB_HOST
            db_port = infra_settings.DB_PORT
            db_name = infra_settings.DB_NAME
            
            env = os.environ.copy()
            env["PGPASSWORD"] = db_password
            
            os.makedirs(temp_dir, exist_ok=True)
            
            backup_scope = event_data.get("backup_scope", "full")
            if backup_scope == "tenant" and tenant_id:
                # 租户隔离备份：仅备份该租户的数据
                logger.info(f"开始执行租户隔离备份: tenant_id={tenant_id}")
                db_dump_path = os.path.join(temp_dir, "db_dump.sql")
                
                get_tables_cmd = [
                    "psql",
                    "-h", db_host,
                    "-p", str(db_port),
                    "-U", db_user,
                    "-d", db_name,
                    "-t",
                    "-c", f"SELECT table_name FROM information_schema.columns WHERE column_name = 'tenant_id' AND table_schema = 'public'"
                ]
                result = subprocess.run(get_tables_cmd, env=env, capture_output=True, text=True)
                if result.returncode != 0:
                    raise Exception(f"获取表列表失败: {result.stderr}")
                
                tables = [t.strip() for t in result.stdout.split('\n') if t.strip()]
                logger.info(f"发现 {len(tables)} 个租户相关表: {tables}")
                
                with open(db_dump_path, "w", encoding="utf-8") as f:
                    f.write("-- Tenant Isolated Backup\n")
                    f.write(f"-- Tenant ID: {tenant_id}\n")
                    f.write(f"-- Date: {datetime.now()}\n\n")
                    
                    for table in tables:
                        copy_cmd = [
                            "psql",
                            "-h", db_host,
                            "-p", str(db_port),
                            "-U", db_user,
                            "-d", db_name,
                            "-c", f"COPY (SELECT * FROM \"{table}\" WHERE tenant_id = {tenant_id}) TO STDOUT WITH (FORMAT CSV, HEADER, ENCODING 'UTF8')"
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
                # 全量备份：执行 pg_dump
                cmd = [
                    "pg_dump",
                    "-h", db_host,
                    "-p", str(db_port),
                    "-U", db_user,
                    "-F", "c",  # 自定义格式 (压缩格式)
                    "-b",       # 包含大对象
                    "-v",       # 详细输出
                    "-f", db_dump_file,
                    db_name
                ]
                logger.info(f"执行数据库全量转储: {' '.join(cmd)}")
                result = subprocess.run(cmd, env=env, capture_output=True, text=True)
                if result.returncode != 0:
                    raise Exception(f"pg_dump 失败: {result.stderr}")
            
            # 打包为 zip（在同一执行上下文中，文件一定存在）
            final_zip_name = f"{backup.name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.zip"
            final_zip_path = os.path.join(backup_dir, final_zip_name)
            
            dump_path = db_dump_file if backup_scope != "tenant" else os.path.join(temp_dir, "db_dump.sql")
            with zipfile.ZipFile(final_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(dump_path, "database.dump")
                # 写入元数据：导出时的租户 ID，恢复时用于替换（若与目标租户不一致）
                metadata = {"source_tenant_id": backup.tenant_id, "backup_scope": backup_scope}
                zipf.writestr("backup_metadata.json", json.dumps(metadata, ensure_ascii=False, indent=2))
                if backup_type == "full":
                    upload_dir = infra_settings.FILE_UPLOAD_DIR
                    if upload_dir and os.path.exists(upload_dir):
                        for root, dirs, files in os.walk(upload_dir):
                            for file in files:
                                file_path = os.path.join(root, file)
                                arcname = os.path.join("uploads", os.path.relpath(file_path, upload_dir))
                                zipf.write(file_path, arcname)
            
            return final_zip_path

        final_zip_path = await step.run("dump_and_create_zip", dump_and_create_zip)
        
        # Step 3: 更新记录
        backup.status = "success"
        backup.completed_at = datetime.now()
        backup.file_path = final_zip_path
        backup.file_size = os.path.getsize(final_zip_path)
        await backup.save()
        
        logger.info(f"备份完成: {backup_uuid} -> {final_zip_path}")
        
    except Exception as e:
        logger.exception(f"备份任务失败: {e}")
        backup.status = "failed"
        backup.error_message = str(e)
        backup.completed_at = datetime.now()
        await backup.save()
    finally:
        # 清理临时目录
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


def _run_full_backup_dump_and_zip(backup_dir: str, temp_dir: str, backup_name: str) -> str:
    """
    执行全量备份（pg_dump + zip），返回最终 zip 路径。
    用于恢复前的自动备份。
    """
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
        "-h", db_host,
        "-p", str(db_port),
        "-U", db_user,
        "-F", "c",
        "-b",
        "-v",
        "-f", db_dump_file,
        db_name
    ]
    logger.info(f"执行恢复前备份: pg_dump ...")
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"pg_dump 失败: {result.stderr}")

    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    final_zip_name = f"{backup_name}_{ts}.zip"
    final_zip_path = os.path.join(backup_dir, final_zip_name)

    with zipfile.ZipFile(final_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(db_dump_file, "database.dump")
        upload_dir = infra_settings.FILE_UPLOAD_DIR
        if upload_dir and os.path.exists(upload_dir):
            for root, dirs, files in os.walk(upload_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.join("uploads", os.path.relpath(file_path, upload_dir))
                    zipf.write(file_path, arcname)

    return final_zip_path


async def _run_tenant_id_replacement(
    source_tenant_id: int,
    target_tenant_id: int,
) -> int:
    """
    恢复后替换租户 ID：将所有 tenant_id=source 的记录改为 target。
    导出时的租户 ID 与导入恢复时可能不一致，需替换以归属到当前租户。
    """
    if source_tenant_id == target_tenant_id:
        return 0
    from tortoise import Tortoise
    conn = Tortoise.get_connection("default")
    # 查询包含 tenant_id 的表
    tables_sql = """
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'tenant_id' AND table_schema = 'public'
    """
    tables_rows = await conn.execute_query_dict(tables_sql)
    tables = [r["table_name"] for r in (tables_rows if isinstance(tables_rows, list) else []) if r.get("table_name")]
    total_updated = 0
    for table in tables:
        try:
            update_sql = f'UPDATE "{table}" SET tenant_id = $1 WHERE tenant_id = $2'
            await conn.execute_query(update_sql, [target_tenant_id, source_tenant_id])
            total_updated += 1  # 表已处理
            logger.info(f"租户ID替换: {table} tenant_id {source_tenant_id} -> {target_tenant_id}")
        except Exception as e:
            logger.warning(f"租户ID替换跳过表 {table}: {e}")
    return total_updated


def _read_backup_metadata(zip_path: str) -> dict:
    """从备份 zip 读取 backup_metadata.json"""
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            if "backup_metadata.json" in zf.namelist():
                with zf.open("backup_metadata.json") as f:
                    return json.load(f)
    except Exception as e:
        logger.warning(f"读取备份元数据失败: {e}")
    return {}


def _run_pg_restore(dump_path: str, backup_scope: str) -> None:
    """
    执行 pg_restore 恢复数据库。
    仅支持全量备份（backup_scope=all）；租户隔离备份格式不同，暂不支持自动恢复。

    恢复策略：先 DROP SCHEMA public CASCADE 清空库（解决 --clean 无法 CASCADE 导致的依赖冲突），
    再 pg_restore 导入。避免 pg_restore --clean 因外键依赖顺序导致 DROP 失败、后续 CREATE 冲突。
    """
    if backup_scope == "tenant":
        raise NotImplementedError("租户隔离备份的自动恢复暂未实现，请使用全量备份或手动恢复")

    db_user = infra_settings.DB_USER
    db_password = infra_settings.DB_PASSWORD
    db_host = infra_settings.DB_HOST
    db_port = infra_settings.DB_PORT
    db_name = infra_settings.DB_NAME
    env = os.environ.copy()
    env["PGPASSWORD"] = db_password

    # 校验是否为 pg_dump 格式
    check_cmd = ["pg_restore", "-l", "-h", db_host, "-p", str(db_port), "-U", db_user, dump_path]
    check = subprocess.run(check_cmd, env=env, capture_output=True, text=True)
    if check.returncode != 0:
        raise ValueError("备份文件不是 pg_dump 格式，可能为租户隔离备份。请使用全量备份恢复。")

    # 先清空 public schema（CASCADE 解决外键依赖导致的 DROP 失败）
    # pg_restore --clean 的 DROP 不带 CASCADE，遇依赖会失败，导致后续 CREATE 冲突
    drop_sql = """
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO postgres;
        GRANT ALL ON SCHEMA public TO public;
    """
    drop_cmd = [
        "psql",
        "-h", db_host,
        "-p", str(db_port),
        "-U", db_user,
        "-d", db_name,
        "-v", "ON_ERROR_STOP=1",
        "-c", drop_sql.strip(),
    ]
    logger.info("清空 public schema (DROP CASCADE)...")
    drop_result = subprocess.run(drop_cmd, env=env, capture_output=True, text=True, timeout=60)
    if drop_result.returncode != 0:
        raise Exception(f"清空 schema 失败: {drop_result.stderr or drop_result.stdout}")

    # 不再使用 --clean，已通过 DROP SCHEMA 清空
    cmd = [
        "pg_restore",
        "-h", db_host,
        "-p", str(db_port),
        "-U", db_user,
        "-d", db_name,
        "--no-owner",
        "--no-acl",
        "-v",
        dump_path,
    ]
    logger.info(f"执行 pg_restore: {' '.join(cmd[:8])}...")
    try:
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=1800)
    except subprocess.TimeoutExpired:
        raise Exception("pg_restore 超时（30分钟），数据库可能过大")
    if result.returncode != 0:
        err_msg = result.stderr or result.stdout or "无输出"
        raise Exception(f"pg_restore 失败 (exit={result.returncode}): {err_msg[:2000]}")


def _restore_uploads_from_zip(zip_path: str, extract_dir: str) -> None:
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


@inngest_client.create_function(
    fn_id="data_restore_workflow",
    trigger=TriggerEvent(event="database/restore.requested"),
    retries=1,  # 恢复失败重试意义不大，减少等待
)
async def data_restore_workflow(ctx: inngest.Context, step: Step):
    """
    数据恢复工作流

    1. 若 create_pre_restore_backup=True，先创建恢复前备份（便于误覆盖时撤回）
    2. 解压备份文件
    3. 执行 pg_restore 恢复数据库
    """
    event_data = ctx.event.data
    backup_uuid = event_data.get("backup_uuid")
    target_tenant_id = event_data.get("target_tenant_id") or event_data.get("tenant_id")
    source_tenant_id = event_data.get("source_tenant_id")
    file_path = event_data.get("file_path")
    create_pre_restore = event_data.get("create_pre_restore_backup", True)

    backup_dir = os.path.abspath("backups")
    os.makedirs(backup_dir, exist_ok=True)

    zip_path = os.path.abspath(file_path) if file_path else ""
    # 从备份 zip 读取元数据，获取导出时的租户 ID（用于替换）
    if zip_path and os.path.exists(zip_path):
        metadata = _read_backup_metadata(zip_path)
        if source_tenant_id is None and metadata.get("source_tenant_id") is not None:
            source_tenant_id = metadata["source_tenant_id"]

    # Step 1: 恢复前自动备份
    if create_pre_restore:
        pre_restore_name = "恢复前备份"
        temp_dir = os.path.join(backup_dir, f"temp_pre_restore_{backup_uuid}")

        def do_pre_restore_backup():
            return _run_full_backup_dump_and_zip(backup_dir, temp_dir, pre_restore_name)

        try:
            final_zip_path = await step.run("create_pre_restore_backup", do_pre_restore_backup)

            pre_backup = await DataBackup.create(
                tenant_id=target_tenant_id,
                name=pre_restore_name,
                backup_type="full",
                backup_scope="all",
                status="success",
                source_type="generated",
                file_path=final_zip_path,
                file_size=os.path.getsize(final_zip_path),
                started_at=datetime.now(),
                completed_at=datetime.now(),
            )
            logger.info(f"已创建恢复前备份: {pre_backup.uuid} -> {final_zip_path}")
        except Exception as e:
            logger.exception(f"创建恢复前备份失败: {e}")
        finally:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

    # Step 2: 解压并执行 pg_restore 恢复数据库
    if not zip_path or not os.path.exists(zip_path):
        logger.error(f"备份文件不存在，无法恢复: {file_path}")
        return

    restore_extract_dir = os.path.join(backup_dir, f"temp_restore_{backup_uuid}")
    db_dump_path = None

    def extract_and_restore():
        nonlocal db_dump_path
        logger.info(f"开始恢复: zip_path={zip_path}, extract_dir={restore_extract_dir}")
        if not os.path.exists(zip_path):
            raise FileNotFoundError(f"备份文件不存在: {zip_path}")
        os.makedirs(restore_extract_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(restore_extract_dir)
        db_dump_path = os.path.join(restore_extract_dir, "database.dump")
        if not os.path.exists(db_dump_path):
            raise FileNotFoundError(f"备份中未找到 database.dump，zip 内容: {os.listdir(restore_extract_dir)}")

        metadata = _read_backup_metadata(zip_path)
        backup_scope = metadata.get("backup_scope", "all")
        logger.info(f"备份元数据: backup_scope={backup_scope}")

        if backup_scope == "tenant":
            raise NotImplementedError("租户隔离备份的自动恢复暂未实现，请使用全量备份")

        _run_pg_restore(db_dump_path, backup_scope)
        _restore_uploads_from_zip(zip_path, restore_extract_dir)
        logger.info("extract_and_restore 完成")

    try:
        await step.run("extract_and_restore", extract_and_restore)
    except Exception as e:
        logger.exception(f"备份恢复失败: {e}")
        if os.path.exists(restore_extract_dir):
            shutil.rmtree(restore_extract_dir, ignore_errors=True)
        return
    finally:
        if os.path.exists(restore_extract_dir):
            shutil.rmtree(restore_extract_dir, ignore_errors=True)

    # Step 3: 租户 ID 替换（若 source != target）
    if source_tenant_id is not None and source_tenant_id != target_tenant_id:
        try:
            tables_updated = await _run_tenant_id_replacement(source_tenant_id, target_tenant_id)
            logger.info(f"租户ID替换完成，共处理 {tables_updated} 个表")
        except Exception as e:
            logger.exception(f"租户ID替换失败: {e}")

    logger.info("数据恢复完成")
