"""
异常处理流程 Inngest 工作流函数

处理异常处理流程的工作流执行，包括流程启动、步骤流转、自动处理等。
"""

from inngest import Event, TriggerEvent
from typing import Dict, Any, Optional
from datetime import datetime
from loguru import logger

from core.inngest.client import inngest_client
from apps.kuaizhizao.models.exception_process_record import ExceptionProcessRecord
from apps.kuaizhizao.services.exception_process_service import ExceptionProcessService
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.utils.inngest_tenant_isolation import with_tenant_isolation
from infra.domain.tenant_context import get_current_tenant_id


@inngest_client.create_function(
    fn_id="exception-process-workflow",
    name="异常处理流程工作流",
    trigger=TriggerEvent(event="exception/process/start"),
    retries=3,
)
@with_tenant_isolation  # 添加租户隔离装饰器
async def exception_process_workflow_function(event: Event) -> Dict[str, Any]:
    """
    异常处理流程工作流函数
    
    监听 exception/process/start 事件，启动异常处理流程工作流。
    
    租户隔离已由装饰器自动处理，可以直接使用 get_current_tenant_id() 获取租户ID。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 工作流执行结果
    """
    # 从上下文获取 tenant_id（装饰器已验证和设置）
    tenant_id = get_current_tenant_id()
    
    data = event.data or {}
    process_record_id = data.get("process_record_id")
    exception_type = data.get("exception_type")
    exception_id = data.get("exception_id")
    inngest_run_id = getattr(event, "id", None)
    
    if not process_record_id:
        return {
            "success": False,
            "error": "缺少必要参数：process_record_id"
        }
    
    try:
        # 获取处理记录
        process_record = await ExceptionProcessRecord.filter(
            tenant_id=tenant_id,
            id=process_record_id,
            deleted_at__isnull=True
        ).first()
        
        if not process_record:
            return {
                "success": False,
                "error": f"异常处理记录不存在: {process_record_id}"
            }
        
        # 更新处理记录的 Inngest run_id
        if inngest_run_id:
            process_record.inngest_run_id = str(inngest_run_id)
            await process_record.save()
        
        # 如果已分配，则进入处理中状态
        if process_record.assigned_to:
            process_record.process_status = "processing"
            if process_record.current_step == "detected":
                process_record.current_step = "assigned"
            await process_record.save()
        
        logger.info(f"异常处理流程工作流启动: {process_record_id}, 异常类型: {exception_type}, 异常ID: {exception_id}")
        
        return {
            "success": True,
            "process_record_id": process_record_id,
            "exception_type": exception_type,
            "exception_id": exception_id,
            "process_status": process_record.process_status,
            "current_step": process_record.current_step
        }
    except NotFoundError as e:
        logger.error(f"异常处理流程工作流失败: {process_record_id}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"异常处理流程工作流失败: {process_record_id}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@inngest_client.create_function(
    fn_id="exception-process-step-transition-workflow",
    name="异常处理步骤流转工作流",
    trigger=TriggerEvent(event="exception/process/step-transition"),
    retries=3,
)
@with_tenant_isolation  # 添加租户隔离装饰器
async def exception_process_step_transition_workflow_function(event: Event) -> Dict[str, Any]:
    """
    异常处理步骤流转工作流函数
    
    监听 exception/process/step-transition 事件，处理异常处理流程的步骤流转。
    
    租户隔离已由装饰器自动处理，可以直接使用 get_current_tenant_id() 获取租户ID。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 工作流执行结果
    """
    # 从上下文获取 tenant_id（装饰器已验证和设置）
    tenant_id = get_current_tenant_id()
    
    data = event.data or {}
    process_record_id = data.get("process_record_id")
    to_step = data.get("to_step")
    
    if not process_record_id or not to_step:
        return {
            "success": False,
            "error": "缺少必要参数：process_record_id 或 to_step"
        }
    
    try:
        # 获取处理记录
        process_record = await ExceptionProcessRecord.filter(
            tenant_id=tenant_id,
            id=process_record_id,
            deleted_at__isnull=True
        ).first()
        
        if not process_record:
            return {
                "success": False,
                "error": f"异常处理记录不存在: {process_record_id}"
            }
        
        # 更新步骤
        process_record.current_step = to_step
        if process_record.process_status == "pending":
            process_record.process_status = "processing"
        await process_record.save()
        
        logger.info(f"异常处理流程步骤流转: {process_record_id}, 步骤: {to_step}")
        
        return {
            "success": True,
            "process_record_id": process_record_id,
            "current_step": to_step,
            "process_status": process_record.process_status
        }
    except Exception as e:
        logger.error(f"异常处理步骤流转工作流失败: {process_record_id}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }
