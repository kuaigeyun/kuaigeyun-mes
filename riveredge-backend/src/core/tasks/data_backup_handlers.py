"""
数据备份 / 恢复事件处理器

通过 core.tasks.dispatcher 注册事件名 database/backup.requested 与 database/restore.requested，
由 DataBackupService 调用 dispatch_event 触发，在 worker 中执行。
"""

from __future__ import annotations

import os
import shutil
import zipfile
from datetime import datetime

from loguru import logger

from core.models.data_backup import DataBackup
from core.services.system.data_backup_jobs import (
    read_backup_metadata,
    restore_uploads_from_zip,
    run_backup_dump_and_zip_sync,
    run_full_backup_dump_and_zip,
    run_pg_restore,
    run_tenant_id_replacement,
)
from core.tasks.dispatcher import TaskContext, TaskStep, register_event_handler


async def handle_database_backup_requested(ctx: TaskContext, step: TaskStep) -> None:
    """数据备份：更新记录 -> dump+zip -> 更新成功/失败。"""
    event_data = ctx.event.data
    backup_uuid = event_data.get("backup_uuid")
    tenant_id = event_data.get("tenant_id")
    backup_type = event_data.get("backup_type", "full")
    backup_scope = event_data.get("backup_scope", "full")

    backup_dir = os.path.abspath("backups")
    os.makedirs(backup_dir, exist_ok=True)
    temp_dir = os.path.join(backup_dir, f"temp_{backup_uuid}")
    backup = None

    try:
        backup = await DataBackup.get(uuid=backup_uuid)
    except Exception as e:
        logger.exception(f"备份任务无法加载记录（例如 ORM 未初始化）: {e}")
        return

    try:
        backup.status = "running"
        backup.started_at = datetime.now()
        backup.inngest_run_id = ctx.run_id
        await backup.save()
    except Exception as e:
        logger.exception(f"备份任务进入 running 状态失败: {e}")
        return

    try:

        def dump_and_create_zip() -> str:
            return run_backup_dump_and_zip_sync(
                backup_uuid=str(backup_uuid),
                backup_name=backup.name,
                source_tenant_id=backup.tenant_id,
                tenant_id=tenant_id,
                backup_type=backup_type,
                backup_scope=backup_scope,
            )

        final_zip_path = await step.run("dump_and_create_zip", dump_and_create_zip)

        backup.status = "success"
        backup.completed_at = datetime.now()
        backup.file_path = final_zip_path
        backup.file_size = os.path.getsize(final_zip_path)
        await backup.save()
        logger.info(f"备份完成: {backup_uuid} -> {final_zip_path}")
    except Exception as e:
        logger.exception(f"备份任务失败: {e}")
        if backup is not None:
            backup.status = "failed"
            backup.error_message = str(e)
            backup.completed_at = datetime.now()
            try:
                await backup.save()
            except Exception as save_e:
                logger.error(f"写入备份失败状态异常: {save_e}")
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


async def handle_database_restore_requested(ctx: TaskContext, step: TaskStep) -> None:
    """数据恢复：可选恢复前备份 -> 解压并 pg_restore -> 租户 ID 替换。"""
    event_data = ctx.event.data
    backup_uuid = event_data.get("backup_uuid")
    target_tenant_id = event_data.get("target_tenant_id") or event_data.get("tenant_id")
    source_tenant_id = event_data.get("source_tenant_id")
    file_path = event_data.get("file_path")
    create_pre_restore = event_data.get("create_pre_restore_backup", True)

    backup_dir = os.path.abspath("backups")
    os.makedirs(backup_dir, exist_ok=True)

    zip_path = os.path.abspath(file_path) if file_path else ""
    if zip_path and os.path.exists(zip_path):
        metadata = read_backup_metadata(zip_path)
        if source_tenant_id is None and metadata.get("source_tenant_id") is not None:
            source_tenant_id = metadata["source_tenant_id"]

    if create_pre_restore:
        pre_restore_name = "恢复前备份"
        temp_dir = os.path.join(backup_dir, f"temp_pre_restore_{backup_uuid}")

        def do_pre_restore_backup() -> str:
            return run_full_backup_dump_and_zip(backup_dir, temp_dir, pre_restore_name)

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
                shutil.rmtree(temp_dir, ignore_errors=True)

    if not zip_path or not os.path.exists(zip_path):
        logger.error(f"备份文件不存在，无法恢复: {file_path}")
        return

    restore_extract_dir = os.path.join(backup_dir, f"temp_restore_{backup_uuid}")

    def extract_and_restore() -> None:
        logger.info(f"开始恢复: zip_path={zip_path}, extract_dir={restore_extract_dir}")
        if not os.path.exists(zip_path):
            raise FileNotFoundError(f"备份文件不存在: {zip_path}")
        os.makedirs(restore_extract_dir, exist_ok=True)

        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(restore_extract_dir)
        db_dump_path = os.path.join(restore_extract_dir, "database.dump")
        if not os.path.exists(db_dump_path):
            raise FileNotFoundError(
                f"备份中未找到 database.dump，zip 内容: {os.listdir(restore_extract_dir)}"
            )

        metadata = read_backup_metadata(zip_path)
        backup_scope = metadata.get("backup_scope", "all")
        logger.info(f"备份元数据: backup_scope={backup_scope}")

        if backup_scope == "tenant":
            raise NotImplementedError("租户隔离备份的自动恢复暂未实现，请使用全量备份")

        run_pg_restore(db_dump_path, backup_scope)
        restore_uploads_from_zip(zip_path, restore_extract_dir)
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

    if source_tenant_id is not None and source_tenant_id != target_tenant_id:
        try:
            tables_updated = await run_tenant_id_replacement(source_tenant_id, target_tenant_id)
            logger.info(f"租户ID替换完成，共处理 {tables_updated} 个表")
        except Exception as e:
            logger.exception(f"租户ID替换失败: {e}")

    logger.info("数据恢复完成")


_handlers_registered = False


def register_data_backup_handlers() -> None:
    """注册备份相关事件（幂等，避免热重载或重复 import 时重复注册）。"""
    global _handlers_registered
    if _handlers_registered:
        return
    _handlers_registered = True
    register_event_handler("database/backup.requested", handle_database_backup_requested)
    register_event_handler("database/restore.requested", handle_database_restore_requested)
