"""
定时任务执行器 Inngest 工作流函数

处理定时任务的执行，支持多种任务类型（python_script、api_call等）。
"""

from inngest import Event, TriggerEvent
from typing import Dict, Any
from datetime import datetime
import httpx
from loguru import logger

from core.inngest.client import inngest_client
from core.models.scheduled_task import ScheduledTask
from core.services.scheduling.scheduled_task_service import ScheduledTaskService
from core.utils.inngest_tenant_isolation import with_tenant_isolation
from infra.domain.tenant_context import get_current_tenant_id


@inngest_client.create_function(
    fn_id="scheduled-task-executor",
    name="定时任务执行器",
    trigger=TriggerEvent(event="scheduled-task/execute"),
    retries=3,
)
@with_tenant_isolation  # 添加租户隔离装饰器
async def scheduled_task_executor_function(event: Event) -> Dict[str, Any]:
    """
    定时任务执行器工作流函数
    
    监听 scheduled-task/execute 事件，执行定时任务。
    支持多种任务类型：python_script、api_call 等。
    
    租户隔离已由装饰器自动处理，可以直接使用 get_current_tenant_id() 获取租户ID。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 执行结果
    """
    # 从上下文获取 tenant_id（装饰器已验证和设置）
    tenant_id = get_current_tenant_id()
    
    data = event.data or {}
    task_uuid = data.get("task_uuid")
    inngest_run_id = getattr(event, "id", None)
    
    if not task_uuid:
        return {
            "success": False,
            "error": "缺少必要参数：task_uuid"
        }
    
    # 获取定时任务
    try:
        scheduled_task = await ScheduledTaskService.get_scheduled_task_by_uuid(
            tenant_id, task_uuid
        )
    except Exception as e:
        logger.error(f"获取定时任务失败: {task_uuid}, 错误: {e}")
        return {
            "success": False,
            "error": f"获取定时任务失败: {str(e)}"
        }
    
    # 检查任务是否启用
    if not scheduled_task.is_active:
        logger.info(f"定时任务 {task_uuid} 未启用，跳过执行")
        return {
            "success": False,
            "error": "任务未启用"
        }
    
    # 标记任务开始运行
    try:
        await ScheduledTaskService.mark_task_running(
            tenant_id=tenant_id,
            task_uuid=task_uuid,
            inngest_run_id=str(inngest_run_id) if inngest_run_id else None
        )
    except Exception as e:
        logger.error(f"标记任务运行失败: {task_uuid}, 错误: {e}")
        return {
            "success": False,
            "error": f"标记任务运行失败: {str(e)}"
        }
    
    # 执行任务
    try:
        if scheduled_task.type == "api_call":
            result = await _execute_api_call_task(scheduled_task)
        elif scheduled_task.type == "python_script":
            result = await _execute_python_script_task(scheduled_task)
        else:
            result = {
                "success": False,
                "error": f"不支持的任务类型: {scheduled_task.type}"
            }
        
        # 更新任务执行结果
        await ScheduledTaskService.update_task_execution_result(
            tenant_id=tenant_id,
            task_uuid=task_uuid,
            status="success" if result.get("success") else "failed",
            error=result.get("error"),
            inngest_run_id=str(inngest_run_id) if inngest_run_id else None
        )
        
        return result
    except Exception as e:
        # 更新任务执行结果为失败
        await ScheduledTaskService.update_task_execution_result(
            tenant_id=tenant_id,
            task_uuid=task_uuid,
            status="failed",
            error=str(e),
            inngest_run_id=str(inngest_run_id) if inngest_run_id else None
        )
        
        logger.error(f"执行定时任务失败: {task_uuid}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def _execute_api_call_task(scheduled_task: ScheduledTask) -> Dict[str, Any]:
    """
    执行 API 调用任务
    
    Args:
        scheduled_task: 定时任务对象
        
    Returns:
        Dict[str, Any]: 执行结果
    """
    task_config = scheduled_task.task_config or {}
    url = task_config.get("url")
    method = task_config.get("method", "POST")
    headers = task_config.get("headers", {})
    data = task_config.get("data", {})
    timeout = task_config.get("timeout", 30)
    
    if not url:
        return {
            "success": False,
            "error": "API 调用任务缺少 URL 配置"
        }
    
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            if method.upper() == "GET":
                response = await client.get(url, headers=headers, params=data)
            elif method.upper() == "POST":
                response = await client.post(url, headers=headers, json=data)
            elif method.upper() == "PUT":
                response = await client.put(url, headers=headers, json=data)
            elif method.upper() == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                return {
                    "success": False,
                    "error": f"不支持的 HTTP 方法: {method}"
                }
            
            response.raise_for_status()
            
            return {
                "success": True,
                "status_code": response.status_code,
                "response": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
            }
    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "error": f"HTTP 错误: {e.response.status_code} - {e.response.text}"
        }
    except httpx.RequestError as e:
        return {
            "success": False,
            "error": f"请求错误: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"执行 API 调用失败: {str(e)}"
        }


async def _execute_python_script_task(scheduled_task: ScheduledTask) -> Dict[str, Any]:
    """
    执行 Python 脚本任务
    
    Args:
        scheduled_task: 定时任务对象
        
    Returns:
        Dict[str, Any]: 执行结果
    """
    task_config = scheduled_task.task_config or {}
    script_code = task_config.get("script_code")
    script_path = task_config.get("script_path")
    
    if not script_code and not script_path:
        return {
            "success": False,
            "error": "Python 脚本任务缺少脚本代码或脚本路径"
        }
    
    # TODO: 实现 Python 脚本执行逻辑
    # 注意：执行用户提供的 Python 代码需要严格的安全控制
    # 建议使用沙箱环境或限制可用的函数和模块
    
    logger.warning(f"Python 脚本任务执行功能尚未实现: {scheduled_task.uuid}")
    
    return {
        "success": False,
        "error": "Python 脚本任务执行功能尚未实现"
    }

