"""
用户有效访问真源（多角色先合并，再鉴权）

唯一路径：一次加载用户全部角色授权 → 并集成 EffectiveUserAccess →
功能判定 / 数据范围 / 字段掩码入口均读此对象，禁止按角色循环扫 RolePermission。
"""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any

from core.models.permission import Permission, PermissionType
from core.models.role_permission import RolePermission
from core.models.user_role import UserRole
from core.services.authorization.data_scope_resource_registry import normalize_resource_key
from core.services.authorization.menu_resource_resolver import (
    is_generic_menu_permission_code,
    normalize_permission_code,
)
from core.services.authorization.permission_registry_service import PermissionRegistryService
from core.services.authorization.permission_version_service import PermissionVersionService
from core.services.authorization.user_permission_service import UserPermissionService
from infra.infrastructure.cache.cache_manager import cache_manager
from infra.models.user import User

_REQUEST_MEMO: ContextVar[dict[str, Any] | None] = ContextVar(
    "effective_access_request_memo",
    default=None,
)

# 系统管理员角色：该角色视为授予全部功能资源（判定真源 UserPermissionService.is_admin_system_role）
ALL_RESOURCES_MARKER = "*"


def _memo() -> dict[str, Any]:
    bag = _REQUEST_MEMO.get()
    if bag is None:
        bag = {}
        _REQUEST_MEMO.set(bag)
    return bag


def _permission_code_to_resource_key(code: str) -> str | None:
    norm = (code or "").strip().lower()
    if not norm or is_generic_menu_permission_code(norm):
        return None
    parts = [p for p in norm.split(":") if p]
    if len(parts) < 3:
        return None
    app = parts[0]
    resource = ":".join(parts[1:-1])
    if not app or not resource:
        return None
    return normalize_resource_key(f"{app}:{resource}")


def _is_admin_system_role(role: Any) -> bool:
    return UserPermissionService.is_admin_system_role(role)


@dataclass(frozen=True)
class EffectiveUserAccess:
    """多角色并集后的有效访问；功能/数据鉴权只读本对象。"""

    user_id: int
    tenant_id: int
    roles: tuple[Any, ...]
    permission_codes: frozenset[str]
    # role_uuid → 已授功能资源键；含 ALL_RESOURCES_MARKER 表示该角色为系统管理员角色
    role_resource_keys: dict[str, frozenset[str]]
    is_admin_bypass: bool

    def grants_resource(self, resource: str) -> bool:
        if self.is_admin_bypass:
            return True
        key = normalize_resource_key(resource)
        if not key:
            return False
        for keys in self.role_resource_keys.values():
            if ALL_RESOURCES_MARKER in keys or key in keys:
                return True
        return False

    def roles_for_data_scope(self, resource: str) -> list[Any]:
        """
        参与数据范围并集的角色：仅「已授该资源功能」的角色。
        无一角色授予时返回空列表（由 DataScopeService 拒绝行可见），禁止回退全部角色。
        """
        key = normalize_resource_key(resource)
        granted: list[Any] = []
        for role in self.roles:
            role_uuid = (getattr(role, "uuid", None) or "").strip()
            if not role_uuid:
                continue
            keys = self.role_resource_keys.get(role_uuid) or frozenset()
            if ALL_RESOURCES_MARKER in keys or key in keys:
                granted.append(role)
        return granted

    def granted_resource_keys(self) -> frozenset[str]:
        if self.is_admin_bypass or any(
            ALL_RESOURCES_MARKER in keys for keys in self.role_resource_keys.values()
        ):
            return frozenset({ALL_RESOURCES_MARKER})
        out: set[str] = set()
        for keys in self.role_resource_keys.values():
            out |= set(keys)
        out.discard(ALL_RESOURCES_MARKER)
        return frozenset(out)


