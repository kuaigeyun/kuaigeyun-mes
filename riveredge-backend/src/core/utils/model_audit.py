"""BaseModel 审计字段写入（创建人/更新人 ID + 姓名快照）。"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from infra.models.user import User


def user_audit_display_name(user: User) -> str:
    name = (user.full_name or "").strip()
    if name:
        return name
    return (user.username or "").strip() or str(user.id)


async def resolve_audit_actor(tenant_id: int, user_id: int) -> Tuple[int, str]:
    user = await User.filter(
        id=user_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).first()
    if not user:
        raise ValueError(f"操作用户不存在: id={user_id}, tenant_id={tenant_id}")
    return user.id, user_audit_display_name(user)


def audit_fields_for_create(user_id: int, display_name: str) -> Dict[str, Any]:
    return {
        "created_by": user_id,
        "created_by_name": display_name,
        "updated_by": user_id,
        "updated_by_name": display_name,
    }


def audit_fields_for_update(user_id: int, display_name: str) -> Dict[str, Any]:
    return {
        "updated_by": user_id,
        "updated_by_name": display_name,
    }


async def load_audit_fields_for_create(
    tenant_id: int,
    current_user_id: int,
) -> Dict[str, Any]:
    user_id, name = await resolve_audit_actor(tenant_id, current_user_id)
    return audit_fields_for_create(user_id, name)


async def load_audit_fields_for_update(
    tenant_id: int,
    current_user_id: int,
) -> Dict[str, Any]:
    user_id, name = await resolve_audit_actor(tenant_id, current_user_id)
    return audit_fields_for_update(user_id, name)
