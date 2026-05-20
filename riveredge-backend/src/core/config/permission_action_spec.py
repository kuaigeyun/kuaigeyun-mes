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

def canonical_action(action: str) -> str:
    return (action or "").strip().lower()


def is_standard_action(action: str) -> bool:
    return canonical_action(action) in STANDARD_ACTIONS
