"""菜单节点与功能权限 resource 绑定（角色权限矩阵唯一真源）。"""

from __future__ import annotations

import re
from typing import Optional

# 与历史别名表对齐；仅在后端维护
RESOURCE_ALIAS_MAP: dict[str, list[str]] = {
    "purchase-request": ["purchase-requisition"],
    "purchase-requisition": ["purchase-request"],
    "sales-invoice": ["invoice"],
    "purchase-invoice": ["invoice"],
    "material": ["material-group"],
    "material-batch-rule": ["material-batch"],
}

_GENERIC_MENU_RESOURCES = frozenset({"workspace"})

REVIEW_ACTIONS = frozenset({"approve", "audit", "reject"})


def normalize_permission_code(code: str) -> str:
    return (code or "").strip().lower().replace("_", "-")


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


def resource_from_menu_path(path: str) -> Optional[str]:
    normalized = (path or "").rstrip("/")
    match = re.match(r"^/apps/[^/]+/(.+)$", normalized)
    if not match:
        return None
    segments = [s for s in match.group(1).split("/") if s]
    if not segments:
        return None
    return "-".join(segments)


def app_code_from_menu(*, permission_code: Optional[str], path: Optional[str]) -> Optional[str]:
    if permission_code:
        parsed = parse_permission_code(permission_code)
        if parsed:
            return parsed[0]
    if path:
        m = re.match(r"^/apps/([^/]+)", path)
        if m:
            return normalize_permission_code(m.group(1)).split(":")[0]
    return None


def resolve_menu_target_resource(*, permission_code: Optional[str], path: Optional[str]) -> Optional[str]:
    code = (permission_code or "").strip()
    norm = normalize_permission_code(code)
    parsed = parse_permission_code(code) if code else None
    if parsed and not is_generic_menu_permission_code(norm):
        return parsed[1]
    from_path = resource_from_menu_path(path or "")
    if from_path:
        return from_path
    return parsed[1] if parsed else None


def resource_match_keys(target_resource: str) -> set[str]:
    keys = {target_resource.strip().lower().replace("_", "-")}
    for alias in RESOURCE_ALIAS_MAP.get(target_resource, []):
        keys.add(alias.strip().lower().replace("_", "-"))
    return keys


def permission_matches_menu_resource(permission_code: str, target_resource: str, app: str) -> bool:
    parsed = parse_permission_code(permission_code)
    if not parsed:
        return False
    p_app, p_resource, _action = parsed
    app_variants = {app, app.replace("_", "-"), app.replace("-", "_")}
    if p_app not in app_variants:
        return False
    return p_resource in resource_match_keys(target_resource)
