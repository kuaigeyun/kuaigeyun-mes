"""角色功能权限矩阵：服务端构建菜单树 + 按 code 授权。"""

from __future__ import annotations

from typing import Dict, List, Optional, Set

from core.config.permission_action_spec import canonical_action
from core.config.permission_contract import display_label_for_permission_code
from core.models.permission import Permission, PermissionType
from core.models.role import Role
from core.models.role_permission import RolePermission
from core.schemas.menu import MenuTreeResponse
from core.schemas.role_function_grants import (
    FunctionGrantActionSchema,
    FunctionGrantMenuNodeSchema,
    FunctionGrantStatsSchema,
    RoleFunctionGrantsResponse,
)
from core.services.authorization.menu_resource_resolver import (
    REVIEW_ACTIONS,
    normalize_permission_code,
    parse_permission_code,
    permission_matches_menu_resource,
    resolve_menu_target_resource,
    app_code_from_menu,
)
from core.services.authorization.permission_registry_service import PermissionRegistryService
from core.services.authorization.permission_version_service import PermissionVersionService
from core.services.authorization.role_service import RoleService
from core.services.system.menu_service import MenuService
from infra.exceptions.exceptions import AuthorizationError, NotFoundError, ValidationError
from core.utils.timezone_utils import now_utc


_MANIFEST_ORDER_FALLBACK = 10_000_000


