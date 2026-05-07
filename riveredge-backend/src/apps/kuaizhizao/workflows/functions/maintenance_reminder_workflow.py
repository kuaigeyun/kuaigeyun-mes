"""
设备维护提醒异步工作流（Taskiq 事件处理器）。
"""

from datetime import datetime
from typing import Any, Dict

from loguru import logger

from apps.kuaizhizao.services.maintenance_reminder_service import MaintenanceReminderService
from core.tasks.dispatcher import TaskEvent, dispatch_event
from core.tasks.event_compat import Event, TriggerEvent
from core.utils.workflow_tenant_isolation import with_tenant_isolation
from core.workflows.client import workflow_client
from infra.domain.tenant_context import get_current_tenant_id


async def run_maintenance_reminder_scheduler() -> Dict[str, Any]:
    now = datetime.now()
    try:
        await dispatch_event(
            TaskEvent(
                name="maintenance-reminder/check",
                data={"timestamp": now.isoformat(), "advance_days": 7},
            )
        )
        logger.info(f"已发送维护提醒检查事件: {now.isoformat()}")
        return {"success": True, "timestamp": now.isoformat()}
    except Exception as e:
        logger.error(f"维护提醒调度器执行失败: {e}")
        return {"success": False, "error": str(e)}


@workflow_client.create_function(
    fn_id="maintenance-reminder-checker",
    name="设备维护提醒检查工作流",
    trigger=TriggerEvent(event="maintenance-reminder/check"),
    retries=3,
)
@with_tenant_isolation
async def maintenance_reminder_checker_function(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    data = event.data or {}
    advance_days = data.get("advance_days", 7)
    try:
        reminder_service = MaintenanceReminderService()
        result = await reminder_service.check_maintenance_plans(
            tenant_id=tenant_id,
            advance_days=advance_days,
        )
        logger.info(f"维护提醒检查完成: 租户 {tenant_id}, 创建提醒数: {result['reminder_count']}")
        return {"success": True, "tenant_id": tenant_id, **result}
    except Exception as e:
        logger.error(f"维护提醒检查失败: 租户 {tenant_id}, 错误: {e}")
        return {"success": False, "tenant_id": tenant_id, "error": str(e)}

