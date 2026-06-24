"""
系统权限契约（RBAC 唯一真源）

权限码格式：{app}:{module}:{action}
- app / module：应用 manifest、菜单 permission_code、路由 require_module_access
- action：STANDARD_ACTIONS 之一（见 permission_action_spec）

角色 UI「审核」合并 approve + audit + reject（REVIEW_ACTIONS），
不得用 update/create 等替代审核、打印、完修等业务动作。
"""

from __future__ import annotations

from core.config.permission_action_spec import (
    STANDARD_ACTIONS,
    action_display_label,
    canonical_action,
    is_standard_action,
    permission_code_display_label,
)
from core.services.authorization.menu_resource_resolver import REVIEW_ACTIONS, parse_permission_code

__all__ = [
    "STANDARD_ACTIONS",
    "REVIEW_ACTIONS",
    "canonical_action",
    "is_standard_action",
    "build_permission_code",
    "parse_permission_code",
    "review_permission_codes",
    "validate_permission_code",
    "display_label_for_permission_code",
]


def build_permission_code(app_code: str, module_code: str, action: str) -> str:
    app = (app_code or "").strip().lower()
    module = (module_code or "").strip().lower()
    act = canonical_action(action)
    return f"{app}:{module}:{act}"


def review_permission_codes(app_code: str, module_code: str) -> list[str]:
    """与角色功能权限树「审核」勾选一致（merged_codes）。"""
    return [build_permission_code(app_code, module_code, a) for a in sorted(REVIEW_ACTIONS)]


def display_label_for_permission_code(code: str) -> str:
    """角色矩阵 / 权限同步展示名：权限码级覆盖优先，否则由 action 段映射。"""
    override = permission_code_display_label(code)
    if override:
        return override
    parsed = parse_permission_code(code or "")
    if not parsed:
        return ""
    _app, _resource, action = parsed
    return action_display_label(action)


def validate_permission_code(code: str) -> str | None:
    """
    校验权限码是否符合契约。通过返回 None，失败返回错误说明。
    """
    parsed = parse_permission_code(code or "")
    if not parsed:
        return f"权限码须为 app:module:action 三段以上：{code!r}"
    _app, _resource, action = parsed
    if not is_standard_action(action):
        return f"action {action!r} 不在 STANDARD_ACTIONS 内：{code!r}"
    return None
