"""菜单节点与功能权限 resource 绑定（仅认显式权限码真源）。"""

from __future__ import annotations

from typing import Optional

_GENERIC_MENU_RESOURCES = frozenset({"workspace"})

REVIEW_ACTIONS = frozenset({"approve", "audit", "reject"})


def normalize_permission_code(code: str) -> str:
    return (code or "").strip().lower()


def parse_permission_code(code: str) -> Optional[tuple[str, str, str]]:
    """解析 app:resource:action。"""
    norm = normalize_permission_code(code)
    parts = [p for p in norm.split(":") if p]
    if len(parts) < 3:
        return None
    app, action = parts[0], parts[-1]
    resource = ":".join(parts[1:-1])
    return app, resource, action


def is_generic_menu_permission_code(norm: str) -> bool:
    if not norm:
        return True
    parsed = parse_permission_code(norm)
    if not parsed:
        return True
    _app, resource, _action = parsed
    if resource in _GENERIC_MENU_RESOURCES or resource == _app:
        return True
    return False


def app_code_from_menu(*, permission_code: Optional[str], path: Optional[str]) -> Optional[str]:
    del path
    parsed = parse_permission_code(permission_code or "")
    return parsed[0] if parsed else None


def resolve_menu_target_resource(*, permission_code: Optional[str], path: Optional[str]) -> Optional[str]:
    del path
    code = (permission_code or "").strip()
    norm = normalize_permission_code(code)
    parsed = parse_permission_code(code) if code else None
    if not parsed or is_generic_menu_permission_code(norm):
        return None
    return parsed[1]


def permission_matches_menu_resource(permission_code: str, target_resource: str, app: str) -> bool:
    parsed = parse_permission_code(permission_code)
    if not parsed:
        return False
    p_app, p_resource, _action = parsed
    if p_app != app:
        return False
    return p_resource == target_resource
