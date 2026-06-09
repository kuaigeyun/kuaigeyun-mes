"""
统一访问控制服务（PDP）

顺序：
1) RBAC
2) ABAC（策略）
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from tortoise.expressions import Q

from core.models.access_policy import AccessPolicy, AccessPolicyEffect
from core.models.policy_binding import PolicyBinding, PolicySubjectType
from core.services.authorization.user_permission_service import UserPermissionService


@dataclass
class AccessDecision:
    allowed: bool
    reason: str
    required: list[str]
    matched_policy: str | None = None


class AccessControlService:
    @staticmethod
    def build_permission_code(resource: str, action: str) -> str:
        left = (resource or "").strip().lower()
        right = (action or "").strip().lower()
        return f"{left}:{right}" if left and right else f"{left}:{action}"

    @staticmethod
    async def check_access(
        *,
        user_id: int,
        tenant_id: int,
        resource: str,
        action: str,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
        check_abac: bool = True,
        require_all: bool = False,
        required_permissions: list[str] | None = None,
        env: dict[str, Any] | None = None,
    ) -> AccessDecision:
        if await UserPermissionService.is_admin_bypass_flags(
            user_id,
            tenant_id,
            is_infra_admin=is_infra_admin,
            is_tenant_admin=is_tenant_admin,
        ):
            return AccessDecision(True, "admin_bypass", [])

        needed = required_permissions or [AccessControlService.build_permission_code(resource, action)]

        if require_all:
            has_rbac = await UserPermissionService.has_all_permissions(
                user_id=user_id,
                tenant_id=tenant_id,
                permission_codes=needed,
            )
        else:
            has_rbac = await UserPermissionService.has_any_permission(
                user_id=user_id,
                tenant_id=tenant_id,
                permission_codes=needed,
            )
        if not has_rbac:
            return AccessDecision(False, "rbac_denied", needed)

        if not check_abac:
            return AccessDecision(True, "rbac_allowed", needed)

        abac_result = await AccessControlService._evaluate_policies(
            user_id=user_id,
            tenant_id=tenant_id,
            resource=resource,
            action=action,
            env=env or {},
        )
        if abac_result is not None:
            return abac_result

        return AccessDecision(True, "rbac_abac_allowed", needed)

    @staticmethod
    async def _evaluate_policies(
        *,
        user_id: int,
        tenant_id: int,
        resource: str,
        action: str,
        env: dict[str, Any],
    ) -> AccessDecision | None:
        # 获取用户角色ID
        from core.models.user_role import UserRole

        user_roles = await UserRole.filter(user_id=user_id).all()
        role_ids = [ur.role_id for ur in user_roles]

        # 查询绑定策略
        binding_query = Q(subject_type=PolicySubjectType.USER, subject_id=user_id)
        if role_ids:
            binding_query = binding_query | Q(
                subject_type=PolicySubjectType.ROLE,
                subject_id__in=role_ids,
            )
        bindings = await PolicyBinding.filter(binding_query).all()
        if not bindings:
            return None

        policy_ids = [b.policy_id for b in bindings]
        policies = await AccessPolicy.filter(
            tenant_id=tenant_id,
            id__in=policy_ids,
            enabled=True,
            deleted_at__isnull=True,
            target_resource=resource,
            target_action=action,
        ).order_by("priority", "id").all()
        if not policies:
            return None

        for policy in policies:
            if AccessControlService._condition_match(policy.condition_expr or {}, env):
                if policy.effect == AccessPolicyEffect.DENY:
                    return AccessDecision(
                        allowed=False,
                        reason="abac_denied",
                        required=[AccessControlService.build_permission_code(resource, action)],
                        matched_policy=policy.name,
                    )
                return AccessDecision(
                    allowed=True,
                    reason="abac_allowed",
                    required=[AccessControlService.build_permission_code(resource, action)],
                    matched_policy=policy.name,
                )
        return None

    @staticmethod
    def _condition_match(condition_expr: dict[str, Any], env: dict[str, Any]) -> bool:
        """
        轻量条件匹配：
        - all: {k:v} 所有键值必须匹配
        - any: {k:[v1,v2]} 任一匹配
        """
        if not condition_expr:
            return True

        all_cond = condition_expr.get("all") or {}
        for key, value in all_cond.items():
            if env.get(key) != value:
                return False

        any_cond = condition_expr.get("any") or {}
        for key, values in any_cond.items():
            if not isinstance(values, list):
                return False
            if env.get(key) not in values:
                return False

        return True

    @staticmethod
    async def check_reference_display(
        *,
        user_id: int,
        tenant_id: int,
        resource_key: str,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
        host_resource: str | None = None,
    ) -> AccessDecision:
        """
        引用展示鉴权：read/display 显式授予，或宿主 module_references 隐式授予。
        """
        if await UserPermissionService.is_admin_bypass_flags(
            user_id,
            tenant_id,
            is_infra_admin=is_infra_admin,
            is_tenant_admin=is_tenant_admin,
        ):
            return AccessDecision(True, "admin_bypass", [])

        from core.services.authorization.reference_registry_service import ReferenceRegistryService

        key = (resource_key or "").strip().lower()
        registry = ReferenceRegistryService.build()
        defn = registry.resources.get(key)
        if defn is None:
            return AccessDecision(False, "unknown_reference_resource", [key])
        if defn.sensitive:
            return AccessDecision(
                False,
                "sensitive_reference_denied",
                [f"{defn.permission_prefix}:read"],
            )

        explicit = [
            f"{defn.permission_prefix}:read",
            f"{defn.permission_prefix}:display",
        ]
        user_perms = await UserPermissionService.get_user_permissions(
            user_id=user_id,
            tenant_id=tenant_id,
        )
        if any(code in user_perms for code in explicit):
            return AccessDecision(True, "explicit_read_or_display", explicit)

        implicit_hosts = registry.implicit_display_by_target.get(key, set())
        if host_resource:
            host = host_resource.strip().lower()
            host_codes = {
                AccessControlService.build_permission_code(host, action)
                for action in ("read", "create", "update")
            }
            implicit_hosts = implicit_hosts & host_codes

        matched = implicit_hosts & user_perms
        if matched:
            return AccessDecision(True, "implicit_host_grant", sorted(matched))

        required = explicit + sorted(implicit_hosts)[:5]
        return AccessDecision(False, "reference_display_denied", required)
