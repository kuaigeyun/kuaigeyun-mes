"""审批流：当前查看者在 pending 实例上的可操作项（UI 与 execute_approval 同源）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from core.models.approval_instance import ApprovalInstance
from core.models.approval_task import ApprovalTask


def current_node_eligible_user_ids(nodes_overview: List[Dict[str, Any]]) -> List[int]:
    for node in nodes_overview or []:
        if not node.get("is_current"):
            continue
        ids: List[int] = []
        for item in node.get("eligible_approvers") or []:
            if not isinstance(item, dict):
                continue
            raw = item.get("user_id")
            if raw is None:
                continue
            try:
                ids.append(int(raw))
            except (TypeError, ValueError):
                continue
        return ids
    return []


def _eligible_display_names(nodes_overview: List[Dict[str, Any]]) -> List[str]:
    for node in nodes_overview or []:
        if not node.get("is_current"):
            continue
        names: List[str] = []
        for item in node.get("eligible_approvers") or []:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if name:
                names.append(name)
        return names
    return []


def viewer_has_pending_task_on_instance(
    *,
    viewer_id: int,
    instance: ApprovalInstance,
    tasks: List[ApprovalTask],
) -> bool:
    current_node = str(instance.current_node or "")
    for task in tasks:
        if task.status != "pending":
            continue
        if task.approver_id is None:
            continue
        if int(task.approver_id) != int(viewer_id):
            continue
        if current_node and str(task.node_id or "") != current_node:
            continue
        return True
    return False


def build_flow_viewer_actions(
    *,
    viewer_id: Optional[int],
    instance: Optional[ApprovalInstance],
    tasks: List[ApprovalTask],
    nodes_overview: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    pending 流程下 approve/reject 仅当查看者持有当前节点 pending 任务时为 True。
    与 ApprovalInstanceService.execute_approval 一致，禁止仅用 RBAC :review 冒充可审。
    """
    if viewer_id is None or not instance or instance.status != "pending":
        return {
            "has_my_pending_task": False,
            "approve": False,
            "reject": False,
            "block_reason": None,
        }

    has_task = viewer_has_pending_task_on_instance(
        viewer_id=int(viewer_id),
        instance=instance,
        tasks=tasks,
    )
    if has_task:
        return {
            "has_my_pending_task": True,
            "approve": True,
            "reject": True,
            "block_reason": None,
        }

    names = _eligible_display_names(nodes_overview)
    if names:
        block_reason = f"当前节点待办人：{'、'.join(names)}"
    else:
        eligible = current_node_eligible_user_ids(nodes_overview)
        if eligible and int(viewer_id) in eligible:
            block_reason = "您在该节点可审名单中，但待办任务未就绪，请刷新或联系管理员"
        else:
            block_reason = "您不是当前节点待办人"

    return {
        "has_my_pending_task": False,
        "approve": False,
        "reject": False,
        "block_reason": block_reason,
    }
