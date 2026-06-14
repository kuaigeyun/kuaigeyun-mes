"""
审批流程工作流函数。
"""

from datetime import datetime
from typing import Any, Dict

from loguru import logger

from core.models.approval_instance import ApprovalInstance
from core.models.approval_process import ApprovalProcess
from core.services.approval.approval_instance_service import ApprovalInstanceService
from core.tasks.event_compat import Event, TriggerEvent
from core.utils.workflow_tenant_isolation import with_tenant_isolation
from core.workflows.client import workflow_client
from infra.domain.tenant_context import get_current_tenant_id
from infra.exceptions.exceptions import NotFoundError


@workflow_client.create_function(
    fn_id="approval-workflow",
    name="审批流程工作流",
    trigger=TriggerEvent(event="approval/submit"),
    retries=3,
)
@with_tenant_isolation
async def approval_workflow_function(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    data = event.data or {}
    approval_id = data.get("approval_id")
    process_id = data.get("process_id")
    inngest_run_id = getattr(event, "id", None)

    if not approval_id or not process_id:
        return {"success": False, "error": "缺少必要参数：approval_id 或 process_id"}

    try:
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(tenant_id, approval_id)
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            uuid=process_id,
            deleted_at__isnull=True,
        ).first()

        if not process:
            return {"success": False, "error": f"审批流程不存在: {process_id}"}

        if inngest_run_id:
            approval_instance.inngest_run_id = str(inngest_run_id)
            await approval_instance.save()

        await approval_instance.fetch_related("process")
        bootstrapped = await ApprovalInstanceService.bootstrap_instance_workflow(
            tenant_id, approval_instance
        )

        logger.info(
            f"审批流程工作流: {approval_id}, 当前节点: {approval_instance.current_node}, "
            f"bootstrap={bootstrapped}"
        )
        return {
            "success": True,
            "approval_id": approval_id,
            "current_node": approval_instance.current_node,
            "tasks_created": bootstrapped,
        }
    except NotFoundError as e:
        logger.error(f"审批流程工作流失败: {approval_id}, 错误: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"审批流程工作流失败: {approval_id}, 错误: {e}")
        return {"success": False, "error": str(e)}


@workflow_client.create_function(
    fn_id="approval-action-workflow",
    name="审批操作工作流",
    trigger=TriggerEvent(event="approval/action"),
    retries=3,
)
@with_tenant_isolation
async def approval_action_workflow_function(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    data = event.data or {}
    approval_id = data.get("approval_id")
    action = data.get("action")
    transfer_to_user_id = data.get("transfer_to_user_id")

    if not approval_id or not action:
        return {"success": False, "error": "缺少必要参数：approval_id 或 action"}

    try:
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(tenant_id, approval_id)
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            uuid=str(approval_instance.process.uuid),
            deleted_at__isnull=True,
        ).first()
        if not process:
            return {"success": False, "error": "审批流程不存在"}

        if action == "approve" and approval_instance.status == "approved":
            next_node = _get_next_node(process.nodes, approval_instance.current_node)
            if next_node:
                approval_instance.current_node = next_node.get("id")
                approval_instance.current_approver_id = _get_node_approver(next_node, approval_instance)
                approval_instance.status = "pending"
                approval_instance.completed_at = None
        elif action == "reject" and approval_instance.status == "rejected":
            approval_instance.current_node = None
            approval_instance.current_approver_id = None
        elif action == "cancel" and approval_instance.status == "cancelled":
            approval_instance.current_node = None
            approval_instance.current_approver_id = None
        elif action == "transfer":
            if not transfer_to_user_id:
                return {"success": False, "error": "转交操作必须指定目标用户"}
            approval_instance.current_approver_id = transfer_to_user_id

        await approval_instance.save()
        logger.info(f"审批操作工作流完成: {approval_id}, 操作: {action}, 状态: {approval_instance.status}")
        return {
            "success": True,
            "approval_id": approval_id,
            "action": action,
            "status": approval_instance.status,
            "current_node": approval_instance.current_node,
            "current_approver_id": approval_instance.current_approver_id,
        }
    except NotFoundError as e:
        logger.error(f"审批操作工作流失败: {approval_id}, 错误: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"审批操作工作流失败: {approval_id}, 错误: {e}")
        return {"success": False, "error": str(e)}


def _get_start_node(nodes: Dict[str, Any]) -> Dict[str, Any] | None:
    if not nodes:
        return None
    node_list = nodes.get("nodes", [])
    for node in node_list:
        if node.get("type") == "start" or node.get("data", {}).get("type") == "start":
            return node
    return node_list[0] if node_list else None


def _get_next_node(nodes: Dict[str, Any], current_node_id: str) -> Dict[str, Any] | None:
    if not nodes or not current_node_id:
        return None
    edges = nodes.get("edges", [])
    node_list = nodes.get("nodes", [])
    for edge in edges:
        if edge.get("source") == current_node_id:
            next_node_id = edge.get("target")
            for node in node_list:
                if node.get("id") == next_node_id:
                    if node.get("type") == "end" or node.get("data", {}).get("type") == "end":
                        return None
                    return node
    return None


def _get_node_approver(node: Dict[str, Any], approval_instance: ApprovalInstance) -> int:
    node_data = node.get("data", {})
    approver_id = node_data.get("approver_id")
    return approver_id or approval_instance.submitter_id

