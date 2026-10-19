"""审批流撤回/反审策略（设计器节点配置 + 运行时身份）。"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Set, Tuple

RejectTarget = Literal["previous", "submitter"]
_DEFAULT_REJECT_TARGETS: List[RejectTarget] = ["previous", "submitter"]

from core.models.approval_history import ApprovalHistory
from core.models.approval_instance import ApprovalInstance
from core.models.approval_task import ApprovalTask
from core.schemas.approval_flow_schema import get_node_config, normalize_flow_graph
from infra.exceptions.exceptions import AuthorizationError, ValidationError


def _node_data_bool(data: Dict[str, Any], key: str, default: bool) -> bool:
    if key not in data:
        snake = "".join(
            ["_" + c.lower() if c.isupper() else c for c in key]
        ).lstrip("_")
        if snake in data:
            raw = data[snake]
        else:
            return default
    else:
        raw = data[key]
    return bool(raw) if raw is not None else default


def _approval_nodes_in_graph(graph: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for node in graph.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        if str(node.get("type") or "") == "approval":
            out.append(node)
    return out


def resolve_submitter_withdraw_policy(graph: Dict[str, Any]) -> Dict[str, bool]:
    """发起人撤回策略：任一审批节点关闭则整单不可撤；仅无人审批可撤取最严。"""
    nodes = _approval_nodes_in_graph(graph)
    if not nodes:
        return {"allowSubmitterWithdraw": True, "submitterWithdrawOnlyBeforeAnyApprove": False}
    allow = True
    only_before = False
    for node in nodes:
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        if not _node_data_bool(data, "allowSubmitterWithdraw", True):
            allow = False
        if _node_data_bool(data, "submitterWithdrawOnlyBeforeAnyApprove", False):
            only_before = True
    return {
        "allowSubmitterWithdraw": allow,
        "submitterWithdrawOnlyBeforeAnyApprove": only_before,
    }


def resolve_revoke_policy_for_node_data(data: Dict[str, Any]) -> Dict[str, Any]:
    allow = _node_data_bool(data, "allowRevokeAfterApproved", True)
    landing = str(data.get("revokeLanding") or data.get("revoke_landing") or "reopen_final").strip().lower()
    if landing not in ("reopen_final", "to_draft"):
        landing = "reopen_final"
    return {"allowRevokeAfterApproved": allow, "revokeLanding": landing}


def _parse_reject_allowed_targets(raw: Any) -> List[RejectTarget]:
    if raw is None:
        return list(_DEFAULT_REJECT_TARGETS)
    items = raw if isinstance(raw, list) else [raw]
    out: List[RejectTarget] = []
    for item in items:
        val = str(item or "").strip().lower()
        if val in ("previous", "submitter") and val not in out:
            out.append(val)  # type: ignore[arg-type]
    return out if out else list(_DEFAULT_REJECT_TARGETS)


def resolve_reject_policy_for_node_data(data: Dict[str, Any]) -> Dict[str, Any]:
    raw_allowed = data.get("rejectAllowedTargets")
    if raw_allowed is None:
        raw_allowed = data.get("reject_allowed_targets")
    allowed = _parse_reject_allowed_targets(raw_allowed)
    default_raw = data.get("rejectDefaultTarget") or data.get("reject_default_target") or "previous"
    default_val = str(default_raw).strip().lower()
    default_target: RejectTarget = "submitter" if default_val == "submitter" else "previous"
    if default_target not in allowed:
        default_target = allowed[0]
    return {"allowedTargets": allowed, "defaultTarget": default_target}


def resolve_reject_policy_from_graph(graph: Dict[str, Any]) -> Dict[str, Any]:
    nodes = _approval_nodes_in_graph(graph)
    if not nodes:
        return {"allowedTargets": list(_DEFAULT_REJECT_TARGETS), "defaultTarget": "previous"}
    allowed_set: Set[RejectTarget] = set(_DEFAULT_REJECT_TARGETS)
    for node in nodes:
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        pol = resolve_reject_policy_for_node_data(data)
        allowed_set &= set(pol["allowedTargets"])
    if not allowed_set:
        allowed_set = set(_DEFAULT_REJECT_TARGETS)
    allowed = [t for t in _DEFAULT_REJECT_TARGETS if t in allowed_set]
    return {"allowedTargets": allowed, "defaultTarget": allowed[0]}


def previous_approval_node_id_on_instance_path(
    process_nodes: Any,
    current_node_id: str,
    instance: ApprovalInstance,
) -> Optional[str]:
    """沿实例已选分支，取当前 approval 节点之前的上一个 approval 节点 id。"""
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    graph = ApprovalInstanceService._normalize_process_graph(process_nodes or {})
    current = str(current_node_id or "").strip()
    if not current:
        return None
    start_id: Optional[str] = None
    for node in graph.get("nodes") or []:
        if isinstance(node, dict) and str(node.get("type") or "") == "start":
            start_id = str(node.get("id") or "").strip()
            break
    if not start_id:
        return None

    cursor = start_id
    prev_approval: Optional[str] = None
    seen: Set[str] = set()
    for _ in range(64):
        if not cursor or cursor in seen:
            return None
        seen.add(cursor)
        if cursor == current:
            return prev_approval
        node = get_node_config(graph, cursor)
        ntype = str((node or {}).get("type") or "")
        # 只读路径：缺选边须 stop，禁止 raise 把 get_approval_status 打成 422（弹窗显示未绑定）
        nxt = ApprovalInstanceService._get_next_node(
            graph, cursor, instance=instance, on_missing_branch="stop"
        )
        if not nxt:
            return None
        nxt_id = str(nxt.get("id") or "").strip()
        if not nxt_id:
            return None
        if nxt_id == current:
            cur_node = get_node_config(graph, current)
            if str((cur_node or {}).get("type") or "") == "approval":
                if ntype == "approval":
                    return cursor
                return prev_approval
        if ntype == "approval":
            prev_approval = cursor
        cursor = nxt_id
    return None


async def resolve_reject_options_for_instance(
    *,
    tenant_id: int,
    instance: ApprovalInstance,
    process_nodes: Any,
) -> Dict[str, Any]:
    """运行时驳回可选项（当前节点策略 ∩ 图级允许集，再按是否有上一级过滤）。"""
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    graph = normalize_flow_graph(process_nodes or {})
    graph_policy = resolve_reject_policy_from_graph(graph)
    allowed: List[RejectTarget] = list(graph_policy["allowedTargets"])

    current_node_id = str(instance.current_node or "").strip()
    current_node = get_node_config(graph, current_node_id) if current_node_id else None
    default_target: RejectTarget = graph_policy["defaultTarget"]
    if current_node and str(current_node.get("type") or "") == "approval":
        nd = current_node.get("data") if isinstance(current_node.get("data"), dict) else {}
        node_policy = resolve_reject_policy_for_node_data(nd)
        allowed = [t for t in allowed if t in node_policy["allowedTargets"]]
        default_target = node_policy["defaultTarget"]
        if default_target not in allowed and allowed:
            default_target = allowed[0]

    prev_id = previous_approval_node_id_on_instance_path(
        process_nodes, current_node_id, instance
    )
    if not prev_id:
        allowed = [t for t in allowed if t != "previous"]
    if not allowed:
        allowed = ["submitter"]
        default_target = "submitter"
    if default_target not in allowed:
        default_target = allowed[0]

    prev_label = None
    if prev_id:
        prev_node = get_node_config(graph, prev_id)
        if prev_node:
            prev_label = ApprovalInstanceService._node_display_label(prev_node)

    return {
        "allowed_targets": allowed,
        "default_target": default_target,
        "previous_node_id": prev_id,
        "previous_node_label": prev_label,
    }


def graph_last_approval_node_id(graph: Dict[str, Any]) -> Optional[str]:
    """沿 start 出边 DFS，取能到达 end 的路径上最深的 approval 节点（与终审语义对齐）。"""
    nodes_by_id: Dict[str, Dict[str, Any]] = {}
    start_id: Optional[str] = None
    end_ids: Set[str] = set()
    for node in graph.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        nid = str(node.get("id") or "").strip()
        if not nid:
            continue
        nodes_by_id[nid] = node
        ntype = str(node.get("type") or "")
        if ntype == "start":
            start_id = nid
        elif ntype == "end":
            end_ids.add(nid)
    if not start_id or not end_ids:
        return None

    edges = graph.get("edges") or []
    adj: Dict[str, List[str]] = {}
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        src = str(edge.get("source") or "").strip()
        tgt = str(edge.get("target") or "").strip()
        if src and tgt:
            adj.setdefault(src, []).append(tgt)

    last_approval: Optional[str] = None

    def dfs(node_id: str, seen: Set[str]) -> None:
        nonlocal last_approval
        if node_id in seen:
            return
        seen.add(node_id)
        node = nodes_by_id.get(node_id)
        if node and str(node.get("type") or "") == "approval":
            last_approval = node_id
        if node_id in end_ids:
            return
        for nxt in adj.get(node_id, []):
            dfs(nxt, set(seen))

    dfs(start_id, set())
    return last_approval


def resolve_revoke_policy_from_graph(graph: Dict[str, Any]) -> Dict[str, Any]:
    last_id = graph_last_approval_node_id(graph)
    if not last_id:
        return {"allowRevokeAfterApproved": True, "revokeLanding": "reopen_final"}
    node = get_node_config(graph, last_id)
    data = node.get("data") if node and isinstance(node.get("data"), dict) else {}
    return resolve_revoke_policy_for_node_data(data)


async def final_approver_user_ids_on_node(
    tenant_id: int,
    instance: ApprovalInstance,
    node_id: str,
) -> Set[int]:
    """终审节点上实际通过的用户（会签全部通过人；或签为点通过者）。"""
    ids: Set[int] = set()
    tasks = await ApprovalTask.filter(
        tenant_id=tenant_id,
        approval_instance_id=instance.id,
        node_id=str(node_id),
        status="approved",
    ).all()
    for task in tasks:
        if task.approver_id is not None:
            ids.add(int(task.approver_id))

    if ids:
        return ids

    from core.services.approval.approval_instance_service import ApprovalInstanceService

    history = await ApprovalHistory.filter(
        tenant_id=tenant_id,
        approval_instance_id=instance.id,
    ).order_by("-action_at", "-id").all()
    for h in history:
        if ApprovalInstanceService._normalize_execution_action(h.action) != "approve":
            continue
        for candidate in (h.from_node, h.to_node):
            if str(candidate or "").strip() == str(node_id):
                ids.add(int(h.action_by))
                break
    return ids


async def resolve_final_approval_context(
    tenant_id: int,
    instance: ApprovalInstance,
) -> Tuple[Optional[str], Set[int]]:
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    process = instance.process
    if not process:
        await instance.fetch_related("process")
        process = instance.process
    if not process:
        return None, set()

    graph = normalize_flow_graph(process.nodes or {})
    last_node_id = await ApprovalInstanceService._find_last_completed_approval_node_id(
        tenant_id, instance
    )
    if not last_node_id:
        last_node_id = graph_last_approval_node_id(graph)
    if not last_node_id:
        return None, set()
    approvers = await final_approver_user_ids_on_node(tenant_id, instance, last_node_id)
    return last_node_id, approvers


def next_approval_node_id_on_instance_path(
    process_nodes: Any,
    from_node_id: str,
    instance: ApprovalInstance,
) -> Optional[str]:
    """沿实例已选分支，取 from 之后第一个 approval 节点 id。"""
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    graph = ApprovalInstanceService._normalize_process_graph(process_nodes or {})
    cursor = str(from_node_id or "").strip()
    if not cursor:
        return None
    seen: Set[str] = set()
    for _ in range(64):
        if cursor in seen:
            return None
        seen.add(cursor)
        # 只读路径：缺选边须 stop，禁止 raise 把概况/门禁接口打挂
        nxt = ApprovalInstanceService._get_next_node(
            graph, cursor, instance=instance, on_missing_branch="stop"
        )
        if not nxt:
            return None
        ntype = str(nxt.get("type") or "")
        nid = str(nxt.get("id") or "").strip()
        if not nid:
            return None
        if ntype == "approval":
            return nid
        if ntype == "end":
            return None
        cursor = nid
    return None


async def _subsequent_approval_has_human_pass(
    tenant_id: int,
    instance: ApprovalInstance,
    process_nodes: Any,
    from_node_id: str,
) -> bool:
    """本节点之后是否已有后续审批节点被人工通过。

    用图可达集判定，不依赖条件选边键：缺 ``__branch_index_*`` 时仍能正确阻断
    （避免 path walk raise，也避免 stop 后误判「后续无人审过」而放行撤回）。
    空审批人 auto_pass 不建 approved 任务，不视为已审。
    """
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    from_id = str(from_node_id or "").strip()
    if not from_id:
        return False
    graph = ApprovalInstanceService._normalize_process_graph(process_nodes or {})
    reachable = ApprovalInstanceService._graph_node_ids_reachable_from(graph, from_id)
    downstream = reachable - {from_id}
    if not downstream:
        return False
    approval_ids = [
        str(n.get("id") or "")
        for n in (graph.get("nodes") or [])
        if isinstance(n, dict)
        and str(n.get("type") or "") == "approval"
        and str(n.get("id") or "") in downstream
    ]
    approval_ids = [nid for nid in approval_ids if nid]
    if not approval_ids:
        return False
    return await ApprovalTask.filter(
        tenant_id=tenant_id,
        approval_instance_id=instance.id,
        node_id__in=approval_ids,
        status="approved",
    ).exists()


async def viewer_may_recall_own_on_instance(
    tenant_id: int,
    instance: ApprovalInstance,
    viewer_id: int,
    process_nodes: Any,
) -> bool:
    """本级已通过、且后续审批节点尚无人审过时可撤回本级。

    「下一道」按实例路径上后续审批节点控制：空审批人 auto_pass 越过下一道后，
    只要更后面仍无人审过，仍允许撤销（避免误点通过后按钮消失）。
    """
    graph = normalize_flow_graph(process_nodes or {})
    vid = int(viewer_id)
    for node in _approval_nodes_in_graph(graph):
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        if not _node_data_bool(data, "allowApproverRecall", True):
            continue
        nid = str(node.get("id") or "")
        if not nid:
            continue
        approved_task = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            node_id=nid,
            approver_id=vid,
            status="approved",
        ).first()
        if not approved_task or str(instance.current_node or "") == nid:
            continue
        if await _subsequent_approval_has_human_pass(
            tenant_id, instance, process_nodes, nid
        ):
            continue
        return True
    return False


def instance_has_any_approve(history: List[ApprovalHistory]) -> bool:
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    for h in history:
        if ApprovalInstanceService._normalize_execution_action(h.action) == "approve":
            return True
    return False


async def compute_viewer_flow_withdraw_revoke(
    *,
    tenant_id: int,
    viewer_id: Optional[int],
    instance: Optional[ApprovalInstance],
    process_nodes: Any,
    history: Optional[List[ApprovalHistory]] = None,
    admin_bypass: bool = False,
    has_revoke_permission: bool = False,
) -> Dict[str, bool]:
    """计算 viewer_can_revoke / viewer_can_withdraw_submit / viewer_can_recall_own。"""
    out = {
        "viewer_can_revoke": False,
        "viewer_can_withdraw_submit": False,
        "viewer_can_recall_own": False,
    }
    if viewer_id is None or not instance:
        return out

    graph = normalize_flow_graph(process_nodes or {})
    vid = int(viewer_id)

    if instance.status == "pending":
        withdraw_policy = resolve_submitter_withdraw_policy(graph)
        hist = history
        if hist is None:
            hist = await ApprovalHistory.filter(
                tenant_id=tenant_id,
                approval_instance_id=instance.id,
            ).all()
        else:
            # 驳回重提会新建 pending 实例；须只认当前实例上的 approve，禁止混入历史实例
            active_inst_id = int(instance.id)
            hist = [
                h
                for h in hist
                if int(getattr(h, "approval_instance_id", 0) or 0) == active_inst_id
            ]
        if (
            withdraw_policy["allowSubmitterWithdraw"]
            and int(instance.submitter_id) == vid
        ):
            if withdraw_policy["submitterWithdrawOnlyBeforeAnyApprove"] and instance_has_any_approve(hist):
                out["viewer_can_withdraw_submit"] = False
            else:
                out["viewer_can_withdraw_submit"] = True

        if await viewer_may_recall_own_on_instance(
            tenant_id, instance, vid, process_nodes
        ):
            out["viewer_can_recall_own"] = True

    if instance.status == "approved":
        last_node_id, final_approvers = await resolve_final_approval_context(tenant_id, instance)
        revoke_policy = resolve_revoke_policy_from_graph(graph)
        if last_node_id:
            node = get_node_config(graph, last_node_id)
            data = node.get("data") if node and isinstance(node.get("data"), dict) else {}
            revoke_policy = resolve_revoke_policy_for_node_data(data)

        if not revoke_policy["allowRevokeAfterApproved"]:
            out["viewer_can_revoke"] = False
        elif admin_bypass:
            out["viewer_can_revoke"] = True
        elif has_revoke_permission and vid in final_approvers:
            out["viewer_can_revoke"] = True

    if admin_bypass and instance.status == "pending":
        out["viewer_can_withdraw_submit"] = True

    return out


async def assert_submitter_withdraw_allowed(
    *,
    tenant_id: int,
    entity_type: str,
    entity_id: int,
    operator_id: int,
    admin_bypass: bool = False,
) -> None:
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    instance = await ApprovalInstanceService.get_instance_by_entity(
        tenant_id, entity_type, entity_id
    )
    if not instance or instance.status != "pending":
        raise ValidationError("当前没有可撤回的审批流程")

    if admin_bypass:
        return
    if int(instance.submitter_id) != int(operator_id):
        raise AuthorizationError("仅发起人可撤回提交")

    process = instance.process
    if not process:
        await instance.fetch_related("process")
        process = instance.process
    if not process:
        raise ValidationError("未绑定审批流程")

    graph = normalize_flow_graph(process.nodes or {})
    policy = resolve_submitter_withdraw_policy(graph)
    if not policy["allowSubmitterWithdraw"]:
        raise AuthorizationError("流程配置不允许发起人撤回")

    if policy["submitterWithdrawOnlyBeforeAnyApprove"]:
        hist = await ApprovalHistory.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
        ).all()
        if instance_has_any_approve(hist):
            raise AuthorizationError("已有审批人处理，不可撤回")


async def assert_revoke_allowed_for_viewer(
    *,
    tenant_id: int,
    entity_type: str,
    entity_id: int,
    operator_id: int,
    admin_bypass: bool = False,
    has_revoke_permission: bool = True,
) -> None:
    from core.services.approval.approval_instance_service import ApprovalInstanceService

    entity_instances = await ApprovalInstanceService._list_instances_by_entity(
        tenant_id, entity_type, entity_id
    )
    approved = next((i for i in entity_instances if i.status == "approved"), None)
    if not approved:
        return

    process = approved.process
    if not process:
        await approved.fetch_related("process")
        process = approved.process
    if not process:
        return

    graph = normalize_flow_graph(process.nodes or {})
    last_node_id, final_approvers = await resolve_final_approval_context(tenant_id, approved)
    revoke_policy = resolve_revoke_policy_from_graph(graph)
    if last_node_id:
        node = get_node_config(graph, last_node_id)
        data = node.get("data") if node and isinstance(node.get("data"), dict) else {}
        revoke_policy = resolve_revoke_policy_for_node_data(data)

    if not revoke_policy["allowRevokeAfterApproved"]:
        raise AuthorizationError("流程配置不允许反审")

    if admin_bypass:
        return
    if not has_revoke_permission:
        raise AuthorizationError("无反审权限")
    if int(operator_id) not in final_approvers:
        raise AuthorizationError("仅终审通过人可反审")


def should_reopen_on_revoke(process_nodes: Any, last_node_id: Optional[str]) -> bool:
    graph = normalize_flow_graph(process_nodes or {})
    if last_node_id:
        node = get_node_config(graph, last_node_id)
        data = node.get("data") if node and isinstance(node.get("data"), dict) else {}
        policy = resolve_revoke_policy_for_node_data(data)
    else:
        policy = resolve_revoke_policy_from_graph(graph)
    return policy["revokeLanding"] == "reopen_final"
