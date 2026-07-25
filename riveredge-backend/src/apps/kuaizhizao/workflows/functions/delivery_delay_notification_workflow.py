"""
销售/采购交期延误提醒异步工作流（Taskiq）。
"""

from datetime import datetime
from typing import Any, Dict

from loguru import logger

from apps.kuaizhizao.services.delivery_delay_notification_service import (
    check_and_notify_delivery_delays,
)
from core.tasks.dispatcher import TaskEvent, dispatch_event
from core.tasks.event_compat import Event, TriggerEvent
from core.utils.timezone_utils import to_api_isoformat
from core.utils.workflow_tenant_isolation import with_tenant_isolation
from core.workflows.client import workflow_client
from infra.domain.tenant_context import get_current_tenant_id


async def run_delivery_delay_notification_scheduler() -> Dict[str, Any]:
    now = datetime.now()
    try:
        await dispatch_event(
            TaskEvent(
                name="delivery-delay-notification/check",
                data={"timestamp": to_api_isoformat(now)},
            )
        )
        logger.info("已发送交期延误提醒检查事件: {}", to_api_isoformat(now))
        return {"success": True, "timestamp": to_api_isoformat(now)}
    except Exception as exc:
        logger.error("交期延误提醒调度失败: {}", exc)
        return {"success": False, "error": str(exc)}


@workflow_client.create_function(
    fn_id="delivery-delay-notification-checker",
    name="销售/采购交期延误提醒工作流",
    trigger=TriggerEvent(event="delivery-delay-notification/check"),
    retries=2,
)
@with_tenant_isolation
async def delivery_delay_notification_checker_function(event: Event) -> Dict[str, Any]:
    del event
    tenant_id = get_current_tenant_id()
    try:
        result = await check_and_notify_delivery_delays(tenant_id=tenant_id)
        return {"success": True, "tenant_id": tenant_id, **result}
    except Exception as exc:
        logger.error("交期延误提醒失败: 租户 {} 错误: {}", tenant_id, exc)
        return {"success": False, "tenant_id": tenant_id, "error": str(exc)}
