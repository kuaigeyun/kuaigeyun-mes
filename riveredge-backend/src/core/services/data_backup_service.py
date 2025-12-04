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

from core.models.data_backup import DataBackup
from core.schemas.data_backup import (
    DataBackupCreate,
    DataBackupUpdate,
    DataBackupResponse,
    DataBackupListResponse,
    DataBackupRestoreResponse,
)
from core.services.system_parameter_service import SystemParameterService
from core.services.file_service import FileService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.database.database import DB_CONFIG
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
        
        # 通过 Inngest 触发备份任务
        from core.inngest.client import inngest_client
        from inngest import Event
        
        try:
            await inngest_client.send_event(
                event=Event(
                    name="backup/execute",
                    data={
                        "tenant_id": tenant_id,
                        "backup_uuid": str(backup.uuid),
                        "backup_type": data.backup_type,
                        "backup_scope": data.backup_scope
                    }
                )
            )
        except Exception as e:
            # 如果 Inngest 事件发送失败，记录错误但不影响备份创建
            logger.error(f"发送备份执行事件失败: {e}")
        
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
            # 从参数设置读取备份策略
            backup_dir_path = await DataBackupService._get_backup_dir(tenant_id)
            backup_timeout = await DataBackupService._get_backup_timeout(tenant_id)
            
            # 生成备份文件路径
            backup_dir = Path(backup_dir_path)
            backup_dir.mkdir(parents=True, exist_ok=True)
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
                timeout=backup_timeout,  # 从参数设置读取超时时间
            )
            
            if result.returncode != 0:
                raise Exception(f"备份失败: {result.stderr}")
            
            # 获取备份文件大小
            file_size = backup_filepath.stat().st_size
            
            # 上传备份文件到文件管理模块（异步，不阻塞主流程）
            import asyncio
            asyncio.create_task(
                DataBackupService._upload_backup_to_file_management(
                    tenant_id=tenant_id,
                    backup=backup,
                    backup_filepath=backup_filepath,
                    file_size=file_size
                )
            )
            
            # 更新备份记录
            backup.status = "success"
            backup.completed_at = datetime.now()
            backup.file_path = str(backup_filepath)
            backup.file_size = file_size
            await backup.save()
            
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
        
        # 优先从文件管理获取备份文件路径
        backup_filepath = None
        if backup.file_uuid:
            try:
                file_record = await FileService.get_file_by_uuid(tenant_id, backup.file_uuid)
                # 构建完整文件路径
                backup_filepath = Path(FileService.UPLOAD_DIR) / file_record.file_path
                if not backup_filepath.exists():
                    raise ValidationError("备份文件不存在于文件系统")
            except NotFoundError:
                # 如果文件管理中的文件不存在，尝试使用原始路径
                if backup.file_path and Path(backup.file_path).exists():
                    backup_filepath = Path(backup.file_path)
                else:
                    raise ValidationError("备份文件不存在")
        elif backup.file_path:
            # 如果没有 file_uuid，使用原始路径
            backup_filepath = Path(backup.file_path)
            if not backup_filepath.exists():
                raise ValidationError("备份文件不存在于文件系统")
        else:
            raise ValidationError("备份文件不存在")
        
        try:
            # 构建 psql 命令（使用 -f 参数执行 SQL 文件）
            cmd = [
                "psql",
                "-h", DB_CONFIG.get("host", "localhost"),
                "-p", str(DB_CONFIG.get("port", 5432)),
                "-U", DB_CONFIG.get("user", "postgres"),
                "-d", DB_CONFIG.get("database", "riveredge"),
                "-f", str(backup_filepath),
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
        
        # 如果备份文件已关联到文件管理，删除文件管理中的文件（异步，不阻塞主流程）
        if backup.file_uuid:
            import asyncio
            asyncio.create_task(
                DataBackupService._delete_backup_file_from_file_management(
                    tenant_id=tenant_id,
                    file_uuid=backup.file_uuid
                )
            )
        
        # 软删除
        await backup.delete()
        
        return True
    
    @staticmethod
    async def _delete_backup_file_from_file_management(
        tenant_id: int,
        file_uuid: str
    ) -> None:
        """
        从文件管理中删除备份文件
        
        Args:
            tenant_id: 组织ID
            file_uuid: 文件UUID
        """
        try:
            await FileService.delete_file(
                tenant_id=tenant_id,
                uuid=file_uuid
            )
            logger.info(f"备份文件已从文件管理中删除: {file_uuid}")
        except NotFoundError:
            # 文件不存在，忽略
            pass
        except Exception as e:
            logger.warning(f"从文件管理中删除备份文件失败: {e}")
    
    @staticmethod
    async def _get_backup_dir(tenant_id: int) -> str:
        """
        从系统参数读取备份文件存储目录
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            str: 备份文件存储目录
        """
        try:
            param = await SystemParameterService.get_parameter(tenant_id, "backup.storage.dir")
            
            if param and param.is_active:
                dir_path = param.get_value()
                if dir_path:
                    return dir_path
        except Exception:
            pass
        
        return "backups"  # 默认目录
    
    @staticmethod
    async def _get_backup_timeout(tenant_id: int) -> int:
        """
        从系统参数读取备份超时时间（秒）
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            int: 备份超时时间（秒）
        """
        try:
            param = await SystemParameterService.get_parameter(tenant_id, "backup.timeout")
            
            if param and param.is_active:
                timeout = param.get_value()
                if isinstance(timeout, (int, float)):
                    return int(timeout)
        except Exception:
            pass
        
        return 3600  # 默认1小时
    
    @staticmethod
    async def _get_backup_retention_days(tenant_id: int) -> int:
        """
        从系统参数读取备份保留天数
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            int: 备份保留天数
        """
        try:
            param = await SystemParameterService.get_parameter(tenant_id, "backup.retention.days")
            
            if param and param.is_active:
                days = param.get_value()
                if isinstance(days, (int, float)):
                    return int(days)
        except Exception:
            pass
        
        return 7  # 默认保留7天
    
    @staticmethod
    async def _get_backup_retention_count(tenant_id: int) -> int:
        """
        从系统参数读取备份保留数量
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            int: 备份保留数量
        """
        try:
            param = await SystemParameterService.get_parameter(tenant_id, "backup.retention.count")
            
            if param and param.is_active:
                count = param.get_value()
                if isinstance(count, (int, float)):
                    return int(count)
        except Exception:
            pass
        
        return 10  # 默认保留10个
    
    @staticmethod
    async def _get_backup_full_frequency(tenant_id: int) -> str:
        """
        从系统参数读取全量备份频率（Cron表达式）
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            str: Cron表达式（如 "0 2 * * *" 表示每天凌晨2点）
        """
        try:
            param = await SystemParameterService.get_parameter(tenant_id, "backup.full.frequency")
            
            if param and param.is_active:
                frequency = param.get_value()
                if frequency:
                    return frequency
        except Exception:
            pass
        
        return "0 2 * * *"  # 默认每天凌晨2点
    
    @staticmethod
    async def _get_backup_incremental_frequency(tenant_id: int) -> str:
        """
        从系统参数读取增量备份频率（Cron表达式）
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            str: Cron表达式（如 "0 * * * *" 表示每小时）
        """
        try:
            param = await SystemParameterService.get_parameter(tenant_id, "backup.incremental.frequency")
            
            if param and param.is_active:
                frequency = param.get_value()
                if frequency:
                    return frequency
        except Exception:
            pass
        
        return "0 * * * *"  # 默认每小时
    
    @staticmethod
    async def _upload_backup_to_file_management(
        tenant_id: int,
        backup: DataBackup,
        backup_filepath: Path,
        file_size: int
    ) -> None:
        """
        将备份文件上传到文件管理模块
        
        Args:
            tenant_id: 组织ID
            backup: 备份对象
            backup_filepath: 备份文件路径
            file_size: 文件大小
        """
        try:
            import shutil
            
            # 读取备份文件内容
            with open(backup_filepath, 'rb') as f:
                file_content = f.read()
            
            # 生成文件存储路径（使用文件管理的路径格式）
            storage_path = FileService._get_file_storage_path(tenant_id, backup_filepath.name)
            full_storage_path = Path(FileService.UPLOAD_DIR) / storage_path
            full_storage_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 将备份文件复制到文件管理的存储目录
            shutil.copy2(backup_filepath, full_storage_path)
            
            # 创建文件记录
            file_record = await FileService.create_file(
                tenant_id=tenant_id,
                original_name=backup_filepath.name,
                file_path=str(storage_path),  # 使用相对路径
                file_size=file_size,
                file_type="application/sql",  # SQL 备份文件
                category="backup",
                tags=["backup", backup.backup_type, backup.backup_scope],
                description=f"数据备份文件: {backup.name} ({backup.backup_type}, {backup.backup_scope})"
            )
            
            # 更新备份记录的 file_uuid
            backup.file_uuid = str(file_record.uuid)
            await backup.save()
            
            logger.info(f"备份文件已上传到文件管理: {backup.uuid}, 文件UUID: {file_record.uuid}")
        except Exception as e:
            logger.warning(f"上传备份文件到文件管理失败: {e}")
            # 上传失败不影响备份流程，静默处理

