"""审批流查看者门控：与 ``build_flow_viewer_actions`` / ``execute_approval`` 同源，写入 record.audit。"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from core.services.approval.audit_capability_gate import _AUDIT_ACTION_CAPABILITY_KEYS

_FLOW_GATED_ACTIONS = frozenset({"approve", "reject"})


def apply_viewer_actions_to_audit_and_capabilities(
    audit: Optional[Dict[str, Any]],
    capabilities: Any,
    viewer_actions: Optional[Dict[str, Any]],
) -> Tuple[Optional[Dict[str, Any]], Any]:
    """
    pending 流程下挂上 ``viewer_actions``，并按待办裁剪 capabilities。

    不从 ``allowed_actions`` 删除 approve/reject：可见性仍由阶段动作决定，
    能否执行由 ``viewer_actions`` / capabilities 门控。否则列表把动作裁掉后，
    审核弹窗即使补齐待办也不会再出现审核/驳回按钮。
    """
    if not audit or not isinstance(audit, dict):
        return audit, capabilities
    if audit.get("phase") != "pending" or not audit.get("enabled"):
        return audit, capabilities
    if not viewer_actions or not isinstance(viewer_actions, dict):
        return audit, capabilities

    flow_allows = bool(viewer_actions.get("approve"))
    block_reason = viewer_actions.get("block_reason")
    audit = {**audit, "viewer_actions": viewer_actions}

    if capabilities is None:
        return audit, capabilities

    for action in _FLOW_GATED_ACTIONS:
        cap_key = _AUDIT_ACTION_CAPABILITY_KEYS.get(action)
        if not cap_key:
            continue
        capabilities = _set_capability_allowed(
            capabilities,
            cap_key,
            allowed=flow_allows,
            reason=None if flow_allows else block_reason,
        )

    return audit, capabilities


def _set_capability_allowed(
    capabilities: Any,
    cap_key: str,
    *,
    allowed: bool,
    reason: Optional[str],
) -> Any:
    cap_payload = {"allowed": allowed, "reason": None if allowed else reason}
    if isinstance(capabilities, dict):
        capabilities = dict(capabilities)
        existing = capabilities.get(cap_key)
        if isinstance(existing, dict):
            capabilities[cap_key] = {**existing, **cap_payload}
        else:
            capabilities[cap_key] = cap_payload
        return capabilities
    if hasattr(capabilities, cap_key) and hasattr(capabilities, "model_copy"):
        field_type = type(getattr(capabilities, cap_key))
        if hasattr(field_type, "model_validate"):
            cap_obj = field_type.model_validate(cap_payload)
        else:
            cap_obj = cap_payload
        return capabilities.model_copy(update={cap_key: cap_obj})
    return capabilities
