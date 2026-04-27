"""
数据备份服务模块

提供数据备份的创建、查询、删除和恢复功能。
"""

import os
import shutil
from typing import List, Tuple, Optional
from datetime import datetime
from loguru import logger
from tortoise.exceptions import DoesNotExist

from core.models.data_backup import DataBackup
from core.schemas.data_backup import DataBackupCreate
from core.tasks.dispatcher import TaskEvent, dispatch_event


class DataBackupService:
    """
    数据备份服务类
    
    管理数据备份记录，并触发后台备份/恢复任务。
    """
    
    @staticmethod
    async def get_backups(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        backup_type: Optional[str] = None,
        backup_scope: Optional[str] = None,
        status: Optional[str] = None
    ) -> Tuple[List[DataBackup], int]:
        """
        获取备份列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            backup_type: 备份类型可选过滤
            backup_scope: 备份范围可选过滤
            status: 状态可选过滤
            
        Returns:
            Tuple[List[DataBackup], int]: (备份列表, 总数)
        """
        query = DataBackup.filter(tenant_id=tenant_id)
        
        if backup_type:
            query = query.filter(backup_type=backup_type)
        if backup_scope:
            query = query.filter(backup_scope=backup_scope)
        if status:
            query = query.filter(status=status)
            
        total = await query.count()
        items = await query.order_by("-created_at").offset((page - 1) * page_size).limit(page_size).all()
        
        return items, total

    @staticmethod
    async def get_backup_by_uuid(tenant_id: int, uuid: str) -> DataBackup:
        """
        通过 UUID 获取备份详情
        """
        try:
            return await DataBackup.get(tenant_id=tenant_id, uuid=uuid)
        except DoesNotExist:
            logger.error(f"备份不存在: {uuid}")
            raise ValueError("备份不存在")

    @staticmethod
    async def create_backup_task(tenant_id: int, data: DataBackupCreate) -> DataBackup:
        """
        创建备份任务记录并通过 PostgreSQL 队列异步执行备份
        """
        # 1. 创建备份记录
        backup = await DataBackup.create(
            tenant_id=tenant_id,
            name=data.name,
            backup_type=data.backup_type,
            backup_scope=data.backup_scope,
            backup_tables=data.backup_tables,
            status="pending"
        )
        
        # 2. 分发后台任务
        try:
            task_ids = await dispatch_event(
                TaskEvent(
                    name="database/backup.requested",
                    data={
                        "backup_uuid": str(backup.uuid),
                        "tenant_id": tenant_id,
                        "backup_type": data.backup_type,
                        "backup_scope": data.backup_scope,
                        "backup_tables": data.backup_tables,
                    },
                    id=str(backup.uuid),
                )
            )
            if not task_ids:
                raise RuntimeError("未注册 database/backup.requested 处理器，请确认事件处理器已加载")
            backup.inngest_run_id = task_ids[0]
            await backup.save()
            logger.info(f"已分发备份任务: {backup.uuid} task_id={task_ids[0]}")
        except Exception as e:
            logger.exception(f"分发备份任务失败: {e}")
            backup.status = "failed"
            backup.error_message = f"触发后台任务失败: {str(e)}"
            await backup.save()
            
        return backup

    @staticmethod
    async def upload_backup_file(tenant_id: int, file, backup_name: str) -> DataBackup:
        """
        上传备份文件并创建备份记录
        """
        backup_dir = os.path.abspath("backups")
        os.makedirs(backup_dir, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in backup_name)[:100]
        filename = f"{safe_name}_{ts}.zip"
        file_path = os.path.join(backup_dir, filename)
        try:
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            file_size = os.path.getsize(file_path)
            backup = await DataBackup.create(
                tenant_id=tenant_id,
                name=backup_name,
                backup_type="full",
                backup_scope="all",
                backup_tables=None,
                file_path=file_path,
                file_size=file_size,
                status="success",
                source_type="uploaded",
                started_at=datetime.now(),
                completed_at=datetime.now(),
            )
            logger.info(f"已上传备份文件: {backup.uuid} -> {file_path}")
            return backup
        except Exception as e:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError:
                    pass
            raise

    @staticmethod
    async def delete_backup(tenant_id: int, uuid: str) -> None:
        """
        删除备份记录（同时应处理物理文件，通常由 Taskiq 任务或服务层手动处理）
        """
        backup = await DataBackupService.get_backup_by_uuid(tenant_id, uuid)
        
        # 如果有物理文件，发送删除事件或直接在此删除
        # 这里选择发送事件让后台清理，或者简单起见如果本地可访问则直接删除
        import os
        if backup.file_path and os.path.exists(backup.file_path):
            try:
                os.remove(backup.file_path)
                logger.info(f"已删除备份文件: {backup.file_path}")
            except Exception as e:
                logger.error(f"删除物理文件失败: {e}")
                
        await backup.delete()

    @staticmethod
    async def restore_backup(
        tenant_id: int,
        uuid: str,
        create_pre_restore_backup: bool = True,
        source_tenant_id: Optional[int] = None,
    ) -> bool:
        """
        触发恢复备份任务

        若 create_pre_restore_backup=True，恢复前会自动创建当前状态的备份。
        source_tenant_id: 备份中的租户ID，用于恢复时替换；不填则从备份记录推断；若与目标租户不同则自动替换。
        """
        backup = await DataBackupService.get_backup_by_uuid(tenant_id, uuid)

        if backup.status != "success":
            raise ValueError("只能恢复成功的备份")

        src = source_tenant_id if source_tenant_id is not None else backup.tenant_id

        try:
            await dispatch_event(
                TaskEvent(
                    name="database/restore.requested",
                    data={
                        "backup_uuid": str(backup.uuid),
                        "target_tenant_id": tenant_id,
                        "source_tenant_id": src,
                        "file_path": backup.file_path,
                        "create_pre_restore_backup": create_pre_restore_backup,
                    },
                    id=f"restore-{backup.uuid}",
                )
            )
            logger.info(f"已分发恢复任务: {backup.uuid}")
            return True
        except Exception as e:
            logger.exception(f"分发恢复任务失败: {e}")
            return False
