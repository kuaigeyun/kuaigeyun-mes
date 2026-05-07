"""
审批流程工作流注册（Taskiq 事件链）。

审批工作流函数（approval-workflow、approval-action-workflow）已在应用启动时静态注册，
此处主要维护 approval_process.inngest_workflow_id 用于追踪和关联。
"""

from typing import Any, Dict

from loguru import logger

from core.models.approval_process import ApprovalProcess


async def register_approval_workflow(
    approval_process: ApprovalProcess,
    inngest_config: Dict[str, Any],
) -> str:
    workflow_id = str(approval_process.uuid)
    logger.debug(
        f"审批流程注册: process_id={approval_process.id}, "
        f"workflow_id={workflow_id}, steps={len(inngest_config.get('steps', []))}",
    )
    return workflow_id


async def unregister_approval_workflow(workflow_id: str) -> None:
    logger.debug(f"审批流程注销: workflow_id={workflow_id}")

