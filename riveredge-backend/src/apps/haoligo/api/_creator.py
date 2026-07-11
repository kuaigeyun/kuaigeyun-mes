"""好力 GO — 单据创建人显示名解析。"""

from __future__ import annotations

from collections.abc import Iterable

from infra.models.user import User


async def batch_lookup_user_names(tenant_id: int, user_ids: Iterable[int | None]) -> dict[int, str]:
    """批量解析租户用户显示名，供列表序列化避免 N+1。"""
    ids = sorted({int(i) for i in user_ids if i})
    if not ids:
        return {}
    users = await User.filter(id__in=ids, tenant_id=tenant_id, deleted_at__isnull=True).all()
    return {
        u.id: ((u.full_name or "").strip() or (u.username or "").strip() or str(u.id))
        for u in users
    }


def resolve_creator_name(
    *,
    created_by_name: str | None = None,
    applicant_name: str | None = None,
    registrant_name: str | None = None,
    trial_user_name: str | None = None,
    reporter_user_id: int | None = None,
    user_names: dict[int, str] | None = None,
) -> str | None:
    """按业务字段优先级得到单据创建人显示名。"""
    for text in (created_by_name, applicant_name, registrant_name, trial_user_name):
        trimmed = (text or "").strip()
        if trimmed:
            return trimmed
    if reporter_user_id and user_names:
        return user_names.get(int(reporter_user_id))
    return None


def current_user_creator_name(user: User) -> tuple[int, str]:
    """当前登录用户作为单据创建人。"""
    uid = int(user.id)
    name = ((user.full_name or "").strip() or (user.username or "").strip() or str(uid))
    return uid, name
