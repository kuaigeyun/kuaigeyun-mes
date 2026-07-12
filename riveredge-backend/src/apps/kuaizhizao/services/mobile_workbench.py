"""快制造 — 移动端工作台导航：manifest.mobile_workbench 为唯一真源。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from core.services.application.application_service import ApplicationService
from core.services.authorization.data_scope_service import DataScopeService
from core.services.authorization.user_permission_service import UserPermissionService
from infra.models.user import User

_MANIFEST_PATH = ApplicationService._get_plugins_directory() / "kuaizhizao" / "manifest.json"


def _load_mobile_workbench_config() -> dict[str, Any]:
    if not _MANIFEST_PATH.is_file():
        raise RuntimeError(f"Kuaizhizao manifest 缺失: {_MANIFEST_PATH}")
    data = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    cfg = data.get("mobile_workbench")
    if not isinstance(cfg, dict):
        raise RuntimeError("manifest.json 缺少 mobile_workbench 配置")
    return cfg


def _resolve_permissions_any(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    return [str(item).strip() for item in raw if isinstance(item, str) and str(item).strip()]


def _perm_set_contains(user_perms: set[str], code: str | None) -> bool:
    if not code or not str(code).strip():
        return False
    return UserPermissionService._normalize_permission_code(code) in user_perms


def _perm_set_overlaps(user_perms: set[str], codes: list[str]) -> bool:
    if not codes:
        return False
    normalized = {
        UserPermissionService._normalize_permission_code(c)
        for c in codes
        if c and str(c).strip()
    }
    return bool(user_perms & normalized)


async def _user_is_external_partner(tenant_id: int, user: User) -> bool:
    if await UserPermissionService.is_admin_bypass(user, tenant_id):
        return False
    roles = await DataScopeService._load_active_roles(user.id, tenant_id)
    return any(
        (getattr(role, "role_type", "") or "").strip().lower() == "external"
        and (getattr(role, "external_partner_type", "") or "").strip()
        for role in roles
    )


def _filter_scope_sections(
    scope_cfg: dict[str, Any],
    *,
    user_perms: set[str],
    is_external_partner: bool,
    admin_bypass: bool,
) -> list[dict[str, Any]]:
    if scope_cfg.get("hide_when_external_partner") and is_external_partner:
        return []

    sections_out: list[dict[str, Any]] = []
    for section in scope_cfg.get("sections") or []:
        if not isinstance(section, dict):
            continue
        entries_out: list[dict[str, Any]] = []
        for entry in section.get("entries") or []:
            if not isinstance(entry, dict):
                continue
            if entry.get("internal_only") and is_external_partner:
                continue
            if entry.get("outsource_only") and not is_external_partner:
                continue
            permission = (entry.get("permission") or "").strip()
            permissions_any = _resolve_permissions_any(entry.get("permissions_any"))
            if not admin_bypass:
                base = _perm_set_contains(user_perms, permission) if permission else False
                ext = _perm_set_overlaps(user_perms, permissions_any) if permissions_any else False
                if not (base or ext):
                    continue
            route = (entry.get("route") or "").strip()
            if not route:
                continue
            item: dict[str, Any] = {
                "key": (entry.get("key") or "").strip() or "entry",
                "label": (entry.get("label") or "").strip() or route,
                "route": route,
                "icon": (entry.get("icon") or "app").strip(),
            }
            icon_group = (entry.get("icon_group") or "").strip()
            if icon_group:
                item["icon_group"] = icon_group
            if entry.get("solo_row"):
                item["solo_row"] = True
            entries_out.append(item)
        if not entries_out:
            continue
        sections_out.append(
            {
                "key": (section.get("key") or "").strip() or "section",
                "title": (section.get("title") or "").strip() or "工作台",
                "entries": entries_out,
            }
        )
    return sections_out


async def resolve_mobile_workbench(
    *,
    tenant_id: int,
    user: User,
    scope: str,
) -> list[dict[str, Any]]:
    cfg = _load_mobile_workbench_config()
    scopes = cfg.get("scopes")
    if not isinstance(scopes, dict):
        raise RuntimeError("mobile_workbench.scopes 配置无效")

    scope_key = (scope or "").strip()
    scope_cfg = scopes.get(scope_key)
    if not isinstance(scope_cfg, dict):
        return []

    user_perms = await UserPermissionService.get_user_permissions(user.id, tenant_id)
    is_external = await _user_is_external_partner(tenant_id, user)
    bypass = await UserPermissionService.is_admin_bypass(user, tenant_id)
    return _filter_scope_sections(
        scope_cfg,
        user_perms=user_perms,
        is_external_partner=is_external,
        admin_bypass=bypass,
    )
