"""
设备点检/保养督促异步工作流（Taskiq 事件处理器）。
"""

from datetime import datetime
from typing import Any, Dict

from loguru import logger

from apps.kuaizhizao.services.equipment_supervision_service import (
    check_and_notify_spot_check_overdue,
    dispatch_maintenance_supervision,
)
from core.tasks.dispatcher import TaskEvent, dispatch_event
from core.tasks.event_compat import Event, TriggerEvent
from core.utils.timezone_utils import to_api_isoformat
from core.utils.workflow_tenant_isolation import with_tenant_isolation
from core.workflows.client import workflow_client
from infra.domain.tenant_context import get_current_tenant_id


async def run_equipment_supervision_scheduler() -> Dict[str, Any]:
    now = datetime.now()
    try:
        await dispatch_event(
            TaskEvent(
                name="equipment-supervision/check",
                data={"timestamp": to_api_isoformat(now)},
            )
        )
        logger.info("已发送设备督促检查事件: {}", to_api_isoformat(now))
        return {"success": True, "timestamp": to_api_isoformat(now)}
    except Exception as exc:
        logger.error("设备督促调度器执行失败: {}", exc)
        return {"success": False, "error": str(exc)}


@workflow_client.create_function(
    fn_id="equipment-supervision-checker",
    name="设备点检/保养督促工作流",
    trigger=TriggerEvent(event="equipment-supervision/check"),
    retries=3,
)
@with_tenant_isolation
async def equipment_supervision_checker_function(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    try:
        spot_result = await check_and_notify_spot_check_overdue(tenant_id=tenant_id)
        logger.info("设备点检督促完成: 租户 {} {}", tenant_id, spot_result)
        return {"success": True, "tenant_id": tenant_id, **spot_result}
    except Exception as exc:
        logger.error("设备点检督促失败: 租户 {} 错误: {}", tenant_id, exc)
        return {"success": False, "tenant_id": tenant_id, "error": str(exc)}
