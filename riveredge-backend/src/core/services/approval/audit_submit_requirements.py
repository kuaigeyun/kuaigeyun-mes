"""提交前查询流程中「发起人自选」节点与「发起人选分支」条件（供前端勾选）。"""

from __future__ import annotations

from typing import Any, Dict, List

from core.schemas.approval_flow_schema import normalize_flow_graph
from core.services.approval.audit_binding_service import AuditBindingService


def _iter_flow_nodes(raw_nodes: Any) -> List[dict]:
    if not raw_nodes:
        return []
    if isinstance(raw_nodes, dict):
        inner = raw_nodes.get("nodes")
        if isinstance(inner, list):
            return [n for n in inner if isinstance(n, dict)]
        return []
    if isinstance(raw_nodes, list):
        return [n for n in raw_nodes if isinstance(n, dict)]
    return []


async def list_initiator_select_nodes_for_entity(
    tenant_id: int,
    entity_type: str,
    *,
    node_key: str | None = None,
) -> List[Dict[str, Any]]:
    """
    返回当前租户已绑定且激活流程中的 initiator_select 审批节点。
    required=True 表示 emptyApproverPolicy 非 auto_pass，提交时必须选人。
    """
    from core.config.audit_registry import entry_by_entity_type

    et = (entity_type or "").strip()
    entry = entry_by_entity_type(et)
    resolved_key = (node_key or (entry.node_key if entry else "") or et).strip()
    if not resolved_key:
        return []

    process = await AuditBindingService.resolve_process_for_node(tenant_id, resolved_key)
    if not process or not process.nodes:
        return []

    out: List[Dict[str, Any]] = []
    for node in _iter_flow_nodes(process.nodes):
        if str(node.get("type") or "") != "approval":
            continue
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        approver_type = str(
            data.get("approverType") or data.get("approver_type") or ""
        ).strip()
        if approver_type != "initiator_select":
            continue
        policy = str(
            data.get("emptyApproverPolicy") or data.get("empty_approver_policy") or "block"
        ).strip().lower()
        out.append(
            {
                "node_id": str(node.get("id") or ""),
                "label": str(data.get("label") or node.get("id") or "审批"),
                "required": policy != "auto_pass",
                "empty_approver_policy": policy or "block",
            }
        )
    return out


def list_initiator_branch_conditions_in_graph(raw_nodes: Any) -> List[Dict[str, Any]]:
    """流程图中 routeMode=initiator 的多出边条件节点（提交时须选分支）。"""
    if not raw_nodes:
        return []
    graph = normalize_flow_graph(raw_nodes if isinstance(raw_nodes, dict) else {"nodes": [], "edges": []})
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    out: List[Dict[str, Any]] = []
    for node in nodes:
        if not isinstance(node, dict) or str(node.get("type") or "") != "condition":
            continue
        node_id = str(node.get("id") or "").strip()
        if not node_id:
            continue
        out_edges = [e for e in edges if isinstance(e, dict) and str(e.get("source") or "") == node_id]
        if len(out_edges) < 2:
            continue
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        route_mode = str(data.get("routeMode") or "").strip()
        if route_mode != "initiator":
            continue
        conditions = data.get("conditions") or []
        branches: List[Dict[str, Any]] = []
        by_id = {str(n.get("id")): n for n in nodes if isinstance(n, dict) and n.get("id") is not None}
        for i, edge in enumerate(out_edges):
            cond = conditions[i] if i < len(conditions) and isinstance(conditions[i], dict) else {}
            branch_label = str(cond.get("label") or "").strip()
            if not branch_label:
                target = by_id.get(str(edge.get("target") or ""))
                td = target.get("data") if isinstance(target, dict) and isinstance(target.get("data"), dict) else {}
                branch_label = str(td.get("label") or target.get("id") or "").strip() or f"分支{i + 1}"
            branches.append({"index": i, "label": branch_label})
        out.append(
            {
                "condition_node_id": node_id,
                "label": str(data.get("label") or node_id).strip() or "条件分支",
                "required": True,
                "branches": branches,
            }
        )
    return out


async def list_initiator_branch_conditions_for_entity(
    tenant_id: int,
    entity_type: str,
    *,
    node_key: str | None = None,
) -> List[Dict[str, Any]]:
    from core.config.audit_registry import entry_by_entity_type

    et = (entity_type or "").strip()
    entry = entry_by_entity_type(et)
    resolved_key = (node_key or (entry.node_key if entry else "") or et).strip()
    if not resolved_key:
        return []
    process = await AuditBindingService.resolve_process_for_node(tenant_id, resolved_key)
    if not process or not process.nodes:
        return []
    return list_initiator_branch_conditions_in_graph(process.nodes)