class EffectiveAccessService:
    """多角色有效访问唯一装载入口。"""

    ALL_RESOURCES_MARKER = ALL_RESOURCES_MARKER

    @classmethod
    async def get(
        cls,
        user_id: int,
        tenant_id: int,
        *,
        include_inactive_roles: bool = False,
        user: User | None = None,
    ) -> EffectiveUserAccess:
        memo = _memo()
        memo_key = f"{int(tenant_id)}:{int(user_id)}:inactive:{int(include_inactive_roles)}"
        hit = memo.get(memo_key)
        if isinstance(hit, EffectiveUserAccess):
            return hit

        version = await PermissionVersionService.get_version(
            tenant_id=tenant_id, user_id=user_id
        )
        cache_key = f"{memo_key}:v{version}"
        cached = await cache_manager.get("effective_access", cache_key)
        if isinstance(cached, dict):
            access = await cls._hydrate_from_cache(
                user_id=user_id,
                tenant_id=tenant_id,
                payload=cached,
                user=user,
            )
            if access is not None:
                memo[memo_key] = access
                return access

        access = await cls._load(
            user_id=user_id,
            tenant_id=tenant_id,
            include_inactive_roles=include_inactive_roles,
            user=user,
        )
        await cache_manager.set(
            "effective_access",
            cache_key,
            {
                "permission_codes": sorted(access.permission_codes),
                "role_resource_keys": {
                    uuid: sorted(keys) for uuid, keys in access.role_resource_keys.items()
                },
                "role_ids": [int(r.id) for r in access.roles],
                "is_admin_bypass": access.is_admin_bypass,
            },
            ttl=1800,
        )
        # 与历史 permissions 缓存键对齐，供仍读该桶的路径命中同一并集
        await cache_manager.set(
            "permissions",
            f"{tenant_id}:{user_id}:v{version}:inactive:{int(include_inactive_roles)}",
            sorted(access.permission_codes),
            ttl=1800,
        )
        memo[memo_key] = access
        return access

    @classmethod
    async def _hydrate_from_cache(
        cls,
        *,
        user_id: int,
        tenant_id: int,
        payload: dict[str, Any],
        user: User | None,
    ) -> EffectiveUserAccess | None:
        role_ids = [int(x) for x in (payload.get("role_ids") or [])]
        from core.models.role import Role

        roles: list[Any] = []
        if role_ids:
            rows = await Role.filter(
                id__in=role_ids,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).all()
            by_id = {int(r.id): r for r in rows}
            roles = [by_id[i] for i in role_ids if i in by_id]
        codes = frozenset(
            normalize_permission_code(c)
            for c in (payload.get("permission_codes") or [])
            if c
        )
        role_resource_keys = {
            str(uuid): frozenset(str(k) for k in (keys or []) if k)
            for uuid, keys in (payload.get("role_resource_keys") or {}).items()
        }
        is_admin = bool(payload.get("is_admin_bypass"))
        if user is None:
            user = await User.get_or_none(id=user_id)
        if user is not None and not is_admin:
            is_admin = cls._user_flag_admin(user)
        return EffectiveUserAccess(
            user_id=user_id,
            tenant_id=tenant_id,
            roles=tuple(roles),
            permission_codes=codes,
            role_resource_keys=role_resource_keys,
            is_admin_bypass=is_admin,
        )

    @classmethod
    def _user_flag_admin(cls, user: User) -> bool:
        return UserPermissionService.is_platform_or_tenant_admin(user)

    @classmethod
    async def _load(
        cls,
        *,
        user_id: int,
        tenant_id: int,
        include_inactive_roles: bool,
        user: User | None,
    ) -> EffectiveUserAccess:
        if user is None:
            user = await User.get_or_none(id=user_id)

        user_roles = await UserRole.filter(user_id=user_id).prefetch_related("role").all()
        roles: list[Any] = []
        for ur in user_roles:
            role = ur.role
            if not role or role.tenant_id != tenant_id:
                continue
            if not include_inactive_roles and not role.is_active:
                continue
            roles.append(role)

        is_admin_bypass = bool(user and cls._user_flag_admin(user))
        if not is_admin_bypass and any(_is_admin_system_role(r) for r in roles):
            is_admin_bypass = True

        if is_admin_bypass:
            all_codes = await cls._all_tenant_permission_codes(tenant_id)
            role_resource_keys = {
                (getattr(r, "uuid", None) or "").strip(): frozenset({ALL_RESOURCES_MARKER})
                for r in roles
                if (getattr(r, "uuid", None) or "").strip()
            }
            return EffectiveUserAccess(
                user_id=user_id,
                tenant_id=tenant_id,
                roles=tuple(roles),
                permission_codes=frozenset(all_codes),
                role_resource_keys=role_resource_keys,
                is_admin_bypass=True,
            )

        if not roles:
            return EffectiveUserAccess(
                user_id=user_id,
                tenant_id=tenant_id,
                roles=tuple(),
                permission_codes=frozenset(),
                role_resource_keys={},
                is_admin_bypass=False,
            )

        defs = await PermissionRegistryService.collect_definitions(tenant_id=tenant_id)
        pool_codes = set(defs.keys())

        role_ids = [int(r.id) for r in roles]
        id_to_uuid = {
            int(r.id): (getattr(r, "uuid", None) or "").strip()
            for r in roles
            if (getattr(r, "uuid", None) or "").strip()
        }

        role_resource_keys: dict[str, frozenset[str]] = {
            uuid: frozenset() for uuid in id_to_uuid.values()
        }
        for role in roles:
            role_uuid = (getattr(role, "uuid", None) or "").strip()
            if role_uuid and _is_admin_system_role(role):
                role_resource_keys[role_uuid] = frozenset({ALL_RESOURCES_MARKER})

        # 一次拉齐全部角色授权行 → 按角色并集资源键 + 全局权限码并集
        rps = await RolePermission.filter(role_id__in=role_ids).all()
        perm_ids = sorted({int(rp.permission_id) for rp in rps if rp.permission_id})
        code_by_perm_id: dict[int, str] = {}
        if perm_ids:
            perms = await Permission.filter(
                id__in=perm_ids,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                deprecated_at__isnull=True,
                permission_type=PermissionType.FUNCTION,
            ).only("id", "code")
            for p in perms:
                code = normalize_permission_code(p.code or "")
                if code and code in pool_codes:
                    code_by_perm_id[int(p.id)] = code

        codes_by_role: dict[str, set[str]] = {uuid: set() for uuid in id_to_uuid.values()}
        permission_codes: set[str] = set()
        for rp in rps:
            role_uuid = id_to_uuid.get(int(rp.role_id)) or ""
            if not role_uuid:
                continue
            if ALL_RESOURCES_MARKER in (role_resource_keys.get(role_uuid) or frozenset()):
                continue
            code = code_by_perm_id.get(int(rp.permission_id))
            if not code:
                continue
            codes_by_role.setdefault(role_uuid, set()).add(code)
            permission_codes.add(code)

        for role_uuid, codes in codes_by_role.items():
            if ALL_RESOURCES_MARKER in (role_resource_keys.get(role_uuid) or frozenset()):
                continue
            keys: set[str] = set()
            for code in codes:
                key = _permission_code_to_resource_key(code)
                if key:
                    keys.add(key)
            role_resource_keys[role_uuid] = frozenset(keys)

        permission_codes = PermissionRegistryService.merge_baseline_permission_codes(
            permission_codes
        )

        return EffectiveUserAccess(
            user_id=user_id,
            tenant_id=tenant_id,
            roles=tuple(roles),
            permission_codes=frozenset(permission_codes),
            role_resource_keys=role_resource_keys,
            is_admin_bypass=False,
        )

    @classmethod
    async def _all_tenant_permission_codes(cls, tenant_id: int) -> set[str]:
        rows = await Permission.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).only("code")
        return {
            code
            for code in (normalize_permission_code(p.code or "") for p in rows)
            if code
        }