class RolePermissionMatrixService:
    @staticmethod
    def _manifest_order_for_codes(codes: List[str], code_order: Dict[str, int]) -> int:
        if not codes:
            return _MANIFEST_ORDER_FALLBACK
        return min(code_order.get(c, _MANIFEST_ORDER_FALLBACK) for c in codes)

    @staticmethod
    async def _load_function_permission_pool(tenant_id: int) -> List[Permission]:
        desired = await PermissionRegistryService.collect_definitions(tenant_id=tenant_id)
        desired_codes = sorted(desired.keys())
        if not desired_codes:
            return []
        return await Permission.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            deprecated_at__isnull=True,
            permission_type=PermissionType.FUNCTION,
            code__in=desired_codes,
        ).order_by("code", "id")

    @staticmethod
    async def _granted_function_codes_for_role(
        tenant_id: int,
        role: Role,
        pool: List[Permission],
    ) -> Set[str]:
        from core.models.role_permission import RolePermission

        role_permissions = await RolePermission.filter(role_id=role.id).all()
        permission_ids = [rp.permission_id for rp in role_permissions]
        if permission_ids:
            perms = await Permission.filter(
                id__in=permission_ids,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).all()
        elif RoleService._is_admin_system_role(role):
            perms = pool
        else:
            perms = []

        codes: Set[str] = set()
        for p in perms:
            if (p.permission_type or PermissionType.FUNCTION) != PermissionType.FUNCTION:
                continue
            norm = normalize_permission_code(p.code or "")
            if norm:
                codes.add(norm)
        return codes

    @staticmethod
    def _permissions_for_menu_node(
        menu: MenuTreeResponse,
        pool_by_code: Dict[str, Permission],
        pool: List[Permission],
    ) -> List[Permission]:
        target = resolve_menu_target_resource(
            permission_code=menu.permission_code,
            path=menu.path,
        )
        app = app_code_from_menu(permission_code=menu.permission_code, path=menu.path)
        if not target or not app:
            return []

        matched: List[Permission] = []
        seen: Set[str] = set()
        for p in pool:
            if not p.code or p.uuid in seen:
                continue
            if permission_matches_menu_resource(p.code, target, app):
                seen.add(p.uuid)
                matched.append(p)
        matched.sort(key=lambda x: x.code or "")
        return matched

    @staticmethod
    def _build_action_schemas(
        matched: List[Permission],
        granted_codes: Set[str],
        code_order: Dict[str, int],
    ) -> List[FunctionGrantActionSchema]:
        preferred: Dict[str, Permission] = {}
        for p in matched:
            parsed = parse_permission_code(p.code or "")
            action_key = canonical_action(parsed[2] if parsed else (p.action or ""))
            if action_key not in preferred:
                preferred[action_key] = p

        review_by_resource: Dict[str, List[Permission]] = {}
        for p in list(preferred.values()):
            parsed = parse_permission_code(p.code or "")
            if not parsed:
                continue
            _app, resource, action = parsed
            if action not in REVIEW_ACTIONS:
                continue
            review_by_resource.setdefault(resource, []).append(p)

        merged_review_codes: Set[str] = set()
        actions_out: List[FunctionGrantActionSchema] = []

        for resource, perms in review_by_resource.items():
            if len(perms) < 2:
                continue
            codes = [normalize_permission_code(p.code or "") for p in perms]
            codes = [c for c in codes if c]
            if len(codes) < 2:
                continue
            merged_review_codes.update(codes)
            granted = all(c in granted_codes for c in codes)
            actions_out.append(
                FunctionGrantActionSchema(
                    action="audit",
                    code=codes[0],
                    label=display_label_for_permission_code(codes[0]) or "审核",
                    uuid=perms[0].uuid,
                    granted=granted,
                    merged_codes=codes,
                )
            )

        for action_key, p in preferred.items():
            norm = normalize_permission_code(p.code or "")
            if not norm or norm in merged_review_codes:
                continue
            if action_key == "display":
                continue
            actions_out.append(
                FunctionGrantActionSchema(
                    action=action_key,
                    code=norm,
                    label=display_label_for_permission_code(norm) or action_key,
                    uuid=p.uuid,
                    granted=norm in granted_codes,
                )
            )
        actions_out.sort(
            key=lambda a: (
                RolePermissionMatrixService._manifest_order_for_codes(
                    list(a.merged_codes or []) or ([a.code] if a.code else []),
                    code_order,
                ),
                a.code or "",
            ),
        )
        return actions_out

    @staticmethod
    def _build_menu_tree_nodes(
        menus: List[MenuTreeResponse],
        pool: List[Permission],
        pool_by_code: Dict[str, Permission],
        granted_codes: Set[str],
        visible_granted: Set[str],
        code_order: Dict[str, int],
    ) -> List[FunctionGrantMenuNodeSchema]:
        nodes: List[FunctionGrantMenuNodeSchema] = []
        for menu in sorted(menus, key=lambda m: m.sort_order or 0):
            children = RolePermissionMatrixService._build_menu_tree_nodes(
                list(menu.children or []),
                pool,
                pool_by_code,
                granted_codes,
                visible_granted,
                code_order,
            )
            matched = RolePermissionMatrixService._permissions_for_menu_node(menu, pool_by_code, pool)
            actions = RolePermissionMatrixService._build_action_schemas(
                matched, granted_codes, code_order
            )
            for a in actions:
                if a.granted:
                    visible_granted.add(a.code)
                    if a.merged_codes:
                        visible_granted.update(a.merged_codes)

            resource = resolve_menu_target_resource(
                permission_code=menu.permission_code,
                path=menu.path,
            )
            if not children and not actions:
                continue
            nodes.append(
                FunctionGrantMenuNodeSchema(
                    menu_uuid=str(menu.uuid),
                    title=menu.name or "",
                    path=menu.path,
                    resource=resource,
                    actions=actions,
                    children=children,
                )
            )
        return nodes

    @staticmethod
    async def get_function_grants(tenant_id: int, role_uuid: str) -> RoleFunctionGrantsResponse:
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not role:
            raise NotFoundError("角色", role_uuid)

        pool = await RolePermissionMatrixService._load_function_permission_pool(tenant_id)
        pool_by_code = {
            normalize_permission_code(p.code or ""): p for p in pool if p.code
        }
        granted_codes = await RolePermissionMatrixService._granted_function_codes_for_role(
            tenant_id, role, pool
        )
        all_pool_codes = set(pool_by_code.keys())
        granted_codes = granted_codes & all_pool_codes

        menus = await MenuService.get_menu_tree(
            tenant_id=tenant_id,
            is_active=True,
            use_cache=True,
            cache_key_suffix="",
        )
        visible_granted: Set[str] = set()
        code_order = await PermissionRegistryService.manifest_permission_order(tenant_id)
        tree = RolePermissionMatrixService._build_menu_tree_nodes(
            menus, pool, pool_by_code, granted_codes, visible_granted, code_order
        )

        all_pool_codes = set(pool_by_code.keys())
        granted_list = sorted(granted_codes)
        stats = FunctionGrantStatsSchema(
            total_function_codes=len(all_pool_codes),
            granted_function_codes=len(granted_codes),
            granted_visible_on_tree=len(visible_granted),
            granted_not_on_tree=max(0, len(granted_codes - visible_granted)),
        )

        return RoleFunctionGrantsResponse(
            role_uuid=role_uuid,
            granted_codes=granted_list,
            tree=tree,
            stats=stats,
        )

    @staticmethod
    async def replace_function_grants(
        tenant_id: int,
        role_uuid: str,
        codes: List[str],
        current_user_id: int,
    ) -> RoleFunctionGrantsResponse:
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if not role:
            raise NotFoundError("角色", role_uuid)
        if role.is_system and not RoleService._is_admin_system_role(role):
            raise AuthorizationError("系统角色不可修改权限")

        pool = await RolePermissionMatrixService._load_function_permission_pool(tenant_id)
        pool_by_code = {
            normalize_permission_code(p.code or ""): p for p in pool if p.code
        }

        pool_keys = set(pool_by_code.keys())
        current_granted = await RolePermissionMatrixService._granted_function_codes_for_role(
            tenant_id, role, pool
        )

        normalized_in: Set[str] = set()
        for raw in codes or []:
            norm = normalize_permission_code(raw)
            if norm:
                normalized_in.add(norm)

        unknown_in_request = normalized_in - pool_keys
        invalid_new = sorted(unknown_in_request - current_granted)
        if invalid_new:
            sample = invalid_new[:5]
            suffix = "..." if len(invalid_new) > 5 else ""
            raise ValidationError(
                f"部分功能权限 code 不存在或未同步: {sample}{suffix}"
            )
        normalized_in = normalized_in & pool_keys

        desired_function_ids: Set[int] = {pool_by_code[c].id for c in normalized_in}

        role_permissions = await RolePermission.filter(role_id=role.id).all()
        current_ids = {rp.permission_id for rp in role_permissions}
        if current_ids:
            current_perms = await Permission.filter(
                id__in=list(current_ids),
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).all()
        else:
            current_perms = []

        non_function_ids: Set[int] = set()
        current_function_ids: Set[int] = set()
        for p in current_perms:
            if (p.permission_type or PermissionType.FUNCTION) == PermissionType.FUNCTION:
                current_function_ids.add(p.id)
            else:
                non_function_ids.add(p.id)

        new_all_ids = non_function_ids | desired_function_ids
        to_add = new_all_ids - current_ids
        to_remove = current_ids - new_all_ids

        if to_add:
            await RolePermission.bulk_create(
                [
                    RolePermission(
                        role_id=role.id,
                        permission_id=pid,
                        created_at=now_utc(),
                    )
                    for pid in to_add
                ],
                ignore_conflicts=True,
            )
        if to_remove:
            await RolePermission.filter(
                role_id=role.id,
                permission_id__in=list(to_remove),
            ).delete()

        if desired_function_ids:
            assigned_codes = [
                pool_by_code[c].code
                for c in normalized_in
                if c in pool_by_code and pool_by_code[c].code
            ]
            if assigned_codes:
                await MenuService.activate_menus_for_permission_codes(
                    tenant_id=tenant_id,
                    permission_codes=assigned_codes,
                )

        await PermissionVersionService.bump(tenant_id=tenant_id, user_id=None)
        await RoleService._bump_role_users_permission_version(
            role_id=role.id, tenant_id=tenant_id
        )

        return await RolePermissionMatrixService.get_function_grants(tenant_id, role_uuid)

    @staticmethod
    def _action_codes_from_schema(action: FunctionGrantActionSchema) -> List[str]:
        merged = list(action.merged_codes or [])
        if merged:
            return [normalize_permission_code(c) for c in merged if c]
        if action.code:
            return [normalize_permission_code(action.code)]
        return []

    @staticmethod
    def _action_granted_on_tree(
        action: FunctionGrantActionSchema, granted_codes: Set[str]
    ) -> bool:
        codes = RolePermissionMatrixService._action_codes_from_schema(action)
        return bool(codes) and all(c in granted_codes for c in codes)

    @staticmethod
    def collect_granted_resource_keys_from_tree(
        tree: List[FunctionGrantMenuNodeSchema],
        granted_codes: Set[str],
    ) -> Set[str]:
        """功能权限矩阵树中已勾选操作对应的 app:resource（数据/字段权限唯一范围）。"""
        from core.services.authorization.menu_resource_resolver import (
            is_generic_menu_permission_code,
            parse_permission_code,
        )

        keys: Set[str] = set()
        granted = {normalize_permission_code(c) for c in granted_codes if c}

        def walk(nodes: List[FunctionGrantMenuNodeSchema]) -> None:
            for node in nodes:
                actions = list(node.actions or [])
                if any(
                    RolePermissionMatrixService._action_granted_on_tree(a, granted)
                    for a in actions
                ):
                    for action in actions:
                        if not RolePermissionMatrixService._action_granted_on_tree(
                            action, granted
                        ):
                            continue
                        for code in RolePermissionMatrixService._action_codes_from_schema(
                            action
                        ):
                            if not code or is_generic_menu_permission_code(code):
                                continue
                            parsed = parse_permission_code(code)
                            if not parsed:
                                continue
                            app, resource, _action = parsed
                            if app and resource:
                                keys.add(f"{app}:{resource}".lower())
                if node.children:
                    walk(list(node.children))

        walk(tree)
        return keys
