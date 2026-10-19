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


def _name_by_user_id(nodes_overview: List[Dict[str, Any]]) -> Dict[int, str]:
    out: Dict[int, str] = {}
    for node in nodes_overview or []:
        for item in node.get("eligible_approvers") or []:
            if not isinstance(item, dict):
                continue
            raw = item.get("user_id")
            if raw is None:
                continue
            try:
                uid = int(raw)
            except (TypeError, ValueError):
                continue
            name = str(item.get("name") or "").strip()
            if name:
                out[uid] = name
    return out


def _task_on_instance(task: ApprovalTask, instance: ApprovalInstance) -> bool:
    """get_approval_status 会混入同单据历史实例任务，门禁只认当前活跃实例。"""
    inst_id = getattr(instance, "id", None)
    raw = getattr(task, "approval_instance_id", None)
    if inst_id is None or raw is None:
        # 单测或残缺对象无法区分时不误杀
        return True
    try:
        return int(raw) == int(inst_id)
    except (TypeError, ValueError):
        return False


def current_node_pending_approver_ids(
    *,
    instance: ApprovalInstance,
    tasks: List[ApprovalTask],
) -> List[int]:
    """当前节点上仍 pending 的待办人（与 execute_approval 认的任务一致）。"""
    current_node = str(instance.current_node or "")
    ids: List[int] = []
    seen: set[int] = set()
    for task in tasks:
        if not _task_on_instance(task, instance):
            continue
        if task.status != "pending":
            continue
        if task.approver_id is None:
            continue
        if current_node and str(task.node_id or "") != current_node:
            continue
        uid = int(task.approver_id)
        if uid in seen:
            continue
        seen.add(uid)
        ids.append(uid)
    return ids


def _pending_assignee_display_names(
    *,
    instance: ApprovalInstance,
    tasks: List[ApprovalTask],
    nodes_overview: List[Dict[str, Any]],
) -> List[str]:
    pending_ids = current_node_pending_approver_ids(instance=instance, tasks=tasks)
    if not pending_ids:
        return []
    name_map = _name_by_user_id(nodes_overview)
    return [name_map.get(uid) or str(uid) for uid in pending_ids]


def viewer_has_approved_task_on_instance(
    *,
    viewer_id: int,
    instance: ApprovalInstance,
    tasks: List[ApprovalTask],
) -> bool:
    """当前查看者是否已在本实例上通过过某一级（与是否仍持有当前待办无关）。"""
    for task in tasks:
        if not _task_on_instance(task, instance):
            continue
        if task.status != "approved":
            continue
        if task.approver_id is None:
            continue
        if int(task.approver_id) == int(viewer_id):
            return True
    return False


def viewer_has_pending_task_on_instance(
    *,
    viewer_id: int,
    instance: ApprovalInstance,
    tasks: List[ApprovalTask],
) -> bool:
    current_node = str(instance.current_node or "")
    for task in tasks:
        if not _task_on_instance(task, instance):
            continue
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

    block_reason 优先取「当前节点 pending 任务」上的待办人，避免节点已推进但文案仍
    引用上一节点可审名单/旧列表态。
    """
    if viewer_id is None or not instance or instance.status != "pending":
        return {
            "has_my_pending_task": False,
            "approve": False,
            "reject": False,
            "my_acted": False,
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
            "my_acted": False,
            "block_reason": None,
        }

    # 本级已通过、流程仍在后续节点：对当前人明示「您已审核」，避免列表仍像待他处理
    if viewer_has_approved_task_on_instance(
        viewer_id=int(viewer_id),
        instance=instance,
        tasks=tasks,
    ):
        return {
            "has_my_pending_task": False,
            "approve": False,
            "reject": False,
            "my_acted": True,
            "block_reason": "您已审核，等待后续节点",
        }

    submitter_id = getattr(instance, "submitter_id", None)
    if submitter_id is not None and int(submitter_id) == int(viewer_id):
        return {
            "has_my_pending_task": False,
            "approve": False,
            "reject": False,
            "my_acted": False,
            "block_reason": "您为发起人，请等待当前节点审批人处理",
        }

    pending_ids = current_node_pending_approver_ids(instance=instance, tasks=tasks)
    eligible_ids = current_node_eligible_user_ids(nodes_overview)
    pending_names = _pending_assignee_display_names(
        instance=instance,
        tasks=tasks,
        nodes_overview=nodes_overview,
    )
    eligible_names = _eligible_display_names(nodes_overview)
    # 待办与可审名单无交集时，待办多半是上一节点残留；展示跟可审名单（与流程图一致）
    if pending_ids and eligible_ids and not set(pending_ids).intersection(eligible_ids):
        names = eligible_names
    else:
        names = pending_names or eligible_names
    if names:
        block_reason = f"当前节点待办人：{'、'.join(names)}"
    else:
        if eligible_ids and int(viewer_id) in {int(x) for x in eligible_ids}:
            block_reason = "您在该节点可审名单中，但待办任务未就绪，请刷新或联系管理员"
        else:
            block_reason = "您不是当前节点待办人"

    return {
        "has_my_pending_task": False,
        "approve": False,
        "reject": False,
        "my_acted": False,
        "block_reason": block_reason,
    }
