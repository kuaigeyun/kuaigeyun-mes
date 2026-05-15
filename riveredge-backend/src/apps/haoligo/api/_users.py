"""好力 GO — 租户用户解析（登记人/责任人等）。"""

from fastapi import HTTPException, status

from infra.models.user import User


async def resolve_tenant_user(tenant_id: int, user_id: int) -> tuple[int, str]:
    """校验用户属于当前租户，返回 (id, 显示名)。"""
    u = await User.filter(
        id=user_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).first()
    if not u:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户不存在或不属于当前组织",
        )
    display = ((u.full_name or "").strip() or (u.username or "").strip() or str(u.id))
    return user_id, display
