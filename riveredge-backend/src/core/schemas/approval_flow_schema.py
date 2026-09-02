"""审批流程节点 Schema：normalize + validate（前后端契约唯一真源）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from infra.exceptions.exceptions import ValidationError

APPROVAL_NODE_TYPES = frozenset({"start", "approval", "cc", "condition", "end"})
MANAGER_APPROVER_TYPES = frozenset({"manager", "department", "multi_level_manager", "initiator_select"})
CONDITION_OPERATORS = frozenset({"==", "eq", "!=", "ne", ">", "gt", "<", "lt", ">=", "gte", "<=", "lte", "contains", "in", "between"})


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
            out.setdefault("allowEditDuringApproval", bool(out.get("allowEditDuringApproval", False)))
            out.setdefault("refreshContextOnEdit", bool(out.get("refreshContextOnEdit", True)))
            out.setdefault("allowTransfer", bool(out.get("allowTransfer", False)))
            out.setdefault("allowAddSign", bool(out.get("allowAddSign", False)))
            if out.get("emptyApproverPolicy") is None:
                out["emptyApproverPolicy"] = "auto_pass"
    if node_type == "condition":
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
                }
            )
        out["conditions"] = normalized_conditions
        out.pop("condition_list", None)
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
            if approver_type == "department":
                scope = str(data.get("departmentScope") or "submitter").strip().lower()
                if scope == "specified" and not approver_ids:
                    raise ValidationError(f"审批节点 {node_id} 已选择指定部门但未选择部门")
            elif approver_type not in MANAGER_APPROVER_TYPES and not approver_ids:
                raise ValidationError(f"审批节点 {node_id} 未配置审批人")
        if node_type == "condition":
            out_edges = [e for e in edges if e.get("source") == node_id]
            conditions = data.get("conditions") or []
            if len(out_edges) > 1 and len(conditions) != len(out_edges):
                raise ValidationError(
                    f"条件节点 {node_id} 出边数({len(out_edges)})与条件数({len(conditions)})不一致"
                )
            for cond in conditions:
                op = cond.get("operator")
                if op and op not in CONDITION_OPERATORS:
                    raise ValidationError(f"条件节点 {node_id} 含非法运算符: {op}")

    for edge in edges:
        if edge.get("source") not in ids or edge.get("target") not in ids:
            raise ValidationError(f"连线 {edge.get('id')} 引用不存在的节点")


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
