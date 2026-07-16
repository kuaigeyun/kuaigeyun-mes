"""好力 GO — 单据通知人员候选（业务域选人，不依赖 system:user:*）。"""

from __future__ import annotations

from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from tortoise.expressions import Q

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/notify-users", tags=["App - HaoliGO - 通知人员候选"])


_require_haoligo_notify_user_picker_access = require_permission_codes(
    "haoligo:molds-documents-upkeep:read",
    "haoligo:molds-documents-repair:read",
    "haoligo:molds-documents-outsource-maintenance:read",
    "haoligo:equipment-documents-upkeep-sheet:read",
    "haoligo:molds-documents-upkeep-complete:read",
    "haoligo:molds-documents-repair-complete:read",
    "haoligo:molds-documents-outsource-complete:read",
    "haoligo:equipment-documents-upkeep-complete:read",
    "haoligo:molds-documents-trial:read",
    "haoligo:equipment-documents-spot-check:read",
    "haoligo:equipment-documents-route-patrol:read",
    "haoligo:patrol-daily-form:read",
    "haoligo:patrol-hazards:read",
    "haoligo:quality-issue-tracking:read",
    "haoligo:customer-complaint:read",
    "haoligo:line-stop-feedback:read",
    require_all=False,
)


class HaoligoNotifyUserOptionOut(BaseModel):
    id: int
    label: str
    username: Optional[str] = None
    full_name: Optional[str] = None


def _format_notify_user_label(*, user_id: int, username: Optional[str], full_name: Optional[str]) -> str:
    name = (full_name or "").strip()
    login = (username or "").strip()
    if name and login:
        return f"{name} ({login})"
    if name:
        return name
    if login:
        return login
    return f"用户#{user_id}"


@router.get(
    "/options",
    response_model=List[HaoligoNotifyUserOptionOut],
    summary="好力GO单据通知人员候选",
)
async def list_haoligo_notify_user_options(
    keyword: Optional[str] = Query(None, description="姓名/账号关键词"),
    selected_user_ids: Optional[List[int]] = Query(
        None,
        description="当前已选用户ID（用于补全回显）",
    ),
    limit: int = Query(100, ge=1, le=200),
    _auth: object = Depends(_require_haoligo_notify_user_picker_access),
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(get_current_user),
):
    base_q = Q(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True)
    kw = (keyword or "").strip()
    if kw:
        base_q &= Q(username__icontains=kw) | Q(full_name__icontains=kw)

    rows = await User.filter(base_q).order_by("full_name", "username", "id").limit(limit).all()

    selected_ids = [
        int(uid)
        for uid in (selected_user_ids or [])
        if isinstance(uid, int) and uid > 0
    ]
    selected_rows: list[User] = []
    if selected_ids:
        selected_rows = await User.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            id__in=selected_ids,
        ).all()

    by_id: dict[int, User] = {}
    for row in selected_rows:
        by_id[row.id] = row
    for row in rows:
        by_id[row.id] = row

    ordered_ids = [
        uid for uid in selected_ids if uid in by_id
    ] + [uid for uid in [r.id for r in rows] if uid not in selected_ids]

    return [
        HaoligoNotifyUserOptionOut(
            id=uid,
            label=_format_notify_user_label(
                user_id=uid,
                username=getattr(by_id[uid], "username", None),
                full_name=getattr(by_id[uid], "full_name", None),
            ),
            username=getattr(by_id[uid], "username", None),
            full_name=getattr(by_id[uid], "full_name", None),
        )
        for uid in ordered_ids
    ]

