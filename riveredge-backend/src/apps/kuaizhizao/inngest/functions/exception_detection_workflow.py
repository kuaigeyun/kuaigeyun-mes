"""
异常自动检测 Inngest 工作流函数

定时检测异常（缺料异常、延期异常、质量异常）并创建异常记录。
"""

from inngest import TriggerCron, Event, TriggerEvent
from typing import Dict, Any, Optional
from datetime import datetime
from loguru import logger

from core.inngest.client import inngest_client
from apps.kuaizhizao.services.exception_service import ExceptionService
from apps.kuaizhizao.models.work_order import WorkOrder
from core.utils.inngest_tenant_isolation import with_tenant_isolation
from infra.domain.tenant_context import get_current_tenant_id


@inngest_client.create_function(
    fn_id="exception-detection-scheduler",
    name="异常自动检测调度器",
    trigger=TriggerCron(cron="0 */1 * * *"),  # 每小时执行一次
)
async def exception_detection_scheduler_function(*args, **kwargs) -> Dict[str, Any]:
    """
    异常自动检测调度器工作流函数
    
    每小时执行一次，检测所有租户的异常情况。
    为每个租户发送异常检测事件。
    
    注意：使用 TriggerCron 时，Inngest 可能会传递 ctx (Context) 参数。
    使用 *args 和 **kwargs 来接受任意参数，确保兼容不同版本的 SDK。
    
    Returns:
        Dict[str, Any]: 调度结果
    """
    now = datetime.now()
    tenant_count = 0
    
    try:
        # 获取所有活跃的租户（这里简化处理，实际应该从租户表获取）
        # 为了支持多租户，我们需要为每个租户发送事件
        # 这里先实现单租户版本，后续可以扩展为多租户
        
        # 发送异常检测事件（不指定tenant_id，由检测函数处理所有租户）
        await inngest_client.send(
            Event(
                name="exception/detect-all",
                data={
                    "timestamp": now.isoformat(),
                }
            )
        )
        tenant_count = 1
        logger.info(f"已发送异常检测事件: {now.isoformat()}")
        
        return {
            "success": True,
            "tenant_count": tenant_count,
            "timestamp": now.isoformat()
        }
    except Exception as e:
        logger.error(f"异常检测调度器执行失败: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@inngest_client.create_function(
    fn_id="exception-detection-worker",
    name="异常自动检测工作流",
    trigger=TriggerEvent(event="exception/detect-all"),
    retries=3,
)
@with_tenant_isolation  # 添加租户隔离装饰器
async def exception_detection_worker_function(event: Event) -> Dict[str, Any]:
    """
    异常自动检测工作流函数
    
    监听 exception/detect-all 事件，检测所有异常情况。
    包括缺料异常、延期异常、质量异常。
    
    租户隔离已由装饰器自动处理，可以直接使用 get_current_tenant_id() 获取租户ID。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 检测结果
    """
    # 从上下文获取 tenant_id（装饰器已验证和设置）
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
        # 1. 检测缺料异常
        try:
            # 获取所有已下达或执行中的工单
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                status__in=["released", "in_progress"],
                deleted_at__isnull=True
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
                    continue
        except Exception as e:
            logger.error(f"检测缺料异常失败: {e}")
        
        # 2. 检测延期异常
        try:
            # 检测所有延期工单（延期天数阈值=0，即只要超过计划结束日期就算延期）
            exceptions = await exception_service.detect_delivery_delay(
                tenant_id=tenant_id,
                work_order_id=None,  # 检测所有工单
                days_threshold=0,
            )
            results["delivery_delay"]["detected"] = len(exceptions)
            results["delivery_delay"]["created"] = len(exceptions)
        except Exception as e:
            logger.error(f"检测延期异常失败: {e}")
        
        # 3. 质量异常检测（TODO: 待质量模块完善后补充）
        # 质量异常通常由检验记录触发，这里暂时跳过
        
        logger.info(f"租户 {tenant_id} 异常检测完成: {results}")
        return {
            "success": True,
            **results
        }
    except Exception as e:
        logger.error(f"异常检测工作流执行失败 (tenant_id={tenant_id}): {e}")
        return {
            "success": False,
            "tenant_id": tenant_id,
            "error": str(e)
        }


@inngest_client.create_function(
    fn_id="exception-detection-by-tenant",
    name="按租户异常检测",
    trigger=TriggerEvent(event="exception/detect"),
    retries=3,
)
@with_tenant_isolation  # 添加租户隔离装饰器
async def exception_detection_by_tenant_function(event: Event) -> Dict[str, Any]:
    """
    按租户异常检测工作流函数
    
    监听 exception/detect 事件，为指定租户检测异常。
    
    Args:
        event: Inngest 事件对象，data 中应包含 tenant_id
    
    Returns:
        Dict[str, Any]: 检测结果
    """
    # 从上下文获取 tenant_id（装饰器已验证和设置）
    tenant_id = get_current_tenant_id()
    
    data = event.data or {}
    work_order_id = data.get("work_order_id")  # 可选，如果指定则只检测该工单
    
    exception_service = ExceptionService()
    results = {
        "tenant_id": tenant_id,
        "work_order_id": work_order_id,
        "material_shortage": {"detected": 0, "created": 0},
        "delivery_delay": {"detected": 0, "created": 0},
    }
    
    try:
        # 1. 检测缺料异常
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
            # 检测所有已下达或执行中的工单
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                status__in=["released", "in_progress"],
                deleted_at__isnull=True
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
                    continue
        
        # 2. 检测延期异常
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
        return {
            "success": True,
            **results
        }
    except Exception as e:
        logger.error(f"异常检测工作流执行失败 (tenant_id={tenant_id}): {e}")
        return {
            "success": False,
            "tenant_id": tenant_id,
            "error": str(e)
        }
