"""
定时任务调度器。

每分钟检查需要执行的定时任务，并通过 Taskiq 投递 scheduled-task/execute 事件。
"""

from datetime import datetime, timedelta
from typing import Any, Dict

from loguru import logger

from core.models.scheduled_task import ScheduledTask
from core.tasks.dispatcher import TaskEvent, dispatch_event
from core.utils.timezone_utils import to_api_isoformat


async def run_scheduled_task_scheduler_tick() -> Dict[str, Any]:
    """
    每分钟执行一次，检查所有启用的定时任务，判断是否需要执行。
    需要执行时投递 scheduled-task/execute 事件。
    """
    now = datetime.now()
    executed_count = 0

    try:
        active_tasks = await ScheduledTask.filter(
            is_active=True,
            deleted_at__isnull=True,
        ).all()

        for task in active_tasks:
            try:
                should_execute = await _should_execute_task(task, now)

                if should_execute:
                    await dispatch_event(
                        TaskEvent(
                            name="scheduled-task/execute",
                            data={
                                "tenant_id": task.tenant_id,
                                "task_uuid": str(task.uuid),
                            },
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
            "timestamp": to_api_isoformat(now),
        }
    except Exception as e:
        logger.error(f"定时任务调度器执行失败: {e}")
        return {
            "success": False,
            "error": str(e),
        }


async def _should_execute_task(task: ScheduledTask, now: datetime) -> bool:
    """判断定时任务是否需要执行。"""
    trigger_type = task.trigger_type
    trigger_config = task.trigger_config or {}

    if task.is_running:
        return False

    if trigger_type == "cron":
        cron_expr = trigger_config.get("cron")
        if not cron_expr:
            return False
        return _match_cron(cron_expr, now)

    if trigger_type == "interval":
        seconds = trigger_config.get("seconds", 0)
        if seconds <= 0:
            return False

        if not task.last_run_at:
            return True

        next_run_time = task.last_run_at + timedelta(seconds=seconds)
        return now >= next_run_time

    if trigger_type == "date":
        at_time = trigger_config.get("at")
        if not at_time:
            return False

        try:
            if isinstance(at_time, str):
                target_time = datetime.fromisoformat(at_time.replace("Z", "+00:00"))
            else:
                target_time = at_time

            if task.last_run_at:
                return False

            time_diff = abs((now - target_time).total_seconds())
            return time_diff <= 60
        except Exception as e:
            logger.error(f"解析日期触发器失败: {at_time}, 错误: {e}")
            return False

    return False


def _match_cron(cron_expr: str, now: datetime) -> bool:
    """简单的 cron 表达式匹配（与历史实现一致）。"""
    try:
        parts = cron_expr.strip().split()
        if len(parts) != 5:
            return False

        minute, hour, day, month, weekday = parts

        if minute != "*" and str(now.minute) != minute:
            return False
        if hour != "*" and str(now.hour) != hour:
            return False
        if day != "*" and str(now.day) != day:
            return False
        if month != "*" and str(now.month) != month:
            return False

        if weekday != "*":
            current_weekday = now.weekday() + 1
            if current_weekday == 7:
                current_weekday = 0
            if str(current_weekday) != weekday:
                return False

        return True
    except Exception:
        return False

