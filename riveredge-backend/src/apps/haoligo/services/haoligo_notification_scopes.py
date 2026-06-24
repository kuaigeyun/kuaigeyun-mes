"""好力 GO — 业务消息收件范围解析（审核岗、完修执行岗、来源单负责人）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from core.models.permission import Permission
from core.models.role import Role
from core.models.role_permission import RolePermission
from core.models.user_role import UserRole
from core.services.business.business_notification_service import register_notification_scope_resolver
from infra.models.user import User

from apps.haoligo.constants.mold_inhouse_maintenance_permissions import (
    complete_module_for_service_type,
    sheet_module_for_service_type,
)


async def list_tenant_user_ids_with_permission(
    tenant_id: int,
    permission_code: str,
) -> List[int]:
    """租户内持有指定 RBAC 权限码的活跃用户 ID（去重）。"""
    norm = (permission_code or "").strip().lower()
    if not norm:
        return []
    perms = await Permission.filter(tenant_id=tenant_id, deleted_at__isnull=True).all()
    perm_ids = [p.id for p in perms if (p.code or "").strip().lower() == norm]
    if not perm_ids:
        return []
    role_ids = list(await RolePermission.filter(permission_id__in=perm_ids).values_list("role_id", flat=True))
    if not role_ids:
        return []
    active_role_ids = list(
        await Role.filter(
            id__in=role_ids,
            tenant_id=tenant_id,
            is_active=True,
            deleted_at__isnull=True,
        ).values_list("id", flat=True)
    )
    if not active_role_ids:
        return []
    user_ids = list(await UserRole.filter(role_id__in=active_role_ids).values_list("user_id", flat=True))
    if not user_ids:
        return []
    seen: Set[int] = set()
    out: List[int] = []
    users = await User.filter(
        tenant_id=tenant_id,
        id__in=user_ids,
        is_active=True,
        deleted_at__isnull=True,
    ).all()
    for u in users:
        uid = int(u.id)
        if uid > 0 and uid not in seen:
            seen.add(uid)
            out.append(uid)
    return out


async def _merge_permission_holders(tenant_id: int, *permission_codes: str) -> List[int]:
    seen: Set[int] = set()
    out: List[int] = []
    for code in permission_codes:
        if not (code or "").strip():
            continue
        for uid in await list_tenant_user_ids_with_permission(tenant_id, code):
            if uid not in seen:
                seen.add(uid)
                out.append(uid)
    return out


def _service_type_from_context(context: Dict[str, Any]) -> str:
    return str(context.get("service_type") or "维修").strip() or "维修"


def _review_permission_from_context(context: Dict[str, Any]) -> Optional[str]:
    explicit = (context.get("review_permission_code") or "").strip()
    if explicit:
        return explicit
    doc = (context.get("trigger_document") or "").strip()
    svc = _service_type_from_context(context)
    mapping: dict[str, tuple[str, str]] = {
        "haoligo_mold_trial": ("haoligo:molds-documents-trial", "approve"),
        "haoligo_mold_maintenance": (sheet_module_for_service_type(svc), "approve"),
        "haoligo_outsource_maintenance": ("haoligo:molds-documents-outsource-maintenance", "approve"),
        "haoligo_mold_outsource_maintenance_complete": (
            "haoligo:molds-documents-outsource-complete",
            "approve",
        ),
    }
    pair = mapping.get(doc)
    if not pair:
        return None
    module, action = pair
    return f"haoligo:{module}:{action}"


def _complete_permissions_from_context(context: Dict[str, Any]) -> List[str]:
    explicit = context.get("complete_permission_codes")
    if isinstance(explicit, list):
        codes = [str(c).strip() for c in explicit if str(c).strip()]
        if codes:
            return codes
    doc = (context.get("trigger_document") or "").strip()
    svc = _service_type_from_context(context)
    if doc == "haoligo_mold_maintenance":
        sheet_mod = sheet_module_for_service_type(svc)
        complete_mod = complete_module_for_service_type(svc)
        return [
            f"haoligo:{sheet_mod}:complete",
            f"haoligo:{complete_mod}:create",
        ]
    if doc == "haoligo_equipment_upkeep_sheet":
        return [
            "haoligo:equipment-documents-upkeep-sheet:complete",
            "haoligo:equipment-documents-upkeep-complete:create",
        ]
    if doc == "haoligo_outsource_maintenance":
        return [
            "haoligo:molds-documents-outsource-maintenance:complete",
            "haoligo:molds-documents-outsource-complete:create",
        ]
    if doc == "haoligo_equipment_acceptance":
        return ["haoligo:equipment-documents-acceptance:execute"]
    return []


def _execute_permissions_from_context(context: Dict[str, Any]) -> List[str]:
    doc = (context.get("trigger_document") or "").strip()
    if doc == "haoligo_equipment_acceptance":
        return ["haoligo:equipment-documents-acceptance:execute"]
    return _complete_permissions_from_context(context)


async def _scope_module_reviewers(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    code = _review_permission_from_context(context)
    if not code:
        return []
    return await list_tenant_user_ids_with_permission(tenant_id, code)


async def _scope_module_complete_operators(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    codes = _complete_permissions_from_context(context)
    return await _merge_permission_holders(tenant_id, *codes)


async def _scope_module_acceptance_execute_operators(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    codes = _execute_permissions_from_context(context)
    return await _merge_permission_holders(tenant_id, *codes)


async def _scope_commissioning_operators(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    raw = context.get("commissioning_user_ids")
    if not isinstance(raw, list):
        return []
    seen: Set[int] = set()
    out: List[int] = []
    for item in raw:
        try:
            uid = int(item)
        except (TypeError, ValueError):
            continue
        if uid > 0 and uid not in seen:
            seen.add(uid)
            out.append(uid)
    return out


async def _scope_source_applicant(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    uid = context.get("source_applicant_user_id")
    if uid is None:
        return []
    try:
        i = int(uid)
    except (TypeError, ValueError):
        return []
    return [i] if i > 0 else []


async def _scope_source_auditor(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    uid = context.get("source_auditor_user_id")
    if uid is None:
        return []
    try:
        i = int(uid)
    except (TypeError, ValueError):
        return []
    return [i] if i > 0 else []


async def _scope_production_trial_operator(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    uid = context.get("production_trial_user_id")
    if uid is None:
        return []
    try:
        i = int(uid)
    except (TypeError, ValueError):
        return []
    return [i] if i > 0 else []


async def _scope_recall_operators(tenant_id: int, context: Dict[str, Any]) -> List[int]:
    return await list_tenant_user_ids_with_permission(tenant_id, "haoligo:molds-documents-trial:recall")


def ensure_haoligo_extended_notification_scope_resolvers() -> None:
    register_notification_scope_resolver("module_reviewers", _scope_module_reviewers)
    register_notification_scope_resolver("module_complete_operators", _scope_module_complete_operators)
    register_notification_scope_resolver("module_acceptance_execute_operators", _scope_module_acceptance_execute_operators)
    register_notification_scope_resolver("commissioning_operators", _scope_commissioning_operators)
    register_notification_scope_resolver("source_applicant", _scope_source_applicant)
    register_notification_scope_resolver("source_auditor", _scope_source_auditor)
    register_notification_scope_resolver("production_trial_operator", _scope_production_trial_operator)
    register_notification_scope_resolver("recall_operators", _scope_recall_operators)


ensure_haoligo_extended_notification_scope_resolvers()
