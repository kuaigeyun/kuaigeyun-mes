"""
数据备份服务模块

提供数据备份的创建、查询、删除和恢复功能。
"""

from typing import List, Tuple, Optional
from datetime import datetime
from loguru import logger
from tortoise.exceptions import DoesNotExist

from core.models.data_backup import DataBackup
from core.schemas.data_backup import DataBackupCreate
from core.inngest.client import inngest_client


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
        创建备份任务记录并触发 Inngest
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
        
        # 2. 触发 Inngest 事件
        try:
            # 发送事件到 Inngest
            # 注意：Inngest 会异步处理后续的物理备份操作
            await inngest_client.send(
                {
                    "name": "database/backup.requested",
                    "data": {
                        "backup_uuid": backup.uuid,
                        "tenant_id": tenant_id,
                        "backup_type": data.backup_type,
                        "backup_scope": data.backup_scope,
                        "backup_tables": data.backup_tables
                    }
                }
            )
            logger.info(f"已发送备份请求事件: {backup.uuid}")
        except Exception as e:
            logger.exception(f"发送 Inngest 事件失败: {e}")
            backup.status = "failed"
            backup.error_message = f"触发后台任务失败: {str(e)}"
            await backup.save()
            
        return backup

    @staticmethod
    async def delete_backup(tenant_id: int, uuid: str) -> None:
        """
        删除备份记录（同时应处理物理文件，这通常由 Inngest 或服务层手动处理）
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
    async def restore_backup(tenant_id: int, uuid: str) -> bool:
        """
        触发恢复备份任务
        """
        backup = await DataBackupService.get_backup_by_uuid(tenant_id, uuid)
        
        if backup.status != "success":
            raise ValueError("只能恢复成功的备份")
            
        try:
            await inngest_client.send(
                {
                    "name": "database/restore.requested",
                    "data": {
                        "backup_uuid": backup.uuid,
                        "tenant_id": tenant_id,
                        "file_path": backup.file_path
                    }
                }
            )
            logger.info(f"已发送恢复请求事件: {backup.uuid}")
            return True
        except Exception as e:
            logger.exception(f"发送恢复 Inngest 事件失败: {e}")
            return False
