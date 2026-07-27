"""
定时任务执行器工作流函数。
"""

from datetime import datetime
from typing import Any, Dict

import httpx
from loguru import logger

from core.models.scheduled_task import ScheduledTask
from core.schemas.data_backup import DataBackupCreate
from core.services.scheduling.scheduled_task_service import ScheduledTaskService
from core.services.system.data_backup_service import DataBackupService
from core.tasks.event_compat import Event, TriggerEvent
from core.utils.workflow_tenant_isolation import with_tenant_isolation
from core.workflows.client import workflow_client
from infra.domain.tenant_context import get_current_tenant_id
from infra.infrastructure.http import get_http_client
from core.utils.timezone_utils import today_site_str


@workflow_client.create_function(
    fn_id="scheduled-task-executor",
    name="定时任务执行器",
    trigger=TriggerEvent(event="scheduled-task/execute"),
    retries=3,
)
@with_tenant_isolation
async def scheduled_task_executor_function(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    data = event.data or {}
    task_uuid = data.get("task_uuid")
    inngest_run_id = getattr(event, "id", None)

    if not task_uuid:
        return {"success": False, "error": "缺少必要参数：task_uuid"}

    try:
        scheduled_task = await ScheduledTaskService.get_scheduled_task_by_uuid(tenant_id, task_uuid)
    except Exception as e:
        logger.error(f"获取定时任务失败: {task_uuid}, 错误: {e}")
        return {"success": False, "error": f"获取定时任务失败: {str(e)}"}

    if not scheduled_task.is_active:
        logger.info(f"定时任务 {task_uuid} 未启用，跳过执行")
        return {"success": False, "error": "任务未启用"}

    try:
        await ScheduledTaskService.mark_task_running(
            tenant_id=tenant_id,
            task_uuid=task_uuid,
            inngest_run_id=str(inngest_run_id) if inngest_run_id else None,
        )
    except Exception as e:
        logger.error(f"标记任务运行失败: {task_uuid}, 错误: {e}")
        return {"success": False, "error": f"标记任务运行失败: {str(e)}"}

    try:
        if scheduled_task.type == "api_call":
            result = await _execute_api_call_task(scheduled_task)
        elif scheduled_task.type == "python_script":
            result = await _execute_python_script_task(scheduled_task)
        elif scheduled_task.type == "backup":
            result = await _execute_backup_task(tenant_id, scheduled_task)
        else:
            result = {"success": False, "error": f"不支持的任务类型: {scheduled_task.type}"}

        await ScheduledTaskService.update_task_execution_result(
            tenant_id=tenant_id,
            task_uuid=task_uuid,
            status="success" if result.get("success") else "failed",
            error=result.get("error"),
            inngest_run_id=str(inngest_run_id) if inngest_run_id else None,
        )
        return result
    except Exception as e:
        await ScheduledTaskService.update_task_execution_result(
            tenant_id=tenant_id,
            task_uuid=task_uuid,
            status="failed",
            error=str(e),
            inngest_run_id=str(inngest_run_id) if inngest_run_id else None,
        )
        logger.error(f"执行定时任务失败: {task_uuid}, 错误: {e}")
        return {"success": False, "error": str(e)}


async def _execute_api_call_task(scheduled_task: ScheduledTask) -> Dict[str, Any]:
    task_config = scheduled_task.task_config or {}
    url = task_config.get("url")
    method = task_config.get("method", "POST")
    headers = task_config.get("headers", {})
    data = task_config.get("data", {})
    timeout = task_config.get("timeout", 30)
    if not url:
        return {"success": False, "error": "API 调用任务缺少 URL 配置"}
    try:
        client = get_http_client()
        if method.upper() == "GET":
            response = await client.get(url, headers=headers, params=data, timeout=timeout)
        elif method.upper() == "POST":
            response = await client.post(url, headers=headers, json=data, timeout=timeout)
        elif method.upper() == "PUT":
            response = await client.put(url, headers=headers, json=data, timeout=timeout)
        elif method.upper() == "DELETE":
            response = await client.delete(url, headers=headers, timeout=timeout)
        else:
            return {"success": False, "error": f"不支持的 HTTP 方法: {method}"}
        response.raise_for_status()
        return {
            "success": True,
            "status_code": response.status_code,
            "response": (
                response.json()
                if response.headers.get("content-type", "").startswith("application/json")
                else response.text
            ),
        }
    except httpx.HTTPStatusError as e:
        return {"success": False, "error": f"HTTP 错误: {e.response.status_code} - {e.response.text}"}
    except httpx.RequestError as e:
        return {"success": False, "error": f"请求错误: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"执行 API 调用失败: {str(e)}"}


async def _execute_python_script_task(scheduled_task: ScheduledTask) -> Dict[str, Any]:
    task_config = scheduled_task.task_config or {}
    script_code = task_config.get("script_code")
    script_path = task_config.get("script_path")
    if not script_code and not script_path:
        return {"success": False, "error": "Python 脚本任务缺少脚本代码或脚本路径"}
    logger.warning(f"Python 脚本任务执行功能尚未实现: {scheduled_task.uuid}")
    return {"success": False, "error": "Python 脚本任务执行功能尚未实现"}


async def _execute_backup_task(tenant_id: int, scheduled_task: ScheduledTask) -> Dict[str, Any]:
    task_config = scheduled_task.task_config or {}
    name = task_config.get("name", f"自动备份_{today_site_str()}")
    backup_type = task_config.get("backup_type", "full")
    backup_scope = task_config.get("backup_scope", "all")
    include_files = task_config.get("include_files", True)
    backup_tables = task_config.get("backup_tables")
    try:
        data = DataBackupCreate(
            name=name,
            backup_type=backup_type,
            backup_scope=backup_scope,
            include_files=bool(include_files),
            backup_tables=backup_tables,
        )
        backup = await DataBackupService.create_backup_task(tenant_id, data)
        return {"success": True, "backup_uuid": str(backup.uuid), "status": backup.status}
    except Exception as e:
        return {"success": False, "error": f"启动备份任务失败: {str(e)}"}

