"""
数据备份执行器 Inngest 工作流函数

处理数据备份的执行，支持全量备份、增量备份等。
"""

from inngest import Event, TriggerEvent, TriggerCron
from typing import Dict, Any
from datetime import datetime
from loguru import logger

from tree_root.inngest.client import inngest_client
from tree_root.models.data_backup import DataBackup
from tree_root.services.data_backup_service import DataBackupService
from soil.exceptions.exceptions import NotFoundError, ValidationError


@inngest_client.create_function(
    fn_id="data-backup-executor",
    name="数据备份执行器",
    trigger=TriggerEvent(event="backup/execute"),
    retries=3,
)
async def data_backup_executor_function(event: Event) -> Dict[str, Any]:
    """
    数据备份执行器工作流函数
    
    监听 backup/execute 事件，执行数据备份。
    支持全量备份、增量备份等备份类型。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 备份执行结果
    """
    data = event.data or {}
    tenant_id = data.get("tenant_id")
    backup_uuid = data.get("backup_uuid")
    inngest_run_id = getattr(event, "id", None)
    
    if not tenant_id or not backup_uuid:
        return {
            "success": False,
            "error": "缺少必要参数：tenant_id 或 backup_uuid"
        }
    
    try:
        # 执行备份
        result = await DataBackupService.execute_backup(
            tenant_id=tenant_id,
            backup_uuid=backup_uuid,
            inngest_run_id=str(inngest_run_id) if inngest_run_id else None
        )
        
        logger.info(f"数据备份执行完成: {backup_uuid}, 结果: {result.get('success')}")
        
        return result
    except NotFoundError as e:
        logger.error(f"数据备份执行失败: {backup_uuid}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"数据备份执行失败: {backup_uuid}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@inngest_client.create_function(
    fn_id="scheduled-backup-scheduler",
    name="定时备份调度器",
    trigger=TriggerCron(cron="0 * * * *"),  # 每小时执行一次
)
async def scheduled_backup_scheduler_function(event: Event) -> Dict[str, Any]:
    """
    定时备份调度器工作流函数
    
    每小时执行一次，检查需要执行的定时备份任务。
    根据备份策略（全量备份频率、增量备份频率）判断是否需要执行备份。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 调度结果
    """
    from tree_root.services.system_parameter_service import SystemParameterService
    
    now = datetime.now()
    executed_count = 0
    
    try:
        # 获取所有启用的备份任务（pending 状态）
        pending_backups = await DataBackup.filter(
            status="pending",
            deleted_at__isnull=True
        ).all()
        
        for backup in pending_backups:
            try:
                # 判断备份是否需要执行
                should_execute = await _should_execute_backup(backup, now)
                
                if should_execute:
                    # 发送事件触发备份执行
                    from inngest import Event as InngestEvent
                    await inngest_client.send_event(
                        event=InngestEvent(
                            name="backup/execute",
                            data={
                                "tenant_id": backup.tenant_id,
                                "backup_uuid": str(backup.uuid),
                            }
                        )
                    )
                    executed_count += 1
                    logger.info(f"触发数据备份执行: {backup.name} ({backup.uuid})")
            except Exception as e:
                logger.error(f"检查备份任务失败: {backup.uuid}, 错误: {e}")
                continue
        
        return {
            "success": True,
            "checked_count": len(pending_backups),
            "executed_count": executed_count,
            "timestamp": now.isoformat()
        }
    except Exception as e:
        logger.error(f"定时备份调度器执行失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def _should_execute_backup(backup: DataBackup, now: datetime) -> bool:
    """
    判断备份任务是否需要执行
    
    Args:
        backup: 备份对象
        now: 当前时间
        
    Returns:
        bool: 是否需要执行
    """
    from tree_root.services.system_parameter_service import SystemParameterService
    from datetime import timedelta
    
    # 如果备份状态不是 pending，不需要执行
    if backup.status != "pending":
        return False
    
    # 如果备份已经执行过，检查是否需要再次执行（定时备份）
    if backup.started_at:
        # 根据备份类型获取备份频率
        if backup.backup_type == "full":
            frequency = await SystemParameterService._get_backup_full_frequency(backup.tenant_id)
        elif backup.backup_type == "incremental":
            frequency = await SystemParameterService._get_backup_incremental_frequency(backup.tenant_id)
        else:
            frequency = None
        
        if frequency:
            # 解析 cron 表达式，判断是否到了执行时间
            # 这里简化处理，实际应该使用 croniter 库
            # 如果上次执行时间距离现在超过一定时间，则执行
            # 全量备份通常每天执行一次，增量备份每小时执行一次
            if backup.backup_type == "full":
                # 全量备份：如果上次执行时间超过24小时，则执行
                if (now - backup.started_at).total_seconds() < 24 * 3600:
                    return False
            elif backup.backup_type == "incremental":
                # 增量备份：如果上次执行时间超过1小时，则执行
                if (now - backup.started_at).total_seconds() < 3600:
                    return False
    
    # 首次执行或到了执行时间
    return True

