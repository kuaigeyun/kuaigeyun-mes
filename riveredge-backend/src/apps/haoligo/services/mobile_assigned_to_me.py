"""个人待办队列谓词：与 mobile_todo_badges 角标口径一致。"""

from __future__ import annotations

from typing import Any

from tortoise.expressions import Q
from tortoise.queryset import QuerySet

from core.config.permission_contract import build_permission_code
from core.services.authorization.user_permission_service import UserPermissionService
from infra.models.user import User


def json_contains_user(field: str, user_id: int) -> Q:
    return Q(**{f"{field}__contains": [user_id]})


def json_empty_or_null(field: str) -> Q:
    return Q(**{f"{field}": None}) | Q(**{f"{field}": []})


async def has_perm(user: User, tenant_id: int, code: str) -> bool:
    if await UserPermissionService.is_admin_bypass(user, tenant_id):
        return True
    return await UserPermissionService.has_permission(user.id, tenant_id, code)


def personal_notify_q(field: str, user_id: int, *, expand_when_empty: bool) -> Q:
    personal = json_contains_user(field, user_id)
    if expand_when_empty:
        return personal | json_empty_or_null(field)
    return personal


async def apply_assigned_to_me_pending_audit(
    qs: QuerySet,
    user: User,
    tenant_id: int,
    *,
    notify_field: str,
    approve_module: str,
) -> QuerySet:
    """待审单据：指定通知人；有 approve 时无指定人也可看。"""
    has_approve = await has_perm(
        user, tenant_id, build_permission_code("haoligo", approve_module, "approve")
    )
    return qs.filter(personal_notify_q(notify_field, int(user.id), expand_when_empty=has_approve))


async def apply_assigned_to_me_trial_failed(qs: QuerySet, user: User) -> QuerySet:
    uid = int(user.id)
    return qs.filter(json_contains_user("pending_notify_user_ids", uid) | Q(trial_user_id=uid))


async def apply_assigned_to_me_open_for_complete(
    qs: QuerySet,
    user: User,
    tenant_id: int,
    *,
    notify_field: str = "complete_notify_user_ids",
    complete_module: str,
) -> QuerySet:
    has_complete = await has_perm(
        user, tenant_id, build_permission_code("haoligo", complete_module, "create")
    )
    return qs.filter(personal_notify_q(notify_field, int(user.id), expand_when_empty=has_complete))


async def apply_assigned_to_me_outsource_complete_pending(
    qs: QuerySet,
    user: User,
    tenant_id: int,
) -> QuerySet:
    has_approve = await has_perm(
        user,
        tenant_id,
        build_permission_code("haoligo", "molds-documents-outsource-complete", "approve"),
    )
    if has_approve:
        return qs
    return qs.filter(applicant_user_id=int(user.id))


async def apply_assigned_to_me_hazard(qs: QuerySet, user: User) -> QuerySet:
    uid = int(user.id)
    return qs.filter(Q(responsible_user_id=uid) | json_contains_user("report_notify_user_ids", uid))


async def apply_assigned_to_me_quality_handle(qs: QuerySet, user: User) -> QuerySet:
    uid = int(user.id)
    return qs.filter(json_contains_user("responsible_user_ids", uid) | Q(responsible_user_id=uid))


def coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}
