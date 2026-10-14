"""提交前查询流程中「发起人自选」节点（供前端勾选）。"""

from __future__ import annotations

from typing import Any, Dict, List

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
