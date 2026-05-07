"""
异常自动检测异步工作流（Taskiq 事件处理器）。
"""

from datetime import datetime
from typing import Any, Dict

from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.services.exception_service import ExceptionService
from core.tasks.dispatcher import TaskEvent, dispatch_event
from core.tasks.event_compat import Event, TriggerEvent
from core.utils.workflow_tenant_isolation import with_tenant_isolation
from core.workflows.client import workflow_client
from infra.domain.tenant_context import get_current_tenant_id


async def run_exception_detection_scheduler() -> Dict[str, Any]:
    now = datetime.now()
    try:
        await dispatch_event(TaskEvent(name="exception/detect-all", data={"timestamp": now.isoformat()}))
        logger.info(f"已发送异常检测事件: {now.isoformat()}")
        return {"success": True, "tenant_count": 1, "timestamp": now.isoformat()}
    except Exception as e:
        logger.error(f"异常检测调度器执行失败: {e}")
        return {"success": False, "error": str(e)}


@workflow_client.create_function(
    fn_id="exception-detection-worker",
    name="异常自动检测工作流",
    trigger=TriggerEvent(event="exception/detect-all"),
    retries=3,
)
@with_tenant_isolation
async def exception_detection_worker_function(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    data = event.data or {}
    timestamp = data.get("timestamp", datetime.now().isoformat())
    exception_service = ExceptionService()
    results = {
        "tenant_id": tenant_id,
        "timestamp": timestamp,
        "material_shortage": {"detected": 0, "created": 0},
        "delivery_delay": {"detected": 0, "created": 0},
        "quality": {"detected": 0, "created": 0},
    }
    try:
        try:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                status__in=["released", "in_progress"],
                deleted_at__isnull=True,
            ).all()
            for work_order in work_orders:
                try:
                    exceptions = await exception_service.detect_material_shortage(
                        tenant_id=tenant_id,
                        work_order_id=work_order.id,
                    )
                    results["material_shortage"]["detected"] += len(exceptions)
                    results["material_shortage"]["created"] += len(exceptions)
                except Exception as e:
                    logger.error(f"检测工单 {work_order.id} 缺料异常失败: {e}")
        except Exception as e:
            logger.error(f"检测缺料异常失败: {e}")

        try:
            exceptions = await exception_service.detect_delivery_delay(
                tenant_id=tenant_id,
                work_order_id=None,
                days_threshold=0,
            )
            results["delivery_delay"]["detected"] = len(exceptions)
            results["delivery_delay"]["created"] = len(exceptions)
        except Exception as e:
            logger.error(f"检测延期异常失败: {e}")

        logger.info(f"租户 {tenant_id} 异常检测完成: {results}")
        return {"success": True, **results}
    except Exception as e:
        logger.error(f"异常检测工作流执行失败 (tenant_id={tenant_id}): {e}")
        return {"success": False, "tenant_id": tenant_id, "error": str(e)}


@workflow_client.create_function(
    fn_id="exception-detection-by-tenant",
    name="按租户异常检测",
    trigger=TriggerEvent(event="exception/detect"),
    retries=3,
)
@with_tenant_isolation
async def exception_detection_by_tenant_function(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    data = event.data or {}
    work_order_id = data.get("work_order_id")
    exception_service = ExceptionService()
    results = {
        "tenant_id": tenant_id,
        "work_order_id": work_order_id,
        "material_shortage": {"detected": 0, "created": 0},
        "delivery_delay": {"detected": 0, "created": 0},
    }
    try:
        if work_order_id:
            try:
                exceptions = await exception_service.detect_material_shortage(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                )
                results["material_shortage"]["detected"] = len(exceptions)
                results["material_shortage"]["created"] = len(exceptions)
            except Exception as e:
                logger.error(f"检测工单 {work_order_id} 缺料异常失败: {e}")
        else:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                status__in=["released", "in_progress"],
                deleted_at__isnull=True,
            ).all()
            for work_order in work_orders:
                try:
                    exceptions = await exception_service.detect_material_shortage(
                        tenant_id=tenant_id,
                        work_order_id=work_order.id,
                    )
                    results["material_shortage"]["detected"] += len(exceptions)
                    results["material_shortage"]["created"] += len(exceptions)
                except Exception as e:
                    logger.error(f"检测工单 {work_order.id} 缺料异常失败: {e}")

        try:
            exceptions = await exception_service.detect_delivery_delay(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                days_threshold=0,
            )
            results["delivery_delay"]["detected"] = len(exceptions)
            results["delivery_delay"]["created"] = len(exceptions)
        except Exception as e:
            logger.error(f"检测延期异常失败: {e}")

        logger.info(f"租户 {tenant_id} 异常检测完成: {results}")
        return {"success": True, **results}
    except Exception as e:
        logger.error(f"异常检测工作流执行失败 (tenant_id={tenant_id}): {e}")
        return {"success": False, "tenant_id": tenant_id, "error": str(e)}

