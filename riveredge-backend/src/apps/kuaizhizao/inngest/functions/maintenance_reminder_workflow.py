"""
设备维护提醒异步工作流（Taskiq 事件处理器）

定时检查维护计划到期情况，创建维护提醒。

Author: Luigi Lu
Date: 2026-01-16
"""

from inngest import Event, TriggerEvent
from typing import Dict, Any
from datetime import datetime
from loguru import logger

from core.inngest.client import inngest_client
from core.tasks.dispatcher import TaskEvent, dispatch_event
from apps.kuaizhizao.services.maintenance_reminder_service import MaintenanceReminderService
from core.utils.inngest_tenant_isolation import with_tenant_isolation
from infra.domain.tenant_context import get_current_tenant_id


async def run_maintenance_reminder_scheduler() -> Dict[str, Any]:
    """由 Taskiq 定时任务每天调用：投递 maintenance-reminder/check。"""
    now = datetime.now()

    try:
        await dispatch_event(
            TaskEvent(
                name="maintenance-reminder/check",
                data={
                    "timestamp": now.isoformat(),
                    "advance_days": 7,
                },
            )
        )
        logger.info(f"已发送维护提醒检查事件: {now.isoformat()}")

        return {
            "success": True,
            "timestamp": now.isoformat(),
        }
    except Exception as e:
        logger.error(f"维护提醒调度器执行失败: {e}")
        return {
            "success": False,
            "error": str(e),
        }


@inngest_client.create_function(
    fn_id="maintenance-reminder-checker",
    name="设备维护提醒检查工作流",
    trigger=TriggerEvent(event="maintenance-reminder/check"),
    retries=3,
)
@with_tenant_isolation  # 添加租户隔离装饰器
async def maintenance_reminder_checker_function(event: Event) -> Dict[str, Any]:
    """
    设备维护提醒检查工作流函数
    
    监听 maintenance-reminder/check 事件，检查维护计划到期情况并创建提醒。
    
    租户隔离已由装饰器自动处理，可以直接使用 get_current_tenant_id() 获取租户ID。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 检查结果
    """
    # 从上下文获取 tenant_id（装饰器已验证和设置）
    tenant_id = get_current_tenant_id()
    
    data = event.data or {}
    advance_days = data.get("advance_days", 7)
    timestamp = data.get("timestamp", datetime.now().isoformat())
    
    try:
        reminder_service = MaintenanceReminderService()
        result = await reminder_service.check_maintenance_plans(
            tenant_id=tenant_id,
            advance_days=advance_days,
        )
        
        logger.info(f"维护提醒检查完成: 租户 {tenant_id}, 创建提醒数: {result['reminder_count']}")
        
        return {
            "success": True,
            "tenant_id": tenant_id,
            **result
        }
    except Exception as e:
        logger.error(f"维护提醒检查失败: 租户 {tenant_id}, 错误: {e}")
        return {
            "success": False,
            "tenant_id": tenant_id,
            "error": str(e)
        }
