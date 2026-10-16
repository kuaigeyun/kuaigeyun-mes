"""
数据备份服务模块

提供数据备份的创建、查询、删除和恢复功能。
"""

import os
from uuid import uuid4
import shutil
import asyncio
from typing import List, Tuple, Optional
from datetime import datetime, timedelta
from loguru import logger
from tortoise.exceptions import DoesNotExist
from tortoise.expressions import Q

from core.models.data_backup import DataBackup
from core.services.system.backup_storage import (
    resolve_backup_file_path,
    resolve_data_backup_dir,
    store_backup_file_path,
)
from core.schemas.data_backup import DataBackupCreate
from core.tasks.dispatcher import TaskEvent, dispatch_event, execute_event_handlers
from core.utils.timezone_utils import resolve_business_datetime


class DataBackupService:
    """
    数据备份服务类
    
    管理数据备份记录，并触发后台备份/恢复任务。
    """
    
    @staticmethod
    def _flatten_exception_message(exc: Exception) -> str:
        """
        展开异常链，返回最有价值的根因信息。
        """
        parts: list[str] = []
        visited: set[int] = set()
        current: Optional[BaseException] = exc
        while current is not None and id(current) not in visited:
            visited.add(id(current))
            text = str(current).strip()
            if text and text not in parts:
                parts.append(text)
            current = current.__cause__ or current.__context__
        return " | ".join(parts) if parts else exc.__class__.__name__

    @staticmethod
    def backup_visible_to_user(
        backup: DataBackup,
        tenant_id: Optional[int],
        *,
        is_infra_admin: bool,
    ) -> bool:
        # 全平台包仅平台管理员；指定组织包 = 归属组织 + 平台管理员
        if is_infra_admin:
            return True
        if backup.backup_scope == "all" or backup.tenant_id is None:
            return False
        return tenant_id is not None and backup.tenant_id == tenant_id

    @staticmethod
    async def get_backups(
        tenant_id: Optional[int],
        page: int = 1,
        page_size: int = 20,
        backup_type: Optional[str] = None,
        backup_scope: Optional[str] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        *,
        is_infra_admin: bool = False,
    ) -> Tuple[List[DataBackup], int]:
        """
        获取备份列表
        """
        if is_infra_admin:
            query = DataBackup.all()
        else:
            # 组织侧：仅本组织非全平台包；全平台包不对组织用户暴露
            query = DataBackup.filter(tenant_id=tenant_id).exclude(backup_scope="all")

        if backup_type:
            query = query.filter(backup_type=backup_type)
        if backup_scope:
            query = query.filter(backup_scope=backup_scope)
        if status:
            query = query.filter(status=status)
        kw = (keyword or "").strip()
        if kw:
            query = query.filter(name__icontains=kw)

        total = await query.count()
        items = await query.order_by("-created_at").offset((page - 1) * page_size).limit(page_size).all()

        return items, total

    @staticmethod
    def resolve_source_tenant_id(backup: DataBackup, *, read_zip_meta: bool = False) -> Optional[int]:
        """
        解析导出租户 ID，供列表/详情展示。

        禁止在列表路径解压 database.dump：全平台包可达数百 MB，
        infer_source_tenant_id_from_zip 会拖死 API 与页面轮询。
        恢复时再走 dump 推断（restore_backup 内已单独调用）。
        """
        if backup.backup_scope == "all":
            return None
        if read_zip_meta and backup.file_path:
            from core.services.system.data_backup_jobs import read_backup_metadata

            resolved = resolve_backup_file_path(backup.file_path)
            if resolved:
                meta_src = read_backup_metadata(resolved).get("source_tenant_id")
                if meta_src is not None:
                    return int(meta_src)
        return backup.tenant_id

    @staticmethod
    def _storage_label(backup: DataBackup) -> str:
        from core.services.file.storage.resolver import OBJECT_STORAGE_TYPE_LABELS

        backend = str(getattr(backup, "storage_backend", None) or "local").strip().lower()
        if backend in ("", "local"):
            return "本机"
        return OBJECT_STORAGE_TYPE_LABELS.get(backend, backend)

    @staticmethod
    def to_response(backup: DataBackup, *, enrich: bool = False) -> "DataBackupResponse":
        from core.schemas.data_backup import DataBackupResponse

        local_ok = resolve_backup_file_path(backup.file_path) is not None
        remote_ok = (
            str(getattr(backup, "storage_backend", None) or "local").strip().lower()
            not in ("", "local")
            and bool(getattr(backup, "storage_key", None))
        )
        return DataBackupResponse.model_validate(backup).model_copy(
            update={
                "source_tenant_id": DataBackupService.resolve_source_tenant_id(
                    backup, read_zip_meta=enrich
                ),
                "file_available": local_ok or remote_ok,
                "storage_label": DataBackupService._storage_label(backup),
            }
        )

    @staticmethod
    async def has_successful_full_at_destination(
        *,
        backup_scope: str,
        tenant_id: Optional[int],
        storage: dict,
    ) -> bool:
        """当前策略落点是否已有该组织（或全平台）成功的全量备份。"""
        scope = (backup_scope or "tenant").strip().lower()
        q = DataBackup.filter(status="success", backup_type="full", backup_scope=scope)
        if scope == "all":
            q = q.filter(backup_scope="all")
        else:
            if tenant_id is None:
                return False
            q = q.filter(tenant_id=int(tenant_id))

        backend = str((storage or {}).get("backend") or "local").strip().lower()
        conn_uuid = (storage or {}).get("connection_uuid")
        if backend == "connection" and conn_uuid:
            q = q.filter(storage_connection_uuid=str(conn_uuid))
        else:
            q = q.filter(
                Q(storage_backend="local")
                | Q(storage_backend__isnull=True)
                | Q(storage_backend="")
            ).filter(Q(storage_connection_uuid__isnull=True) | Q(storage_connection_uuid=""))
        return await q.exists()

    @staticmethod
    async def resolve_auto_backup_type(
        *,
        tenant_id: Optional[int],
        backup_scope: str,
    ) -> str:
        """无落点全量 → full；已有落点全量 → incremental。"""
        from core.services.system.data_backup_policy import (
            get_platform_data_backup_policy,
            get_tenant_data_backup_policy,
            normalize_data_backup_policy,
        )

        scope = (backup_scope or "tenant").strip().lower()
        if scope == "all":
            policy = await get_platform_data_backup_policy()
        elif tenant_id is not None:
            policy = await get_tenant_data_backup_policy(int(tenant_id))
        else:
            policy = normalize_data_backup_policy(None)
        storage = policy.get("storage") or {}
        if await DataBackupService.has_successful_full_at_destination(
            backup_scope=scope,
            tenant_id=tenant_id,
            storage=storage,
        ):
            return "incremental"
        return "full"


    @staticmethod
    async def get_backup_by_uuid(
        tenant_id: Optional[int],
        uuid: str,
        *,
        is_infra_admin: bool = False,
    ) -> DataBackup:
        """
        通过 UUID 获取备份详情
        """
        try:
            backup = await DataBackup.get(uuid=uuid)
        except DoesNotExist:
            logger.error(f"备份不存在: {uuid}")
            raise ValueError("备份不存在")
        if not DataBackupService.backup_visible_to_user(
            backup, tenant_id, is_infra_admin=is_infra_admin
        ):
            raise ValueError("备份不存在")
        return backup

    @staticmethod
    async def create_backup_task(tenant_id: Optional[int], data: DataBackupCreate) -> DataBackup:
        """
        创建备份任务记录并通过 PostgreSQL 队列异步执行备份
        """
        if data.backup_scope == "tenant" and tenant_id is None:
            raise ValueError(
                "租户级备份缺少 tenant_id：请在租户上下文中创建，或改用 backup_scope=all"
            )

        record_tenant_id = None if data.backup_scope == "all" else tenant_id

        trigger_source = (getattr(data, "trigger_source", None) or "manual").strip() or "manual"
        if trigger_source not in ("manual", "scheduled"):
            trigger_source = "manual"

        include_files = bool(getattr(data, "include_files", True))
        backup_type = await DataBackupService.resolve_auto_backup_type(
            tenant_id=record_tenant_id,
            backup_scope=data.backup_scope,
        )

        # 全平台备份 tenant_id 为空，避免组织管理员下载到全租户数据包
        backup = await DataBackup.create(
            tenant_id=record_tenant_id,
            name=data.name,
            backup_type=backup_type,
            backup_scope=data.backup_scope,
            include_files=include_files,
            backup_tables=data.backup_tables,
            trigger_source=trigger_source,
            storage_backend="local",
            status="pending",
            progress=0,
            progress_message=None,
        )
        
        # 2. 分发后台任务
        try:
            max_attempts = 3
            task_ids = []
            last_error: Optional[Exception] = None

            for attempt in range(1, max_attempts + 1):
                try:
                    task_ids = await dispatch_event(
                        TaskEvent(
                            name="database/backup.requested",
                            data={
                                "backup_uuid": str(backup.uuid),
                                "tenant_id": record_tenant_id,
                                "backup_type": backup_type,
                                "backup_scope": data.backup_scope,
                                "include_files": include_files,
                                "backup_tables": data.backup_tables,
                            },
                            id=str(backup.uuid),
                        )
                    )
                    if not task_ids:
                        raise RuntimeError("未注册 database/backup.requested 处理器，请确认事件处理器已加载")
                    break
                except Exception as dispatch_error:
                    last_error = dispatch_error
                    logger.warning(
                        "分发备份任务重试 {}/{} 失败: {}",
                        attempt,
                        max_attempts,
                        DataBackupService._flatten_exception_message(dispatch_error),
                    )
                    if attempt < max_attempts:
                        await asyncio.sleep(attempt)

            if not task_ids:
                raise last_error or RuntimeError("备份任务分发失败")

            backup.inngest_run_id = task_ids[0]
            await backup.save()
            logger.info(f"已分发备份任务: {backup.uuid} task_id={task_ids[0]}")
        except Exception as e:
            logger.exception(f"分发备份任务失败: {e}")
            backup.status = "failed"
            backup.error_message = (
                "触发后台任务失败: "
                f"{DataBackupService._flatten_exception_message(e)}"
            )
            await backup.save()
            
        return backup

    @staticmethod
    async def _queue_has_backup_message(backup_uuid: str) -> bool:
        """队列里是否已有该备份的 pending/processing 消息（避免重复 kiq）。"""
        try:
            import asyncpg
            from core.tasks.taskiq_app import get_taskiq_postgres_dsn

            conn = await asyncpg.connect(get_taskiq_postgres_dsn())
            try:
                n = await conn.fetchval(
                    """
                    SELECT COUNT(*) FROM riveredge_taskiq_messages
                    WHERE status IN ('pending', 'processing')
                      AND message::text LIKE $1
                    """,
                    f"%{backup_uuid}%",
                )
                return int(n or 0) > 0
            finally:
                await conn.close()
        except Exception as exc:
            logger.debug("检查备份队列消息失败 uuid={}: {}", backup_uuid, exc)
            return True

    @staticmethod
    async def _dispatch_backup_record(backup: DataBackup) -> bool:
        task_ids = await dispatch_event(
            TaskEvent(
                name="database/backup.requested",
                data={
                    "backup_uuid": str(backup.uuid),
                    "tenant_id": backup.tenant_id,
                    "backup_type": backup.backup_type,
                    "backup_scope": backup.backup_scope,
                    "include_files": backup.include_files,
                    "backup_tables": backup.backup_tables,
                },
                id=str(backup.uuid),
            )
        )
        if not task_ids:
            return False
        backup.inngest_run_id = task_ids[0]
        backup.progress_message = backup.progress_message or "已重新入队"
        await backup.save()
        return True

    @staticmethod
    async def reclaim_stalled_backups(*, tenant_id: Optional[int] = None) -> dict:
        """
        回收堆积：无 advisory lock 的 running 标失败；pending 且队列无消息则重新投递。
        """
        from core.services.system.data_backup_jobs import is_backup_advisory_lock_held

        now = resolve_business_datetime()
        pending_stale_before = now - timedelta(minutes=2)
        running_q = DataBackup.filter(status="running")
        pending_q = DataBackup.filter(status="pending", updated_at__lt=pending_stale_before)
        if tenant_id is not None:
            running_q = running_q.filter(tenant_id=tenant_id)
            pending_q = pending_q.filter(tenant_id=tenant_id)

        lock_held = await is_backup_advisory_lock_held()
        failed_running = 0
        if lock_held is False:
            for backup in await running_q.all():
                backup.status = "failed"
                backup.error_message = "备份进程中断（锁已释放且任务仍为执行中），已自动取消"
                backup.progress_message = "已取消：执行中断"
                backup.completed_at = now
                await backup.save()
                failed_running += 1

        redispatched = 0
        skipped_queued = 0
        for backup in await pending_q.order_by("created_at").limit(20):
            if await DataBackupService._queue_has_backup_message(str(backup.uuid)):
                skipped_queued += 1
                continue
            try:
                if await DataBackupService._dispatch_backup_record(backup):
                    redispatched += 1
            except Exception as exc:
                logger.warning("重投备份失败 uuid={}: {}", backup.uuid, exc)

        return {
            "failed_running": failed_running,
            "redispatched": redispatched,
            "already_queued": skipped_queued,
        }

    @staticmethod
    async def upload_backup_file(tenant_id: int, file, backup_name: str, *, allow_global_backup: bool = False) -> DataBackup:
        """
        上传备份文件并创建备份记录
        """
        backup_dir = resolve_data_backup_dir()
        ts = resolve_business_datetime().strftime("%Y%m%d%H%M%S")
        safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in backup_name)[:100]
        filename = f"{safe_name}_{ts}_{uuid4().hex}.zip"
        file_path = os.path.join(backup_dir, filename)
        created_file = False
        try:
            with open(file_path, "xb") as f:
                created_file = True
                content = await file.read()
                f.write(content)
            file_size = os.path.getsize(file_path)
            from core.services.system.data_backup_jobs import read_backup_metadata, zip_has_upload_entries

            metadata = read_backup_metadata(file_path)
            backup_scope = metadata.get("backup_scope", "all")
            if backup_scope not in ("tenant", "all", "table"):
                raise ValueError("无效的备份范围")
            if backup_scope != "tenant" and not allow_global_backup:
                raise PermissionError("仅平台管理员可上传全局范围备份")
            include_files = metadata.get("include_files")
            if include_files is None:
                include_files = zip_has_upload_entries(file_path)
            include_files = bool(include_files)
            meta_type = str(metadata.get("backup_type") or "full").strip().lower()
            backup_type = meta_type if meta_type in ("full", "incremental") else "full"
            backup = await DataBackup.create(
                tenant_id=None if backup_scope == "all" else tenant_id,
                name=backup_name,
                backup_type=backup_type,
                backup_scope=backup_scope,
                include_files=include_files,
                backup_tables=None,
                file_path=store_backup_file_path(file_path),
                file_size=file_size,
                status="success",
                source_type="uploaded",
                started_at=resolve_business_datetime(),
                completed_at=resolve_business_datetime(),
            )
            logger.info(f"已上传备份文件: {backup.uuid} -> {file_path}")
            return backup
        except Exception as e:
            if created_file and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError:
                    pass
            raise

    @staticmethod
    async def delete_backup(
        tenant_id: Optional[int],
        uuid: str,
        *,
        is_infra_admin: bool = False,
    ) -> None:
        """
        删除备份记录（同时应处理物理文件，通常由 Taskiq 任务或服务层手动处理）
        """
        backup = await DataBackupService.get_backup_by_uuid(
            tenant_id, uuid, is_infra_admin=is_infra_admin
        )

        import os

        from core.services.system.data_backup_policy import delete_remote_backup_object

        await delete_remote_backup_object(backup)

        resolved = resolve_backup_file_path(backup.file_path)
        if resolved and os.path.exists(resolved):
            try:
                os.remove(resolved)
            except Exception as e:
                logger.error("删除本地备份文件失败 uuid={}: {}", uuid, e)
                raise

        await backup.delete()

    @staticmethod
    async def restore_backup(
        tenant_id: Optional[int],
        uuid: str,
        create_pre_restore_backup: bool = True,
        source_tenant_id: Optional[int] = None,
        target_tenant_id: Optional[int] = None,
        *,
        allow_global_restore: bool = False,
    ) -> bool:
        """
        触发恢复备份任务

        若 create_pre_restore_backup=True，恢复前会自动创建当前状态的备份。
        source_tenant_id: 备份中的租户ID，用于恢复时替换；不填则从备份记录推断；若与目标租户不同则自动替换。
        target_tenant_id: 恢复写入的目标组织；未传时回退到调用方 tenant_id（平台未绑定组织须显式传入）。
        """
        backup = await DataBackupService.get_backup_by_uuid(
            tenant_id, uuid, is_infra_admin=allow_global_restore
        )
        if backup.status != "success":
            raise ValueError("只能恢复成功的备份")

        from core.services.system.data_backup_jobs import (
            read_backup_metadata,
            infer_source_tenant_id_from_zip,
            resolve_restore_source_tenant_id,
        )

        from core.services.system.data_backup_policy import ensure_local_backup_file

        resolved_path = await ensure_local_backup_file(backup)
        # 队列只带可移植路径（通常为 basename）；Worker 侧按 backup_uuid 再 ensure_local
        stored_path = store_backup_file_path(resolved_path)

        metadata = read_backup_metadata(resolved_path)
        backup_scope = metadata.get("backup_scope", backup.backup_scope)
        if backup_scope not in ("tenant", "all", "table"):
            raise ValueError("无效的备份范围")
        if backup_scope != "tenant" and not allow_global_restore:
            raise PermissionError("仅平台管理员可恢复全局范围备份")

        effective_target = target_tenant_id if target_tenant_id is not None else tenant_id
        if backup_scope == "tenant" and effective_target is None:
            raise ValueError("租户级恢复请指定目标组织（target_tenant_id）")

        meta_src = metadata.get("source_tenant_id")
        inferred = infer_source_tenant_id_from_zip(resolved_path)
        src = resolve_restore_source_tenant_id(
            target_tenant_id=int(effective_target) if effective_target is not None else None,
            user_source=source_tenant_id,
            metadata_source=int(meta_src) if meta_src is not None else None,
            inferred_source=inferred,
        )

        backup.restore_status = "running"
        backup.restore_started_at = resolve_business_datetime()
        backup.restore_completed_at = None
        backup.restore_error_message = None
        if backup.file_path != stored_path:
            backup.file_path = stored_path
        await backup.save()

        event = TaskEvent(
            name="database/restore.requested",
            data={
                "backup_uuid": str(backup.uuid),
                "target_tenant_id": effective_target,
                "source_tenant_id": src,
                "file_path": stored_path,
                "create_pre_restore_backup": create_pre_restore_backup,
                "backup_scope": backup_scope,
                "record_backup_scope": backup.backup_scope,
                "allow_global_restore": allow_global_restore,
            },
            id=f"restore-{backup.uuid}",
        )
        storage = str(getattr(backup, "storage_backend", None) or "local").strip().lower()

        try:
            if storage in ("", "local"):
                # 本机 zip：共享 PG broker 上其它主机 Worker 看不到文件，必须在已 ensure_local 的进程内执行
                run_id = f"local-restore-{backup.uuid}-{uuid4().hex[:8]}"

                async def _run_local_restore() -> None:
                    try:
                        await execute_event_handlers(
                            event_name=event.name,
                            data=event.data or {},
                            event_id=event.id,
                            run_id=run_id,
                        )
                    except Exception as exc:
                        logger.exception("本机恢复任务异常 uuid={}: {}", backup.uuid, exc)
                        row = await DataBackup.get_or_none(uuid=backup.uuid)
                        if row and row.restore_status == "running":
                            row.restore_status = "failed"
                            row.restore_error_message = (
                                "本机恢复任务异常: "
                                f"{DataBackupService._flatten_exception_message(exc)}"
                            )
                            row.restore_completed_at = resolve_business_datetime()
                            await row.save()

                asyncio.create_task(_run_local_restore())
                logger.info(
                    "已在本机调度恢复任务（local storage）: {} run_id={}",
                    backup.uuid,
                    run_id,
                )
                return True

            task_ids = await dispatch_event(event)
            if not task_ids:
                raise RuntimeError("未注册 database/restore.requested 处理器，请确认 Worker 已启动")
            logger.info(f"已分发恢复任务: {backup.uuid} task_id={task_ids[0]}")
            return True
        except Exception as e:
            logger.exception(f"分发恢复任务失败: {e}")
            backup.restore_status = "failed"
            backup.restore_error_message = (
                "触发恢复任务失败: "
                f"{DataBackupService._flatten_exception_message(e)}"
            )
            backup.restore_completed_at = resolve_business_datetime()
            await backup.save()
            return False
