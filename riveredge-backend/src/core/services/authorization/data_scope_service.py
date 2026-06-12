"""
数据权限执行服务（RDBC 查询层）

读取 core_data_permission_policies + core_user_data_scope_bindings，
对 Tortoise QuerySet 施加统一过滤；应用通过 resource profile 与 scope_custom 解析器扩展。
"""

from __future__ import annotations

from typing import Any, Iterable, Optional, Type

from fastapi import HTTPException, status
from loguru import logger
from tortoise.expressions import Q
from tortoise.models import Model

from core.models.data_permission_policy import DataPermissionPolicy, DataScopeType
from core.models.user_role import UserRole
from core.services.authorization.data_scope_resource_registry import (
    get_resource_profile,
    normalize_resource_key,
)
from core.services.authorization.data_scope_resolver_registry import (
    ScopeResolveContext,
    get_scope_resolver,
)
from core.services.authorization.data_scope_resolvers import (
    BUILTIN_SCOPE_RESOLVERS,
    register_builtin_scope_resolvers,
)
from core.services.authorization.user_data_scope_binding_service import UserDataScopeBindingService
from core.services.authorization.user_permission_service import UserPermissionService
from infra.models.user import User

_BUILTIN_REGISTERED = False


class DataScopeService:
    @classmethod
    def _ensure_builtin_resolvers(cls) -> None:
        global _BUILTIN_REGISTERED
        if not _BUILTIN_REGISTERED:
            register_builtin_scope_resolvers()
            _BUILTIN_REGISTERED = True

    @classmethod
    async def _admin_bypass(cls, user: User, tenant_id: int) -> bool:
        return await UserPermissionService.is_admin_bypass(user, tenant_id)

    @classmethod
    async def _load_role_uuids(cls, user_id: int, tenant_id: int) -> list[str]:
        user_roles = await UserRole.filter(user_id=user_id).prefetch_related("role").all()
        out: list[str] = []
        for ur in user_roles:
            role = ur.role
            if not role or role.tenant_id != tenant_id or not role.is_active:
                continue
            uuid = (getattr(role, "uuid", None) or "").strip()
            if uuid:
                out.append(uuid)
        return out

    @classmethod
    async def _load_active_roles(cls, user_id: int, tenant_id: int) -> list[Any]:
        user_roles = await UserRole.filter(user_id=user_id).prefetch_related("role").all()
        roles: list[Any] = []
        for ur in user_roles:
            role = ur.role
            if not role or role.tenant_id != tenant_id or not role.is_active:
                continue
            roles.append(role)
        return roles

    @classmethod
    async def serialize_active_roles(cls, user_id: int, tenant_id: int | None) -> list[dict[str, Any]]:
        if tenant_id is None:
            return []
        roles = await cls._load_active_roles(user_id, tenant_id)
        return [
            {
                "uuid": str(role.uuid),
                "name": role.name,
                "code": role.code,
                "role_type": (getattr(role, "role_type", None) or "").strip().lower() or None,
                "external_partner_type": getattr(role, "external_partner_type", None),
            }
            for role in roles
        ]

    @classmethod
    async def _default_external_partner_q(
        cls,
        *,
        tenant_id: int,
        user: User,
        profile: Any,
        roles: list[Any],
    ) -> Q | None:
        code_field = (getattr(profile, "partner_code_field", None) or "").strip()
        if not code_field:
            return None
        dimensions = [
            (getattr(role, "external_partner_type", "") or "").strip().lower()
            for role in roles
            if (getattr(role, "role_type", "") or "").strip().lower() == "external"
            and (getattr(role, "external_partner_type", "") or "").strip()
        ]
        if not dimensions:
            return None
        q_parts: list[Q] = []
        for dim in sorted(set(dimensions)):
            codes = await UserDataScopeBindingService.list_scope_codes(
                tenant_id=tenant_id,
                user_id=user.id,
                dimension=dim,
            )
            if codes:
                q_parts.append(Q(**{f"{code_field}__in": codes}))
        if not q_parts:
            return Q(id=-1)
        combined = q_parts[0]
        for part in q_parts[1:]:
            combined |= part
        return combined

    @classmethod
    async def _load_policies(cls, tenant_id: int, role_uuids: list[str], resource: str) -> list[DataPermissionPolicy]:
        if not role_uuids:
            return []
        resource_key = normalize_resource_key(resource)
        rows = await DataPermissionPolicy.filter(
            tenant_id=tenant_id,
            role_uuid__in=role_uuids,
            resource=resource_key,
            deleted_at__isnull=True,
        ).all()
        return list(rows)

    @classmethod
    async def _department_context(cls, tenant_id: int, user: User) -> tuple[str | None, list[int]]:
        await user.fetch_related("department")
        dept = getattr(user, "department", None)
        if not dept:
            return None, [user.id]
        dept_uuid = str(getattr(dept, "uuid", "") or "").strip() or None
        dept_id = getattr(user, "department_id", None)
        if dept_id is None:
            return dept_uuid, [user.id]
        user_ids = await User.filter(
            tenant_id=tenant_id,
            department_id=dept_id,
            deleted_at__isnull=True,
            is_active=True,
        ).values_list("id", flat=True)
        ids = [int(x) for x in user_ids] if user_ids else [user.id]
        return dept_uuid, ids

    @classmethod
    async def _policy_to_q(
        cls,
        policy: DataPermissionPolicy,
        *,
        tenant_id: int,
        user: User,
        resource: str,
        profile,
        dept_uuid: str | None,
        dept_user_ids: list[int],
    ) -> Q | None:
        scope = (policy.scope_type or "").strip().lower()
        if scope == DataScopeType.ALL:
            return None

        if scope in BUILTIN_SCOPE_RESOLVERS:
            ctx = ScopeResolveContext(
                tenant_id=tenant_id,
                user_id=user.id,
                resource=resource,
                profile=profile,
                scope_payload=None,
                department_uuid=dept_uuid,
                department_user_ids=dept_user_ids,
            )
            resolver = BUILTIN_SCOPE_RESOLVERS[scope]
            return await resolver(ctx)

        if scope == DataScopeType.CUSTOM:
            payload = policy.scope_payload if isinstance(policy.scope_payload, dict) else {}
            resolver_name = (payload.get("resolver") or "").strip().lower()
            if not resolver_name:
                logger.warning(
                    "data_scope_custom_missing_resolver tenant_id={} user_id={} resource={}",
                    tenant_id,
                    user.id,
                    resource,
                )
                return Q(id=-1)
            custom = get_scope_resolver(resolver_name)
            if custom is None:
                logger.warning(
                    "data_scope_custom_unknown_resolver resolver={} tenant_id={} resource={}",
                    resolver_name,
                    tenant_id,
                    resource,
                )
                return Q(id=-1)
            ctx = ScopeResolveContext(
                tenant_id=tenant_id,
                user_id=user.id,
                resource=resource,
                profile=profile,
                scope_payload=payload,
                department_uuid=dept_uuid,
                department_user_ids=dept_user_ids,
            )
            return await custom(ctx)

        logger.warning(
            "data_scope_unknown_type scope_type={} tenant_id={} resource={}",
            scope,
            tenant_id,
            resource,
        )
        return Q(id=-1)

    @classmethod
    async def apply(
        cls,
        queryset,
        *,
        tenant_id: int,
        user: User,
        resource: str,
    ):
        cls._ensure_builtin_resolvers()
        if await cls._admin_bypass(user, tenant_id):
            return queryset

        resource_key = normalize_resource_key(resource)
        profile = get_resource_profile(resource_key)
        roles = await cls._load_active_roles(user.id, tenant_id)
        role_uuids = [
            (getattr(role, "uuid", None) or "").strip()
            for role in roles
            if (getattr(role, "uuid", None) or "").strip()
        ]
        policies = await cls._load_policies(tenant_id, role_uuids, resource_key)

        if not policies:
            # 默认数据权限为“全部”：只有显式配置策略时才收敛数据范围。
            return queryset

        if any((p.scope_type or "").strip().lower() == DataScopeType.ALL for p in policies):
            return queryset

        dept_uuid, dept_user_ids = await cls._department_context(tenant_id, user)
        q_parts: list[Q] = []
        for policy in policies:
            part = await cls._policy_to_q(
                policy,
                tenant_id=tenant_id,
                user=user,
                resource=resource_key,
                profile=profile,
                dept_uuid=dept_uuid,
                dept_user_ids=dept_user_ids,
            )
            if part is None:
                return queryset
            q_parts.append(part)

        if not q_parts:
            return queryset.filter(id=-1)

        combined = q_parts[0]
        for part in q_parts[1:]:
            combined |= part
        return queryset.filter(combined)

    @classmethod
    async def row_visible(
        cls,
        row: Any,
        *,
        tenant_id: int,
        user: User,
        resource: str,
    ) -> bool:
        if row is None:
            return False
        if await cls._admin_bypass(user, tenant_id):
            return True
        model = row.__class__
        pk = getattr(row, "id", None)
        if pk is None:
            return False
        qs = model.filter(id=pk)
        if hasattr(model, "tenant_id"):
            qs = qs.filter(tenant_id=tenant_id)
        if hasattr(model, "deleted_at"):
            qs = qs.filter(deleted_at__isnull=True)
        scoped = await cls.apply(qs, tenant_id=tenant_id, user=user, resource=resource)
        return await scoped.exists()

    @classmethod
    async def assert_row_visible(
        cls,
        row: Any,
        *,
        tenant_id: int,
        user: User,
        resource: str,
    ) -> None:
        if await cls.row_visible(row, tenant_id=tenant_id, user=user, resource=resource):
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACCESS_DENIED",
                "message": "权限不足",
                "details": {
                    "reason": "data_scope_denied",
                    "resource": normalize_resource_key(resource),
                },
            },
        )

    @classmethod
    async def assert_partner_code_writable(
        cls,
        *,
        tenant_id: int,
        user: User,
        resource: str,
        partner_code: str | None,
        dimension: str,
    ) -> None:
        """外协/供应商等维度：在仅合作方数据范围下，写入的编码须在用户绑定列表中。"""
        if await cls._admin_bypass(user, tenant_id):
            return
        code = (partner_code or "").strip()
        if not code:
            return

        resource_key = normalize_resource_key(resource)
        role_uuids = await cls._load_role_uuids(user.id, tenant_id)
        policies = await cls._load_policies(tenant_id, role_uuids, resource_key)
        if not policies:
            return
        if any((p.scope_type or "").strip().lower() == DataScopeType.ALL for p in policies):
            return

        needs_partner_check = False
        for policy in policies:
            scope = (policy.scope_type or "").strip().lower()
            if scope == DataScopeType.CUSTOM:
                payload = policy.scope_payload if isinstance(policy.scope_payload, dict) else {}
                resolver = (payload.get("resolver") or "").strip().lower()
                if resolver in {"partner", "outsourced_unit", "supplier", "customer"}:
                    needs_partner_check = True
                    break

        if not needs_partner_check:
            return

        await UserDataScopeBindingService.assert_codes_allowed(
            tenant_id=tenant_id,
            user_id=user.id,
            dimension=dimension,
            codes=[code],
        )

    @classmethod
    async def filter_model_ids_visible(
        cls,
        model: Type[Model],
        ids: Iterable[int],
        *,
        tenant_id: int,
        user: User,
        resource: str,
    ) -> list[int]:
        id_list = [int(x) for x in ids if x is not None]
        if not id_list:
            return []
        qs = model.filter(id__in=id_list, tenant_id=tenant_id)
        if hasattr(model, "deleted_at"):
            qs = qs.filter(deleted_at__isnull=True)
        scoped = await cls.apply(qs, tenant_id=tenant_id, user=user, resource=resource)
        visible = await scoped.values_list("id", flat=True)
        return [int(x) for x in visible]
