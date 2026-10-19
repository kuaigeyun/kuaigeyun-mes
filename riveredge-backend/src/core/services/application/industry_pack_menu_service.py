"""
行业包菜单聚合：各行业模块菜单挂到 industry-pack 应用根下。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from loguru import logger

from core.config.industry_pack import (
    INDUSTRY_PACK_APP_CODE,
    is_industry_module_app_code,
    is_industry_pack_shell_code,
    manifest_to_industry_pack_menu_item,
    resolve_industry_pack_navigation_visible,
)
from core.services.application.application_service import ApplicationService
from core.utils.timezone_utils import now_utc
from infra.infrastructure.database.database import get_db_connection


class IndustryPackMenuService:
    @staticmethod
    async def get_shell_application(tenant_id: int) -> Optional[Dict[str, Any]]:
        return await ApplicationService.get_application_by_code(
            tenant_id=tenant_id,
            code=INDUSTRY_PACK_APP_CODE,
        )

    @staticmethod
    async def ensure_shell_installed(tenant_id: int) -> Dict[str, Any]:
        shell = await IndustryPackMenuService.get_shell_application(tenant_id)
        if not shell:
            raise RuntimeError(
                f"行业包容器 {INDUSTRY_PACK_APP_CODE} 未注册，请先扫描应用或执行迁移。"
            )
        if not shell.get("is_installed"):
            shell = await ApplicationService.install_application(
                tenant_id=tenant_id,
                uuid=str(shell["uuid"]),
                sync_menus_after_install=False,
            )
        return shell

    @staticmethod
    async def ensure_shell_active(tenant_id: int) -> Dict[str, Any]:
        shell = await IndustryPackMenuService.ensure_shell_installed(tenant_id)
        if shell.get("is_active"):
            return shell
        conn = await get_db_connection()
        try:
            await conn.execute(
                """
                UPDATE core_applications
                SET is_active = TRUE, updated_at = NOW()
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
                """,
                tenant_id,
                str(shell["uuid"]),
            )
        finally:
            await conn.close()
        shell["is_active"] = True
        return shell

    @staticmethod
    async def _has_installed_industry_module(tenant_id: int) -> bool:
        apps = await ApplicationService.list_applications(
            tenant_id=tenant_id,
            skip=0,
            limit=500,
            is_installed=True,
        )
        return any(
            is_industry_module_app_code(str(app.get("code") or "")) for app in apps
        )

    @staticmethod
    async def _has_active_industry_module(tenant_id: int) -> bool:
        apps = await ApplicationService.list_applications(
            tenant_id=tenant_id,
            skip=0,
            limit=500,
            is_installed=True,
            is_active=True,
        )
        return any(
            is_industry_module_app_code(str(app.get("code") or "")) for app in apps
        )

    @staticmethod
    def resolve_shell_navigation_visible(*, is_installed: bool, active_module_count: int) -> bool:
        return resolve_industry_pack_navigation_visible(
            is_installed=is_installed,
            active_module_count=active_module_count,
        )

    @staticmethod
    async def _sync_shell_active_flag(
        tenant_id: int,
        shell_uuid: str,
        *,
        is_active: bool,
    ) -> None:
        conn = await get_db_connection()
        try:
            await conn.execute(
                """
                UPDATE core_applications
                SET is_active = $3, updated_at = NOW()
                WHERE tenant_id = $1 AND uuid = $2 AND deleted_at IS NULL
                """,
                tenant_id,
                shell_uuid,
                is_active,
            )
        finally:
            await conn.close()

    @staticmethod
    async def reconcile_for_tenant(tenant_id: int) -> int:
        """按已安装/已启用的行业模块对齐 industry-pack 容器与侧栏菜单。

        同时补齐已启用模块仍缺失的替代 profile（包内后增扩展无需停用再启用）。
        """
        from core.services.application.industry_extension_runtime_service import (
            IndustryExtensionRuntimeService,
        )

        shell = await IndustryPackMenuService.get_shell_application(tenant_id)
        if not shell or not shell.get("is_installed"):
            return 0
        await IndustryPackMenuService.ensure_shell_installed(tenant_id)
        await IndustryExtensionRuntimeService.reconcile_profiles_for_tenant(tenant_id)
        return await IndustryPackMenuService.rebuild_pack_menus(tenant_id)

    @staticmethod
    async def sync_after_industry_module_lifecycle(
        tenant_id: int,
        *,
        activate_shell: bool = False,
        grant_module_code: Optional[str] = None,
    ) -> int:
        if activate_shell:
            await IndustryPackMenuService.ensure_shell_active(tenant_id)
        else:
            await IndustryPackMenuService.ensure_shell_installed(tenant_id)
        count = await IndustryPackMenuService.rebuild_pack_menus(tenant_id)
        if activate_shell and grant_module_code:
            await IndustryPackMenuService.grant_module_permissions_to_pack_roles(
                tenant_id, grant_module_code
            )
        return count

    @staticmethod
    async def grant_module_permissions_to_pack_roles(tenant_id: int, app_code: str) -> int:
        """将行业包入口 + 模块权限授予侧栏可见所需角色。

        目标角色：
        - 已持有 ``industry-pack:entry:read``；或
        - 持有 ``system:application:update``（能在应用中心启用模块）；或
        - 系统管理员预设角色

        仅授给「已有 pack entry」会在首次启用时无人可授，侧栏仍空。
        """
        if not is_industry_module_app_code(app_code):
            return 0
        try:
            from core.services.authorization.permission_sync_service import PermissionSyncService

            await PermissionSyncService.ensure_app_permissions(
                tenant_id=tenant_id, app_code=INDUSTRY_PACK_APP_CODE
            )
            await PermissionSyncService.ensure_app_permissions(
                tenant_id=tenant_id, app_code=app_code
            )
        except Exception as exc:
            logger.warning(
                f"租户 {tenant_id} 行业模块 {app_code} 授权前权限同步失败: {exc}"
            )

        manifest = ApplicationService._get_manifest_by_code(app_code) or {}
        codes = [
            str(c).strip()
            for c in (manifest.get("permissions") or [])
            if isinstance(c, str) and str(c).strip()
        ]
        if not codes:
            codes = [f"{app_code}:entry:read"]
        # 入口码必须一并授予，否则前端空壳过滤会整组隐藏
        pack_entry = f"{INDUSTRY_PACK_APP_CODE}:entry:read"
        if pack_entry not in codes:
            codes = [pack_entry, *codes]

        conn = await get_db_connection()
        try:
            role_rows = await conn.fetch(
                """
                SELECT DISTINCT r.id
                FROM core_roles r
                WHERE r.tenant_id = $1
                  AND r.deleted_at IS NULL
                  AND (
                    UPPER(COALESCE(r.code, '')) IN ('ADMIN', 'SYSTEM_ADMIN', 'SUPER_ADMIN')
                    OR COALESCE(r.name, '') = '系统管理员'
                    OR EXISTS (
                      SELECT 1
                      FROM core_role_permissions rp
                      JOIN core_permissions p ON p.id = rp.permission_id
                      WHERE rp.role_id = r.id
                        AND p.tenant_id = $1
                        AND p.deleted_at IS NULL
                        AND p.code IN (
                          'industry-pack:entry:read',
                          'system:application:update'
                        )
                    )
                  )
                """,
                tenant_id,
            )
            role_ids = [int(r["id"]) for r in role_rows]
            if not role_ids:
                logger.warning(
                    f"租户 {tenant_id} 行业模块 {app_code} 无目标角色可授（需行业包入口/"
                    f"应用更新权限或系统管理员角色）"
                )
                return 0

            granted = 0
            missing_codes: list[str] = []
            for code in codes:
                row = await conn.fetchrow(
                    """
                    SELECT id FROM core_permissions
                    WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL
                    LIMIT 1
                    """,
                    tenant_id,
                    code,
                )
                if not row:
                    missing_codes.append(code)
                    continue
                perm_id = int(row["id"])
                result = await conn.execute(
                    """
                    INSERT INTO core_role_permissions (role_id, permission_id, created_at)
                    SELECT r.id, $2, NOW()
                    FROM core_roles r
                    WHERE r.tenant_id = $1
                      AND r.deleted_at IS NULL
                      AND r.id = ANY($3::int[])
                      AND NOT EXISTS (
                        SELECT 1 FROM core_role_permissions rp2
                        WHERE rp2.role_id = r.id AND rp2.permission_id = $2
                      )
                    """,
                    tenant_id,
                    perm_id,
                    role_ids,
                )
                try:
                    granted += int(str(result).split()[-1])
                except Exception:
                    pass
            if missing_codes:
                logger.warning(
                    f"租户 {tenant_id} 行业模块 {app_code} 权限未入库，无法授予: {missing_codes}"
                )
            if granted:
                logger.info(
                    f"租户 {tenant_id} 行业模块 {app_code} 已向 {len(role_ids)} 个角色授予 "
                    f"{granted} 条权限"
                )
            return granted
        finally:
            await conn.close()

    @staticmethod
    async def _collect_module_menu_items(tenant_id: int) -> List[Dict[str, Any]]:
        apps = await ApplicationService.list_applications(
            tenant_id=tenant_id,
            skip=0,
            limit=500,
            is_installed=True,
            is_active=True,
        )
        items: List[Dict[str, Any]] = []
        for app in apps:
            code = str(app.get("code") or "")
            if not is_industry_module_app_code(code):
                continue
            manifest = ApplicationService._get_manifest_by_code(code) or {}
            item = manifest_to_industry_pack_menu_item(manifest)
            if not item:
                logger.warning(f"行业模块 {code} 缺少可挂载菜单（industry_pack_menu.children 或 menu_config），跳过")
                continue
            items.append(item)

        items.sort(key=lambda x: (int(x.get("sort_order") or 999), str(x.get("title") or "")))
        return items

    @staticmethod
    def _build_pack_menu_config(children: List[Dict[str, Any]]) -> Dict[str, Any]:
        manifest = ApplicationService._get_manifest_by_code(INDUSTRY_PACK_APP_CODE) or {}
        root = manifest.get("menu_config") if isinstance(manifest.get("menu_config"), dict) else {}
        return {
            "title": root.get("title") or "app.industry-pack.name",
            "icon": root.get("icon") or "layers",
            "path": root.get("path") or "/apps/industry-pack",
            "permission": root.get("permission") or "industry-pack:entry:read",
            "children": children,
        }

    @staticmethod
    async def _purge_module_owned_menus(tenant_id: int) -> None:
        """移除行业模块旧版独立应用根菜单（迁移至行业包后）。"""
        from core.models.menu import Menu

        apps = await ApplicationService.list_applications(
            tenant_id=tenant_id,
            skip=0,
            limit=500,
        )
        module_uuids = [
            str(a["uuid"])
            for a in apps
            if is_industry_module_app_code(str(a.get("code") or ""))
        ]
        if not module_uuids:
            return
        await Menu.filter(
            tenant_id=tenant_id,
            application_uuid__in=module_uuids,
            deleted_at__isnull=True,
        ).update(deleted_at=now_utc())

    @staticmethod
    async def rebuild_pack_menus(tenant_id: int) -> int:
        from core.config.industry_pack import is_industry_module_app_code
        from core.services.application.industry_extension_runtime_service import (
            IndustryExtensionRuntimeService,
        )
        from core.services.system.menu_service import MenuService
        from core.services.system.menu_takeover_service import MenuTakeoverService

        shell = await IndustryPackMenuService.get_shell_application(tenant_id)
        if not shell:
            logger.warning(f"租户 {tenant_id} 未注册 {INDUSTRY_PACK_APP_CODE}，跳过行业包菜单重建")
            return 0

        children = await IndustryPackMenuService._collect_module_menu_items(tenant_id)
        menu_config = IndustryPackMenuService._build_pack_menu_config(children)
        shell_uuid = str(shell["uuid"])
        should_show = IndustryPackMenuService.resolve_shell_navigation_visible(
            is_installed=bool(shell.get("is_installed")),
            active_module_count=len(children),
        )

        await IndustryPackMenuService._sync_shell_active_flag(
            tenant_id,
            shell_uuid,
            is_active=should_show,
        )
        shell["is_active"] = should_show

        await IndustryPackMenuService._purge_module_owned_menus(tenant_id)

        count = await MenuService.sync_menus_from_application_config(
            tenant_id=tenant_id,
            application_uuid=shell_uuid,
            menu_config=menu_config,
            is_active=should_show,
            preserve_existing_is_active=False,
            # 壳菜单重建频繁（模块开/关）；权限由 grant / 壳增量路径写入，避免全量 sync
            skip_permission_sync=True,
        )
        try:
            from core.services.authorization.permission_sync_service import PermissionSyncService

            await PermissionSyncService.ensure_app_permissions(
                tenant_id=tenant_id, app_code=INDUSTRY_PACK_APP_CODE
            )
        except Exception as exc:
            logger.warning(
                f"租户 {tenant_id} 行业包壳权限增量同步失败: {exc}"
            )

        # pack_menu 从 true→false 后须交还宿主侧栏（如返工单回快制造）
        from core.services.application.application_service import ApplicationService

        apps = await ApplicationService.list_applications(
            tenant_id=tenant_id,
            skip=0,
            limit=500,
            is_installed=True,
            is_active=True,
        )
        for app in apps:
            module_code = str(app.get("code") or "")
            if not is_industry_module_app_code(module_code):
                continue
            decls = IndustryExtensionRuntimeService.declarations_for_module(module_code)
            replace_decls = [d for d in decls if d.kind == "replace"]
            await MenuTakeoverService.apply_extension_pack_menu(
                tenant_id, module_code, replace_decls
            )

        await MenuService._clear_menu_cache(tenant_id)
        logger.info(
            f"租户 {tenant_id} 行业包菜单已重建，子模块 {len(children)} 个，同步 {count} 项"
        )
        return count

    @staticmethod
    def should_skip_direct_menu_sync(app_code: str | None) -> bool:
        return is_industry_module_app_code(app_code) or is_industry_pack_shell_code(app_code)
