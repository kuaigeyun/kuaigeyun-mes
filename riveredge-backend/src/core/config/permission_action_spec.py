"""功能权限动作规范（RBAC 层）。"""

from __future__ import annotations

STANDARD_ACTIONS: set[str] = {
    "create",
    "read",
    "update",
    "delete",
    "assign",
    "audit",
    "submit",
    "approve",
    "reject",
    "revoke",
    "execute",
    "import",
    "export",
    "print",
}

# strict-cutover: 历史动作统一映射到标准动作，不保留旧动作语义分支
ACTION_ALIAS_MAP: dict[str, str] = {
    "view": "read",
    "list": "read",
    "query": "read",
    "detail": "read",
    "edit": "update",
    "modify": "update",
    "remove": "delete",
    "destroy": "delete",
    "verification": "audit",
    "verify": "audit",
    "pass": "approve",
    "accept": "approve",
    "deny": "reject",
    "refuse": "reject",
    "rollback": "revoke",
    "cancel": "revoke",
    "run": "execute",
    "sync": "execute",
    "compute": "execute",
    "proxy": "execute",
    "upload": "import",
    "download": "export",
    "send": "submit",
    "notify": "submit",
    "confirm": "approve",
    "conduct": "audit",
    "certificate": "audit",
    "withdraw": "revoke",
    "system": "read",
}


def canonical_action(action: str) -> str:
    raw = (action or "").strip().lower().replace("_", "-")
    return ACTION_ALIAS_MAP.get(raw, raw)


def is_standard_action(action: str) -> bool:
    return canonical_action(action) in STANDARD_ACTIONS
