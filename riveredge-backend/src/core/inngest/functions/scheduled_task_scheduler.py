"""
定时任务调度器 Inngest 工作流函数

定期检查需要执行的定时任务，并触发任务执行。
"""

from inngest import Event, TriggerCron
from typing import Dict, Any
from datetime import datetime, timedelta
from loguru import logger

from core.inngest.client import inngest_client
from core.models.scheduled_task import ScheduledTask
from inngest import Event as InngestEvent


@inngest_client.create_function(
    fn_id="scheduled-task-scheduler",
    name="定时任务调度器",
    trigger=TriggerCron(cron="* * * * *"),  # 每分钟执行一次
)
async def scheduled_task_scheduler_function(event: Event) -> Dict[str, Any]:
    """
    定时任务调度器工作流函数
    
    每分钟执行一次，检查所有启用的定时任务，判断是否需要执行。
    如果需要执行，发送事件触发任务执行。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 调度结果
    """
    now = datetime.now()
    executed_count = 0
    
    try:
        # 获取所有启用的定时任务
        active_tasks = await ScheduledTask.filter(
            is_active=True,
            deleted_at__isnull=True
        ).all()
        
        for task in active_tasks:
            try:
                # 判断任务是否需要执行
                should_execute = await _should_execute_task(task, now)
                
                if should_execute:
                    # 发送事件触发任务执行
                    await inngest_client.send_event(
                        event=InngestEvent(
                            name="scheduled-task/execute",
                            data={
                                "tenant_id": task.tenant_id,
                                "task_uuid": str(task.uuid),
                            }
                        )
                    )
                    executed_count += 1
                    logger.info(f"触发定时任务执行: {task.name} ({task.uuid})")
            except Exception as e:
                logger.error(f"检查定时任务失败: {task.uuid}, 错误: {e}")
                continue
        
        return {
            "success": True,
            "checked_count": len(active_tasks),
            "executed_count": executed_count,
            "timestamp": now.isoformat()
        }
    except Exception as e:
        logger.error(f"定时任务调度器执行失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def _should_execute_task(task: ScheduledTask, now: datetime) -> bool:
    """
    判断定时任务是否需要执行
    
    Args:
        task: 定时任务对象
        now: 当前时间
        
    Returns:
        bool: 是否需要执行
    """
    trigger_type = task.trigger_type
    trigger_config = task.trigger_config or {}
    
    # 如果任务正在运行，跳过
    if task.is_running:
        return False
    
    if trigger_type == "cron":
        # Cron 触发器：检查 cron 表达式是否匹配当前时间
        cron_expr = trigger_config.get("cron")
        if not cron_expr:
            return False
        
        # 简单的 cron 匹配（仅支持基本格式）
        # 实际应该使用 croniter 库进行精确匹配
        # 这里简化处理，每分钟检查一次，如果匹配就执行
        return _match_cron(cron_expr, now)
    
    elif trigger_type == "interval":
        # Interval 触发器：检查上次执行时间
        seconds = trigger_config.get("seconds", 0)
        if seconds <= 0:
            return False
        
        if not task.last_run_at:
            # 首次执行
            return True
        
        # 检查是否到了执行时间
        next_run_time = task.last_run_at + timedelta(seconds=seconds)
        return now >= next_run_time
    
    elif trigger_type == "date":
        # Date 触发器：检查是否到了指定时间
        at_time = trigger_config.get("at")
        if not at_time:
            return False
        
        try:
            if isinstance(at_time, str):
                target_time = datetime.fromisoformat(at_time.replace("Z", "+00:00"))
            else:
                target_time = at_time
            
            # 如果已经执行过，不再执行
            if task.last_run_at:
                return False
            
            # 检查是否到了执行时间（允许1分钟误差）
            time_diff = abs((now - target_time).total_seconds())
            return time_diff <= 60
        except Exception as e:
            logger.error(f"解析日期触发器失败: {at_time}, 错误: {e}")
            return False
    
    return False


def _match_cron(cron_expr: str, now: datetime) -> bool:
    """
    简单的 cron 表达式匹配（仅支持基本格式）
    
    注意：这是一个简化实现，仅用于演示。
    实际应该使用 croniter 库进行精确匹配。
    
    Args:
        cron_expr: Cron 表达式（格式：分 时 日 月 周）
        now: 当前时间
        
    Returns:
        bool: 是否匹配
    """
    try:
        parts = cron_expr.strip().split()
        if len(parts) != 5:
            return False
        
        minute, hour, day, month, weekday = parts
        
        # 检查分钟
        if minute != "*" and str(now.minute) != minute:
            return False
        
        # 检查小时
        if hour != "*" and str(now.hour) != hour:
            return False
        
        # 检查日期
        if day != "*" and str(now.day) != day:
            return False
        
        # 检查月份
        if month != "*" and str(now.month) != month:
            return False
        
        # 检查星期（简化处理）
        if weekday != "*":
            # 0=周日, 1=周一, ..., 6=周六
            current_weekday = now.weekday() + 1  # Python weekday: 0=周一, 6=周日
            if current_weekday == 7:
                current_weekday = 0
            if str(current_weekday) != weekday:
                return False
        
        return True
    except Exception:
        return False

