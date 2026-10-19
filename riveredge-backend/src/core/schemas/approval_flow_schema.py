"""审批流程节点 Schema：normalize + validate（前后端契约唯一真源）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from infra.exceptions.exceptions import ValidationError

APPROVAL_NODE_TYPES = frozenset({"start", "approval", "cc", "condition", "end"})
# 设计期可不预配人员：发起人自选 / 角色（启用前须绑角色）/ 动态主管类
MANAGER_APPROVER_TYPES = frozenset({"manager", "department", "multi_level_manager", "initiator_select"})
DESIGN_TIME_EMPTY_OK_TYPES = frozenset({"role", "initiator_select"}) | MANAGER_APPROVER_TYPES
EMPTY_APPROVER_POLICIES = frozenset({"block", "auto_pass", "fallback_user", "escalate_admin"})
CONDITION_OPERATORS = frozenset({"==", "eq", "!=", "ne", ">", "gt", "<", "lt", ">=", "gte", "<=", "lte", "contains", "in", "between"})
CONDITION_ROUTE_MODES = frozenset({"previous_approver", "initiator", "formula"})


def _condition_value_filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return True


def _infer_condition_route_mode(
    conditions: List[Dict[str, Any]],
    *,
    out_edge_count: int,
) -> Optional[str]:
    """旧图加载时推断 routeMode；无法推断返回 None（保存校验失败）。"""
    if out_edge_count <= 1:
        return "formula"
    if any(bool(c.get("else")) for c in conditions):
        return "formula"
    if any(
        str(c.get("field") or "").strip() and _condition_value_filled(c.get("value"))
        for c in conditions
    ):
        return "formula"
    if conditions and all(not _condition_value_filled(c.get("value")) for c in conditions):
        return "previous_approver"
    return None


def normalize_condition_node_data(
    data: Optional[Dict[str, Any]],
    *,
    out_edge_count: int = 0,
) -> Dict[str, Any]:
    out = dict(data or {})
    conditions = out.get("conditions") or out.get("condition_list") or []
    normalized_conditions: List[Dict[str, Any]] = []
    for item in _as_list(conditions):
        if not isinstance(item, dict):
            continue
        normalized_conditions.append(
            {
                "field": item.get("field"),
                "operator": item.get("operator") or "==",
                "value": item.get("value"),
                "label": item.get("label") or "",
                "else": bool(item.get("else")),
            }
        )
    out["conditions"] = normalized_conditions
    out.pop("condition_list", None)

    raw_mode = str(out.get("routeMode") or out.pop("route_mode", "") or "").strip()
    if raw_mode in CONDITION_ROUTE_MODES:
        out["routeMode"] = raw_mode
    else:
        inferred = _infer_condition_route_mode(normalized_conditions, out_edge_count=out_edge_count)
        if inferred:
            out["routeMode"] = inferred
        else:
            out.pop("routeMode", None)

    mode = out.get("routeMode")
    if mode in ("previous_approver", "initiator"):
        trimmed: List[Dict[str, Any]] = []
        for i, item in enumerate(normalized_conditions):
            trimmed.append(
                {
                    "label": str(item.get("label") or "").strip() or f"分支{i + 1}",
                }
            )
        out["conditions"] = trimmed
    return out


def _as_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def normalize_node_data(node_type: str, data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """规范化单节点 data；兼容历史 approvers/roles 字段。"""
    out = dict(data or {})
    if node_type in ("approval", "cc"):
        approver_ids = (
            out.get("approverIds")
            or out.get("approver_ids")
            or out.get("approvers")
            or out.get("roles")
            or []
        )
        out["approverIds"] = [str(x).strip() for x in _as_list(approver_ids) if x is not None and str(x).strip()]
        out.pop("approvers", None)
        out.pop("roles", None)
        out.pop("approver_ids", None)
        if node_type == "approval":
            out.setdefault("approvalType", out.pop("approval_type", None) or "OR")
            out.setdefault("approverType", out.pop("approver_type", None) or "user")
            if (out.get("approverType") or "") == "department":
                scope = str(out.get("departmentScope") or out.get("department_scope") or "submitter").strip().lower()
                out["departmentScope"] = "specified" if scope == "specified" else "submitter"
                out.pop("department_scope", None)
            if (out.get("approverType") or "") == "multi_level_manager":
                raw_level = out.get("managerLevel")
                if raw_level is None:
                    raw_level = out.pop("manager_level", None)
                if raw_level is None:
                    out["managerLevel"] = 2
                else:
                    try:
                        level = int(raw_level)
                    except (TypeError, ValueError) as exc:
                        raise ValidationError(f"审批节点 managerLevel 非法: {raw_level!r}") from exc
                    if level < 2:
                        raise ValidationError("multi_level_manager 的 managerLevel 须 ≥ 2")
                    out["managerLevel"] = level
                out.pop("manager_level", None)
            out.setdefault("allowEditDuringApproval", bool(out.get("allowEditDuringApproval", False)))
            out.setdefault("refreshContextOnEdit", bool(out.get("refreshContextOnEdit", True)))
            out.setdefault("allowTransfer", bool(out.get("allowTransfer", False)))
            out.setdefault("allowAddSign", bool(out.get("allowAddSign", False)))
            out.setdefault("allowSubmitterWithdraw", bool(out.get("allowSubmitterWithdraw", True)))
            out.setdefault(
                "submitterWithdrawOnlyBeforeAnyApprove",
                bool(out.get("submitterWithdrawOnlyBeforeAnyApprove", False)),
            )
            out.setdefault("allowApproverRecall", bool(out.get("allowApproverRecall", True)))
            raw_reject_allowed = out.get("rejectAllowedTargets")
            if raw_reject_allowed is None:
                raw_reject_allowed = out.pop("reject_allowed_targets", None)
            if raw_reject_allowed is None:
                out["rejectAllowedTargets"] = ["previous", "submitter"]
            else:
                items = raw_reject_allowed if isinstance(raw_reject_allowed, list) else [raw_reject_allowed]
                parsed = []
                for item in items:
                    val = str(item or "").strip().lower()
                    if val in ("previous", "submitter") and val not in parsed:
                        parsed.append(val)
                out["rejectAllowedTargets"] = parsed if parsed else ["previous", "submitter"]
            default_reject = str(
                out.get("rejectDefaultTarget") or out.pop("reject_default_target", None) or "previous"
            ).strip().lower()
            out["rejectDefaultTarget"] = "submitter" if default_reject == "submitter" else "previous"
            if out["rejectDefaultTarget"] not in out["rejectAllowedTargets"]:
                out["rejectDefaultTarget"] = out["rejectAllowedTargets"][0]
            out.pop("reject_allowed_targets", None)
            out.setdefault("allowRevokeAfterApproved", bool(out.get("allowRevokeAfterApproved", True)))
            landing = str(out.get("revokeLanding") or out.get("revoke_landing") or "reopen_final").strip().lower()
            out["revokeLanding"] = landing if landing in ("reopen_final", "to_draft") else "reopen_final"
            out.pop("revoke_landing", None)
            policy = out.get("emptyApproverPolicy") or out.get("empty_approver_policy")
            if policy is None:
                out["emptyApproverPolicy"] = "block"
            else:
                out["emptyApproverPolicy"] = str(policy).strip().lower() or "block"
            out.pop("empty_approver_policy", None)
            raw_decision = out.get("decisionOnApprove") or out.pop("decision_on_approve", None)
            if isinstance(raw_decision, dict) and raw_decision.get("field"):
                field = str(raw_decision.get("field") or "").strip()
                if not field:
                    out.pop("decisionOnApprove", None)
                else:
                    label = str(raw_decision.get("label") or "").strip() or field
                    default_raw = raw_decision.get("defaultValue")
                    if default_raw is None:
                        default_raw = raw_decision.get("default_value")
                    default_value = bool(default_raw) if default_raw is not None else False
                    out["decisionOnApprove"] = {
                        "field": field,
                        "label": label,
                        "defaultValue": default_value,
                    }
            else:
                out.pop("decisionOnApprove", None)
            timeout = out.get("timeoutHours")
            if timeout is None and out.get("timeout_hours") is not None:
                timeout = out.get("timeout_hours")
            if timeout is not None:
                try:
                    hours = int(timeout)
                except (TypeError, ValueError) as exc:
                    raise ValidationError(f"审批节点 timeoutHours 非法: {timeout!r}") from exc
                if hours < 0:
                    raise ValidationError("审批节点 timeoutHours 不可为负")
                out["timeoutHours"] = hours
                out.pop("timeout_hours", None)
    if node_type == "condition":
        # routeMode / conditions 在 normalize_flow_graph 二遍按出边数补齐
        pass
    return out


def normalize_flow_graph(raw: Any) -> Dict[str, Any]:
    """规范化 ProFlow 图结构 { nodes, edges }。"""
    if not isinstance(raw, dict):
        raise ValidationError("流程 nodes 必须为对象")
    node_list = raw.get("nodes") or []
    edge_list = raw.get("edges") or []
    if not isinstance(node_list, list):
        raise ValidationError("流程 nodes.nodes 必须为数组")
    if not isinstance(edge_list, list):
        raise ValidationError("流程 nodes.edges 必须为数组")

    nodes: List[Dict[str, Any]] = []
    for node in node_list:
        if not isinstance(node, dict):
            continue
        node_type = str(node.get("type") or "").strip()
        data = normalize_node_data(node_type, node.get("data") if isinstance(node.get("data"), dict) else {})
        nodes.append(
            {
                "id": node.get("id"),
                "type": node_type,
                "position": node.get("position") or {"x": 0, "y": 0},
                "data": data,
            }
        )

    edges: List[Dict[str, Any]] = []
    for i, edge in enumerate(edge_list):
        if not isinstance(edge, dict):
            continue
        edges.append(
            {
                "id": edge.get("id") or f"e-{edge.get('source')}-{edge.get('target')}-{i}",
                "source": edge.get("source"),
                "target": edge.get("target"),
                "type": edge.get("type") or "default",
                "data": edge.get("data") if isinstance(edge.get("data"), dict) else {},
            }
        )

    out_edge_count_by_source: Dict[str, int] = {}
    for edge in edges:
        src = str(edge.get("source") or "")
        if src:
            out_edge_count_by_source[src] = out_edge_count_by_source.get(src, 0) + 1

    for node in nodes:
        if node.get("type") != "condition":
            continue
        node_id = str(node.get("id") or "")
        node["data"] = normalize_condition_node_data(
            node.get("data") if isinstance(node.get("data"), dict) else {},
            out_edge_count=out_edge_count_by_source.get(node_id, 0),
        )

    return {"nodes": nodes, "edges": edges}


def validate_flow_graph(graph: Dict[str, Any]) -> None:
    """校验流程图；失败显式报错。"""
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    if not nodes:
        raise ValidationError("流程至少包含一个节点")

    ids = {n.get("id") for n in nodes if n.get("id")}
    if "start" not in ids or "end" not in ids:
        raise ValidationError("流程必须包含开始节点与结束节点")

    for node in nodes:
        node_id = node.get("id")
        node_type = node.get("type")
        if node_type not in APPROVAL_NODE_TYPES:
            raise ValidationError(f"节点 {node_id} 类型非法: {node_type}")
        data = node.get("data") or {}
        if node_type == "approval":
            approver_type = data.get("approverType") or "user"
            approver_ids = data.get("approverIds") or []
            policy = str(data.get("emptyApproverPolicy") or "block").strip().lower()
            if policy not in EMPTY_APPROVER_POLICIES:
                raise ValidationError(
                    f"审批节点 {node_id} emptyApproverPolicy 非法: {policy!r}，"
                    f"仅支持 {sorted(EMPTY_APPROVER_POLICIES)}"
                )
            if approver_type == "department":
                scope = str(data.get("departmentScope") or "submitter").strip().lower()
                if scope == "specified" and not approver_ids:
                    raise ValidationError(f"审批节点 {node_id} 已选择指定部门但未选择部门")
            elif approver_type not in DESIGN_TIME_EMPTY_OK_TYPES and not approver_ids:
                raise ValidationError(f"审批节点 {node_id} 未配置审批人")
        if node_type == "condition":
            out_edges = [e for e in edges if e.get("source") == node_id]
            conditions = data.get("conditions") or []
            route_mode = str(data.get("routeMode") or "").strip()
            label = (data.get("label") or node_id or "").strip()
            if len(out_edges) > 1 and not route_mode:
                raise ValidationError(
                    f"条件节点「{label}」须选择分支触发方式（上一节点人员 / 流程发起人 / 公式）"
                )
            if route_mode not in CONDITION_ROUTE_MODES and len(out_edges) > 1:
                raise ValidationError(f"条件节点「{label}」routeMode 非法: {route_mode!r}")
            if len(out_edges) > 1 and len(conditions) != len(out_edges):
                raise ValidationError(
                    f"条件节点「{label}」出边数({len(out_edges)})与分支数({len(conditions)})不一致"
                )
            if route_mode in ("previous_approver", "initiator"):
                for i, cond in enumerate(conditions):
                    if not str(cond.get("label") or "").strip():
                        raise ValidationError(f"条件节点「{label}」分支 {i + 1} 须填写名称")
            if route_mode == "formula":
                else_indices = [i for i, c in enumerate(conditions) if c.get("else")]
                if len(else_indices) > 1:
                    raise ValidationError(f"条件节点「{label}」仅允许一条「其余」分支")
                for i, cond in enumerate(conditions):
                    if cond.get("else"):
                        continue
                    field = str(cond.get("field") or "").strip()
                    if not field:
                        raise ValidationError(f"条件节点「{label}」分支 {i + 1} 须选择字段")
                    if not _condition_value_filled(cond.get("value")):
                        raise ValidationError(f"条件节点「{label}」分支 {i + 1} 须填写比较数值")
                    op = cond.get("operator")
                    if op and op not in CONDITION_OPERATORS:
                        raise ValidationError(f"条件节点「{label}」含非法运算符: {op}")

    for edge in edges:
        if edge.get("source") not in ids or edge.get("target") not in ids:
            raise ValidationError(f"连线 {edge.get('id')} 引用不存在的节点")


def assert_flow_executable(graph: Dict[str, Any]) -> None:
    """启用审核 / 发起实例前：角色节点必须已绑定角色；发起人自选可留空。"""
    for node in graph.get("nodes") or []:
        if not isinstance(node, dict) or node.get("type") != "approval":
            continue
        data = node.get("data") or {}
        node_id = node.get("id")
        label = (data.get("label") or node_id or "").strip()
        approver_type = str(data.get("approverType") or "user").strip()
        approver_ids = data.get("approverIds") or []
        if approver_type == "role" and not approver_ids:
            raise ValidationError(
                f"审批节点「{label}」尚未绑定角色，请先在审批流程设计器完成配置再启用审核"
            )
        if approver_type == "user" and not approver_ids:
            raise ValidationError(
                f"审批节点「{label}」尚未指定审批人，请先在审批流程设计器完成配置再启用审核"
            )
        if approver_type == "department":
            scope = str(data.get("departmentScope") or "submitter").strip().lower()
            if scope == "specified" and not approver_ids:
                raise ValidationError(
                    f"审批节点「{label}」已选择指定部门但未选择部门"
                )


def normalize_and_validate_flow(raw: Any) -> Dict[str, Any]:
    graph = normalize_flow_graph(raw)
    validate_flow_graph(graph)
    return graph


def get_node_config(graph: Dict[str, Any], node_id: Optional[str]) -> Optional[Dict[str, Any]]:
    if not node_id:
        return None
    for node in graph.get("nodes") or []:
        if node.get("id") == node_id:
            return node
    return None
