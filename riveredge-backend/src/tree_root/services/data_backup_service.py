"""
数据备份管理服务模块

提供数据备份的 CRUD 操作和备份恢复功能。
"""

import subprocess
import os
from typing import Optional, List
from datetime import datetime
from pathlib import Path

from tortoise.expressions import Q

from tree_root.models.data_backup import DataBackup
from tree_root.schemas.data_backup import (
    DataBackupCreate,
    DataBackupUpdate,
    DataBackupResponse,
    DataBackupListResponse,
    DataBackupRestoreResponse,
)
from soil.exceptions.exceptions import NotFoundError, ValidationError
from soil.infrastructure.database.database import DB_CONFIG
from loguru import logger


class DataBackupService:
    """
    数据备份管理服务类
    
    提供数据备份的 CRUD 操作和备份恢复功能。
    """
    
    @staticmethod
    async def create_backup(
        tenant_id: int,
        data: DataBackupCreate
    ) -> DataBackupResponse:
        """
        创建备份任务
        
        Args:
            tenant_id: 组织ID
            data: 备份创建数据
            
        Returns:
            DataBackupResponse: 创建的备份对象
        """
        backup = await DataBackup.create(
            tenant_id=tenant_id,
            name=data.name,
            backup_type=data.backup_type,
            backup_scope=data.backup_scope,
            backup_tables=data.backup_tables,
            status="pending",
        )
        
        # TODO: 通过 Inngest 触发备份任务
        # from tree_root.inngest.client import inngest_client
        # from inngest import Event
        # await inngest_client.send_event(
        #     event=Event(
        #         name="backup/execute",
        #         data={
        #             "tenant_id": tenant_id,
        #             "backup_id": str(backup.uuid),
        #             "backup_type": data.backup_type,
        #             "backup_scope": data.backup_scope
        #         }
        #     )
        # )
        
        return DataBackupResponse.model_validate(backup)
    
    @staticmethod
    async def get_backup_by_uuid(
        tenant_id: int,
        backup_uuid: str
    ) -> DataBackup:
        """
        根据 UUID 获取备份
        
        Args:
            tenant_id: 组织ID
            backup_uuid: 备份UUID
            
        Returns:
            DataBackup: 备份对象
            
        Raises:
            NotFoundError: 当备份不存在时抛出
        """
        backup = await DataBackup.filter(
            tenant_id=tenant_id,
            uuid=backup_uuid
        ).first()
        
        if not backup:
            raise NotFoundError(f"备份 {backup_uuid} 不存在")
        
        return backup
    
    @staticmethod
    async def get_backups(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        backup_type: Optional[str] = None,
        backup_scope: Optional[str] = None,
        status: Optional[str] = None,
    ) -> DataBackupListResponse:
        """
        获取备份列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            backup_type: 备份类型过滤（可选）
            backup_scope: 备份范围过滤（可选）
            status: 备份状态过滤（可选）
            
        Returns:
            DataBackupListResponse: 备份列表
        """
        query = Q(tenant_id=tenant_id)
        
        if backup_type:
            query &= Q(backup_type=backup_type)
        if backup_scope:
            query &= Q(backup_scope=backup_scope)
        if status:
            query &= Q(status=status)
        
        total = await DataBackup.filter(query).count()
        
        offset = (page - 1) * page_size
        backups = await DataBackup.filter(query).order_by("-created_at").offset(offset).limit(page_size)
        
        items = [DataBackupResponse.model_validate(backup) for backup in backups]
        
        return DataBackupListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )
    
    @staticmethod
    async def execute_backup(
        tenant_id: int,
        backup_uuid: str,
        inngest_run_id: Optional[str] = None
    ) -> dict:
        """
        执行备份（由 Inngest 函数调用）
        
        Args:
            tenant_id: 组织ID
            backup_uuid: 备份UUID
            inngest_run_id: Inngest 运行ID（可选）
            
        Returns:
            dict: 备份结果
        """
        backup = await DataBackupService.get_backup_by_uuid(tenant_id, backup_uuid)
        
        # 更新状态为运行中
        backup.status = "running"
        backup.started_at = datetime.now()
        if inngest_run_id:
            backup.inngest_run_id = inngest_run_id
        await backup.save()
        
        try:
            # 生成备份文件路径
            backup_dir = Path("backups")
            backup_dir.mkdir(exist_ok=True)
            backup_filename = f"backup_{backup.uuid}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
            backup_filepath = backup_dir / backup_filename
            
            # 构建 pg_dump 命令
            cmd = [
                "pg_dump",
                "-h", DB_CONFIG.get("host", "localhost"),
                "-p", str(DB_CONFIG.get("port", 5432)),
                "-U", DB_CONFIG.get("user", "postgres"),
                "-d", DB_CONFIG.get("database", "riveredge"),
                "-f", str(backup_filepath),
                "--no-owner",
                "--no-acl",
            ]
            
            # 如果备份范围是表，需要添加筛选条件
            if backup.backup_scope == "table" and backup.backup_tables:
                for table in backup.backup_tables:
                    cmd.extend(["-t", table])
            
            # 执行备份
            env = os.environ.copy()
            env["PGPASSWORD"] = DB_CONFIG.get("password", "")
            
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600,  # 1小时超时
            )
            
            if result.returncode != 0:
                raise Exception(f"备份失败: {result.stderr}")
            
            # 获取备份文件大小
            file_size = backup_filepath.stat().st_size
            
            # 更新备份记录
            backup.status = "success"
            backup.completed_at = datetime.now()
            backup.file_path = str(backup_filepath)
            backup.file_size = file_size
            await backup.save()
            
            # TODO: 上传备份文件到文件管理模块
            # file_uuid = await upload_backup_file(backup_filepath)
            # backup.file_uuid = file_uuid
            # await backup.save()
            
            logger.info(f"备份成功: {backup_uuid}, 文件大小: {file_size} 字节")
            
            return {
                "success": True,
                "file_path": str(backup_filepath),
                "file_size": file_size
            }
        except subprocess.TimeoutExpired:
            error_msg = "备份超时（超过1小时）"
            backup.status = "failed"
            backup.completed_at = datetime.now()
            backup.error_message = error_msg
            await backup.save()
            logger.error(f"备份超时: {backup_uuid}")
            return {
                "success": False,
                "error": error_msg
            }
        except Exception as e:
            # 更新备份状态为失败
            error_msg = str(e)
            backup.status = "failed"
            backup.completed_at = datetime.now()
            backup.error_message = error_msg
            await backup.save()
            logger.error(f"备份失败: {backup_uuid}, 错误: {error_msg}")
            return {
                "success": False,
                "error": error_msg
            }
    
    @staticmethod
    async def restore_backup(
        tenant_id: int,
        backup_uuid: str
    ) -> DataBackupRestoreResponse:
        """
        恢复备份
        
        Args:
            tenant_id: 组织ID
            backup_uuid: 备份UUID
            
        Returns:
            DataBackupRestoreResponse: 恢复结果
            
        Raises:
            ValidationError: 当备份未完成或文件不存在时抛出
        """
        backup = await DataBackupService.get_backup_by_uuid(tenant_id, backup_uuid)
        
        if backup.status != "success":
            raise ValidationError("备份未完成，无法恢复")
        
        if not backup.file_path:
            raise ValidationError("备份文件不存在")
        
        if not Path(backup.file_path).exists():
            raise ValidationError("备份文件不存在于文件系统")
        
        try:
            # 构建 psql 命令（使用 -f 参数执行 SQL 文件）
            cmd = [
                "psql",
                "-h", DB_CONFIG.get("host", "localhost"),
                "-p", str(DB_CONFIG.get("port", 5432)),
                "-U", DB_CONFIG.get("user", "postgres"),
                "-d", DB_CONFIG.get("database", "riveredge"),
                "-f", backup.file_path,
            ]
            
            # 执行恢复
            env = os.environ.copy()
            env["PGPASSWORD"] = DB_CONFIG.get("password", "")
            
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600,  # 1小时超时
            )
            
            if result.returncode != 0:
                raise Exception(f"恢复失败: {result.stderr}")
            
            logger.info(f"备份恢复成功: {backup_uuid}")
            
            return DataBackupRestoreResponse(
                success=True,
                message="数据恢复成功"
            )
        except subprocess.TimeoutExpired:
            error_msg = "恢复超时（超过1小时）"
            logger.error(f"恢复超时: {backup_uuid}")
            return DataBackupRestoreResponse(
                success=False,
                error=error_msg
            )
        except Exception as e:
            error_msg = str(e)
            logger.error(f"恢复失败: {backup_uuid}, 错误: {error_msg}")
            return DataBackupRestoreResponse(
                success=False,
                error=error_msg
            )
    
    @staticmethod
    async def delete_backup(
        tenant_id: int,
        backup_uuid: str
    ) -> bool:
        """
        删除备份（软删除）
        
        Args:
            tenant_id: 组织ID
            backup_uuid: 备份UUID
            
        Returns:
            bool: 是否成功
            
        Raises:
            NotFoundError: 当备份不存在时抛出
        """
        backup = await DataBackupService.get_backup_by_uuid(tenant_id, backup_uuid)
        
        # 软删除
        await backup.delete()
        
        # TODO: 删除备份文件（可选）
        # if backup.file_path and Path(backup.file_path).exists():
        #     Path(backup.file_path).unlink()
        
        return True

