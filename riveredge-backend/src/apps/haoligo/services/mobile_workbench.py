"""移动端工作台导航：manifest.mobile_workbench 为唯一真源，RBAC 与 PC 同源。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from apps.haoligo.authorization.workflow_permissions import (
    parse_complete_create_token,
    permission_codes_for_complete_create,
)
from core.config.permission_contract import review_permission_codes
from core.services.application.application_service import ApplicationService
from core.services.authorization.data_scope_service import DataScopeService
from core.services.authorization.user_permission_service import UserPermissionService
from infra.models.user import User

_MANIFEST_PATH = ApplicationService._get_plugins_directory() / "haoligo" / "manifest.json"


def _load_mobile_workbench_config() -> dict[str, Any]:
    if not _MANIFEST_PATH.is_file():
        raise RuntimeError(f"HaoliGO manifest 缺失: {_MANIFEST_PATH}")
    data = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    cfg = data.get("mobile_workbench")
    if not isinstance(cfg, dict):
        raise RuntimeError("manifest.json 缺少 mobile_workbench 配置")
    return cfg


def _parse_resource_prefix(resource: str) -> tuple[str, str]:
    norm = (resource or "").strip().lower()
    parts = [p for p in norm.split(":") if p]
    if len(parts) < 2:
        raise ValueError(f"无效资源前缀：{resource!r}")
    return parts[0], ":".join(parts[1:])


def _resolve_permissions_any(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    codes: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text:
            continue
        if text.startswith("complete_create:"):
            src, tgt = parse_complete_create_token(text)
            codes.extend(
                permission_codes_for_complete_create(
                    source_resource=src.strip(),
                    target_resource=tgt.strip(),
                )
            )
        else:
            codes.append(text)
    return codes


def _user_has_permission(user_perms: set[str], code: str | None) -> bool:
    if not code or not str(code).strip():
        return False
    return UserPermissionService._normalize_permission_code(code) in user_perms


def _user_has_any_permission(user_perms: set[str], codes: list[str]) -> bool:
    if not codes:
        return False
    normalized = {
        UserPermissionService._normalize_permission_code(c)
        for c in codes
        if c and str(c).strip()
    }
    return bool(user_perms & normalized)


def _user_has_review_permission(user_perms: set[str], resource_prefix: str) -> bool:
    app_code, module_code = _parse_resource_prefix(resource_prefix)
    codes = review_permission_codes(app_code, module_code)
    return _user_has_any_permission(user_perms, codes)


async def _user_is_external_partner(tenant_id: int, user: User) -> bool:
    if DataScopeService._admin_bypass(user):
        return False
    roles = await DataScopeService._load_active_roles(user.id, tenant_id)
    return any(
        (getattr(role, "role_type", "") or "").strip().lower() == "external"
        and (getattr(role, "external_partner_type", "") or "").strip()
        for role in roles
    )


async def _admin_bypass(user: User, tenant_id: int) -> bool:
    if user.is_tenant_admin or user.is_infra_admin:
        return True
    roles = await UserPermissionService.get_user_roles(user.id, tenant_id)
    return any(
        (r.code or "").strip().upper() in UserPermissionService.ADMIN_ROLE_CODES
        or (r.name or "").strip() == UserPermissionService.ADMIN_ROLE_NAME
        for r in roles
    )


async def _resolve_user_permissions(user: User, tenant_id: int) -> set[str]:
    return await UserPermissionService.get_user_permissions(user.id, tenant_id)


def _entry_visible(
    entry: dict[str, Any],
    *,
    user_perms: set[str],
    is_external_partner: bool,
    admin_bypass: bool,
) -> bool:
    if entry.get("internal_only") and is_external_partner:
        return False
    if entry.get("outsource_only") and not is_external_partner:
        return False

    if admin_bypass:
        return True

    review_resource = (entry.get("review_resource") or "").strip()
    if review_resource:
        return _user_has_review_permission(user_perms, review_resource)

    permission = (entry.get("permission") or "").strip()
    permissions_any = _resolve_permissions_any(entry.get("permissions_any"))

    base = _user_has_permission(user_perms, permission) if permission else False
    ext = _user_has_any_permission(user_perms, permissions_any) if permissions_any else False
    return base or ext


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
        if section.get("hide_when_external_partner") and is_external_partner:
            continue

        entries_out: list[dict[str, Any]] = []
        for entry in section.get("entries") or []:
            if not isinstance(entry, dict):
                continue
            if not _entry_visible(
                entry,
                user_perms=user_perms,
                is_external_partner=is_external_partner,
                admin_bypass=admin_bypass,
            ):
                continue
            key = (entry.get("key") or "").strip()
            label = (entry.get("label") or "").strip()
            route = (entry.get("route") or "").strip()
            icon = (entry.get("icon") or "").strip()
            if not key or not label or not route or not icon:
                continue
            item: dict[str, Any] = {
                "key": key,
                "label": label,
                "route": route,
                "icon": icon,
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

    user_perms = await _resolve_user_permissions(user, tenant_id)
    is_external = await _user_is_external_partner(tenant_id, user)
    bypass = await _admin_bypass(user, tenant_id)
    return _filter_scope_sections(
        scope_cfg,
        user_perms=user_perms,
        is_external_partner=is_external,
        admin_bypass=bypass,
    )
