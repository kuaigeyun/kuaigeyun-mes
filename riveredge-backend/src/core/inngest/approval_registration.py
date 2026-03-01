"""
审批流程 Inngest 工作流注册

提供审批流程与 Inngest 工作流的注册/注销接口。
审批工作流函数（approval-workflow、approval-action-workflow）已在应用启动时静态注册，
此处主要维护 approval_process.inngest_workflow_id 用于追踪和关联。

Author: Luigi Lu
"""

from typing import Dict, Any
from loguru import logger

from core.models.approval_process import ApprovalProcess


async def register_approval_workflow(
    approval_process: ApprovalProcess,
    inngest_config: Dict[str, Any]
) -> str:
    """
    注册审批流程到 Inngest（维护 workflow_id 追踪）

    审批工作流函数已在应用启动时注册，此处将 process.uuid 作为 workflow_id 存储，
    用于后续事件触发时关联流程配置。

    Args:
        approval_process: 审批流程对象
        inngest_config: Inngest 工作流配置（由 convert_proflow_to_inngest 生成）

    Returns:
        str: 工作流 ID（使用 process.uuid）
    """
    workflow_id = str(approval_process.uuid)
    logger.debug(
        f"审批流程注册: process_id={approval_process.id}, "
        f"workflow_id={workflow_id}, steps={len(inngest_config.get('steps', []))}"
    )
    return workflow_id


async def unregister_approval_workflow(workflow_id: str) -> None:
    """
    注销审批流程的 Inngest 工作流

    审批工作流为静态注册，此处主要做清理记录，实际无需向 Inngest 注销。

    Args:
        workflow_id: 工作流 ID（即 process.uuid）
    """
    logger.debug(f"审批流程注销: workflow_id={workflow_id}")
