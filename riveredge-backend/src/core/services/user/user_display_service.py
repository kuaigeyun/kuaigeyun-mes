"""用户展示解析：供业务单据选人/回显，权限弱于 system:user:read。"""

from __future__ import annotations

from typing import Optional

from tortoise.expressions import Q

from core.models.department import Department
from core.models.position import Position
from core.models.role import Role
from core.models.user_role import UserRole
from core.schemas.user_display import UserDisplayItem, UserDisplayRoleItem
from infra.models.user import User


class UserDisplayService:
    @staticmethod
    def format_label(*, full_name: Optional[str], username: Optional[str], user_id: int) -> str:
        name = (full_name or "").strip()
        login = (username or "").strip()
        if name and login:
            return f"{name} ({login})"
        if name:
            return name
        if login:
            return login
        return str(user_id)

    @staticmethod
    async def _department_uuid_map(tenant_id: int, department_ids: set[int]) -> dict[int, str]:
        if not department_ids:
            return {}
        rows = await Department.filter(
            id__in=list(department_ids),
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).all()
        return {d.id: d.uuid for d in rows}

    @staticmethod
    def _roles_data(user: User) -> list[UserDisplayRoleItem]:
        roles_rel = getattr(user, "roles", None)
        if not roles_rel:
            return []
        out: list[UserDisplayRoleItem] = []
        for role in roles_rel:
            name = (getattr(role, "name", None) or "").strip()
            if not name:
                continue
            out.append(
                UserDisplayRoleItem(
                    uuid=str(role.uuid),
                    name=name,
                    code=getattr(role, "code", None),
                )
            )
        return out

    @staticmethod
    def _to_item(user: User, dept_uuid_by_id: dict[int, str]) -> UserDisplayItem:
        dept_uuid = None
        if user.department_id:
            dept_uuid = dept_uuid_by_id.get(user.department_id)
        return UserDisplayItem(
            id=user.id,
            uuid=user.uuid,
            username=user.username,
            full_name=user.full_name,
            label=UserDisplayService.format_label(
                full_name=user.full_name,
                username=user.username,
                user_id=user.id,
            ),
            department_uuid=dept_uuid,
            roles=UserDisplayService._roles_data(user),
        )

    @staticmethod
    async def search(
        *,
        tenant_id: int,
        page: int = 1,
        page_size: int = 50,
        keyword: Optional[str] = None,
        department_uuid: Optional[str] = None,
        position_uuid: Optional[str] = None,
        role_uuid: Optional[str] = None,
        role_code: Optional[str] = None,
        is_active: Optional[bool] = True,
    ) -> dict:
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            kw = keyword.strip()
            if kw:
                query &= Q(username__icontains=kw) | Q(full_name__icontains=kw)
        if department_uuid:
            department = await Department.filter(
                uuid=department_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if department:
                query &= Q(department_id=department.id)
        if position_uuid:
            position = await Position.filter(
                uuid=position_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if position:
                query &= Q(position_id=position.id)
        role_uuid_s = (role_uuid or "").strip() or None
        role_code_s = (role_code or "").strip() or None
        if role_uuid_s or role_code_s:
            role_q = Role.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if role_uuid_s:
                role_q = role_q.filter(uuid=role_uuid_s)
            if role_code_s:
                role_q = role_q.filter(code=role_code_s)
            role = await role_q.first()
            if role:
                user_ids = await UserRole.filter(role_id=role.id).values_list("user_id", flat=True)
                query &= Q(id__in=list(user_ids) if user_ids else [])
            else:
                query &= Q(id__in=[])
        if is_active is not None:
            query &= Q(is_active=is_active)

        total = await User.filter(query).count()
        offset = (page - 1) * page_size
        users = (
            await User.filter(query)
            .order_by("full_name", "username")
            .offset(offset)
            .limit(page_size)
            .prefetch_related("roles")
            .all()
        )
        dept_ids = {u.department_id for u in users if u.department_id}
        dept_uuid_by_id = await UserDisplayService._department_uuid_map(tenant_id, dept_ids)
        items = [UserDisplayService._to_item(u, dept_uuid_by_id) for u in users]
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    @staticmethod
    async def resolve(
        *,
        tenant_id: int,
        user_ids: list[int] | None = None,
        user_uuids: list[str] | None = None,
    ) -> list[UserDisplayItem]:
        ids = sorted({int(i) for i in (user_ids or []) if i is not None})
        uuids = sorted({str(u).strip() for u in (user_uuids or []) if str(u).strip()})
        if not ids and not uuids:
            return []

        cond = Q(tenant_id=tenant_id, deleted_at__isnull=True)
        if ids and uuids:
            cond &= Q(id__in=ids) | Q(uuid__in=uuids)
        elif ids:
            cond &= Q(id__in=ids)
        else:
            cond &= Q(uuid__in=uuids)

        users = await User.filter(cond).prefetch_related("roles").all()
        dept_ids = {u.department_id for u in users if u.department_id}
        dept_uuid_by_id = await UserDisplayService._department_uuid_map(tenant_id, dept_ids)
        return [UserDisplayService._to_item(u, dept_uuid_by_id) for u in users]

    @staticmethod
    async def build_label_map(*, tenant_id: int, user_ids: set[int] | list[int]) -> dict[int, str]:
        ids = sorted({int(i) for i in user_ids if i})
        if not ids:
            return {}
        users = await User.filter(
            tenant_id=tenant_id,
            id__in=ids,
            deleted_at__isnull=True,
        ).all()
        return {
            user.id: UserDisplayService.format_label(
                full_name=user.full_name,
                username=user.username,
                user_id=user.id,
            )
            for user in users
        }

    @staticmethod
    async def find_full_name_collisions(
        *,
        tenant_id: int,
        full_name: str,
        exclude_user_id: Optional[int] = None,
    ) -> list[UserDisplayItem]:
        normalized = (full_name or "").strip()
        if not normalized:
            return []
        query = User.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            full_name__iexact=normalized,
        )
        if exclude_user_id is not None:
            query = query.exclude(id=exclude_user_id)
        users = await query.order_by("username").all()
        return [
            UserDisplayItem(
                id=user.id,
                uuid=str(user.uuid),
                username=user.username,
                full_name=user.full_name,
                label=UserDisplayService.format_label(
                    full_name=user.full_name,
                    username=user.username,
                    user_id=user.id,
                ),
            )
            for user in users
        ]
