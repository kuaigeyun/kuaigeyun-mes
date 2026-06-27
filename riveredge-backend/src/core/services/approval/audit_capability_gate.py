"""将 capabilities 业务门禁 intersect 进 ``audit.allowed_actions``（UI 与 API 同源）。"""

from __future__ import annotations

from typing import Any, Dict, Optional

# uni-audit 动作 → capabilities 字段（各单据 capabilities 模型共用命名）
_AUDIT_ACTION_CAPABILITY_KEYS: Dict[str, str] = {
    "submit": "submit",
    "withdraw": "withdraw_submit",
    "approve": "approve",
    "reject": "reject",
    "revoke": "revoke_approval",
}


def _capability_allowed(capabilities: Any, cap_key: str) -> bool:
    cap = getattr(capabilities, cap_key, None)
    if cap is None and isinstance(capabilities, dict):
        cap = capabilities.get(cap_key)
    if cap is None:
        return True
    if isinstance(cap, dict):
        return bool(cap.get("allowed"))
    return bool(getattr(cap, "allowed", False))


def gate_audit_allowed_actions(
    audit: Optional[Dict[str, Any]],
    capabilities: Any,
) -> Optional[Dict[str, Any]]:
    """剔除 capabilities 不允许的审核动作，避免 UI 展示不可执行的按钮。"""
    if not audit or not isinstance(audit, dict):
        return audit
    allowed = list(audit.get("allowed_actions") or [])
    if not allowed or capabilities is None:
        return audit

    gated: list[str] = []
    for action in allowed:
        cap_key = _AUDIT_ACTION_CAPABILITY_KEYS.get(action)
        if cap_key is None or _capability_allowed(capabilities, cap_key):
            gated.append(action)

    return {**audit, "allowed_actions": gated}
