"""
菜单接管服务

启用 consumer 应用时抑制 source 应用对应菜单；禁用时恢复（仅恢复由接管抑制的项）。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from loguru import logger

from core.config.industry_extension_registry import IndustryExtensionDecl
from core.config.menu_takeover import (
    META_DOCUMENT_REPLACED_BY,
    META_SUPPRESSED_BY_DEDICATED_SHELL,
    META_SUPPRESSED_BY_INDUSTRY_PACK,
    META_SUPPRESSED_BY_TAKEOVER,
    MENU_TAKEOVER_RULES,
    MenuTakeoverRule,
    merge_menu_meta_for_sync,
    path_matches_takeover_prefix,
)
from core.models.application import Application
from core.models.menu import Menu


class MenuTakeoverService:
    @staticmethod
    def _rule_for_consumer(consumer_app_code: str) -> Optional[MenuTakeoverRule]:
        return MENU_TAKEOVER_RULES.get(consumer_app_code)

    @staticmethod
    async def _get_app_uuid(tenant_id: int, app_code: str) -> Optional[str]:
        app = await Application.filter(
            tenant_id=tenant_id, code=app_code, deleted_at__isnull=True
        ).first()
        return str(app.uuid) if app else None

    @staticmethod
    async def is_consumer_active(tenant_id: int, consumer_app_code: str) -> bool:
        app = await Application.filter(
            tenant_id=tenant_id,
            code=consumer_app_code,
            deleted_at__isnull=True,
            is_installed=True,
            is_active=True,
        ).first()
        return app is not None

    @staticmethod
    async def is_consumer_effective(tenant_id: int, consumer_app_code: str) -> bool:
        """接管是否应生效：只认库内 consumer 已安装且已启用。各节点磁盘包不得改同一张 core_menus。"""
        return await MenuTakeoverService.is_consumer_active(tenant_id, consumer_app_code)

    @staticmethod
    async def reconcile_takeovers_for_tenant(tenant_id: int) -> int:
        """
        按当前 consumer 有效状态对齐 source 菜单抑制/恢复（修复禁用快研发后主数据工艺仍不可见）。
        """
        from core.services.system.menu_service import MenuService

        total = 0
        for consumer_code in MENU_TAKEOVER_RULES:
            if await MenuTakeoverService.is_consumer_effective(tenant_id, consumer_code):
                total += await MenuTakeoverService.apply_takeover(tenant_id, consumer_code)
            else:
                total += await MenuTakeoverService.revert_takeover(tenant_id, consumer_code)
        if total:
            await MenuService._clear_menu_cache(tenant_id)
        return total

    @staticmethod
    async def _dedicated_shell_may_apply(tenant_id: int, consumer_app_code: str) -> bool:
        """定制壳侧栏抑制：租户须已绑定该专用应用且应用已启用。"""
        from core.services.application.application_dedicated_binding_service import (
            ApplicationDedicatedBindingService,
        )
        from core.services.application.enabled_apps import manifest_hides_required_app_menus

        code = str(consumer_app_code or "").strip()
        if not code or not manifest_hides_required_app_menus(code):
            return False
        if not await ApplicationDedicatedBindingService.is_dedicated_shell_bound_for_tenant(
            tenant_id, code
        ):
            return False
        return await MenuTakeoverService.is_consumer_active(tenant_id, code)

    @staticmethod
    async def apply_takeover(tenant_id: int, consumer_app_code: str) -> int:
        rule = MenuTakeoverService._rule_for_consumer(consumer_app_code)
        if not rule:
            return 0
        source_uuid = await MenuTakeoverService._get_app_uuid(tenant_id, rule.source_app_code)
        if not source_uuid:
            logger.warning(
                "menu_takeover_skip source_app_missing tenant={} consumer={} source={}",
                tenant_id,
                consumer_app_code,
                rule.source_app_code,
            )
            return 0

        menus = await Menu.filter(
            tenant_id=tenant_id,
            application_uuid=source_uuid,
            deleted_at__isnull=True,
        ).all()
        updated = 0
        for menu in menus:
            if not path_matches_takeover_prefix(menu.path, rule):
                continue
            meta: Dict[str, Any] = dict(menu.meta or {})
            if not menu.is_active and meta.get(META_SUPPRESSED_BY_TAKEOVER) == consumer_app_code:
                continue
            if menu.is_active or meta.get(META_SUPPRESSED_BY_TAKEOVER) != consumer_app_code:
                meta[META_SUPPRESSED_BY_TAKEOVER] = consumer_app_code
                menu.meta = meta
                menu.is_active = False
                await menu.save(update_fields=["meta", "is_active", "updated_at"])
                updated += 1
        if updated:
            logger.info(
                "menu_takeover_applied tenant={} consumer={} suppressed={}",
                tenant_id,
                consumer_app_code,
                updated,
            )
        return updated

    @staticmethod
    async def revert_takeover(tenant_id: int, consumer_app_code: str) -> int:
        rule = MenuTakeoverService._rule_for_consumer(consumer_app_code)
        if not rule:
            return 0
        source_uuid = await MenuTakeoverService._get_app_uuid(tenant_id, rule.source_app_code)
        if not source_uuid:
            return 0

        menus = await Menu.filter(
            tenant_id=tenant_id,
            application_uuid=source_uuid,
            deleted_at__isnull=True,
        ).all()
        restored = 0
        for menu in menus:
            if not path_matches_takeover_prefix(menu.path, rule):
                continue
            meta: Dict[str, Any] = dict(menu.meta or {})
            tagged = meta.get(META_SUPPRESSED_BY_TAKEOVER) == consumer_app_code
            # 菜单同步曾覆盖 meta 时，接管标记丢失但 is_active 仍为 False，禁用时仍须交还
            orphaned_suppression = not menu.is_active and not tagged
            if not tagged and not orphaned_suppression:
                continue
            meta.pop(META_SUPPRESSED_BY_TAKEOVER, None)
            still_suppressed = bool(
                meta.get(META_SUPPRESSED_BY_INDUSTRY_PACK)
                or meta.get(META_SUPPRESSED_BY_DEDICATED_SHELL)
            )
            menu.meta = meta or None
            if not still_suppressed:
                menu.is_active = True
            await menu.save(update_fields=["meta", "is_active", "updated_at"])
            restored += 1
        if restored:
            logger.info(
                "menu_takeover_reverted tenant={} consumer={} restored={}",
                tenant_id,
                consumer_app_code,
                restored,
            )
        return restored

    @staticmethod
    async def reapply_after_source_menu_sync(tenant_id: int, source_app_code: str) -> None:
        """source 应用菜单同步后，若 consumer 仍启用则再次抑制被接管的菜单。"""
        for rule in MENU_TAKEOVER_RULES.values():
            if rule.source_app_code != source_app_code:
                continue
            if await MenuTakeoverService.is_consumer_effective(
                tenant_id, rule.consumer_app_code
            ):
                await MenuTakeoverService.apply_takeover(tenant_id, rule.consumer_app_code)
        await MenuTakeoverService.reapply_dedicated_shell_hides_for_source(
            tenant_id, source_app_code
        )
        from core.services.application.enabled_apps import manifest_hides_required_app_menus

        if await MenuTakeoverService._dedicated_shell_may_apply(tenant_id, source_app_code):
            await MenuTakeoverService.apply_dedicated_shell_hide(tenant_id, source_app_code)

    @staticmethod
    async def apply_dedicated_shell_hide(tenant_id: int, consumer_app_code: str) -> int:
        """按 application_uuid 抑制依赖应用、行业包壳，以及同租户其它已安装业务应用整棵侧栏。"""
        from core.services.application.enabled_apps import (
            dedicated_shell_hidden_app_codes,
            union_dedicated_shell_hide_codes,
        )

        if not await MenuTakeoverService._dedicated_shell_may_apply(tenant_id, consumer_app_code):
            return 0
        installed = await Application.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_installed=True,
        ).all()
        hide_codes = union_dedicated_shell_hide_codes(
            required_hidden=dedicated_shell_hidden_app_codes(consumer_app_code),
            installed_codes=[str(app.code or "") for app in installed if not app.is_system],
            consumer_code=consumer_app_code,
            system_codes={str(app.code or "") for app in installed if app.is_system},
        )
        updated = 0
        for source_code in hide_codes:
            source_uuid = await MenuTakeoverService._get_app_uuid(tenant_id, source_code)
            if not source_uuid:
                logger.warning(
                    "dedicated_shell_hide_skip source_app_missing tenant={} consumer={} source={}",
                    tenant_id,
                    consumer_app_code,
                    source_code,
                )
                continue
            menus = await Menu.filter(
                tenant_id=tenant_id,
                application_uuid=source_uuid,
                deleted_at__isnull=True,
            ).all()
            for menu in menus:
                meta: Dict[str, Any] = dict(menu.meta or {})
                if (
                    not menu.is_active
                    and meta.get(META_SUPPRESSED_BY_DEDICATED_SHELL) == consumer_app_code
                ):
                    continue
                meta[META_SUPPRESSED_BY_DEDICATED_SHELL] = consumer_app_code
                menu.meta = meta
                menu.is_active = False
                await menu.save(update_fields=["meta", "is_active", "updated_at"])
                updated += 1
        if updated:
            logger.info(
                "dedicated_shell_hide_applied tenant={} consumer={} suppressed={}",
                tenant_id,
                consumer_app_code,
                updated,
            )
        return updated

    @staticmethod
    async def ensure_consumer_menus_active(tenant_id: int, consumer_app_code: str) -> int:
        """定制壳自身菜单须保持可见；批量 sync 后强制启用 application_uuid 归属的菜单树。"""
        consumer_uuid = await MenuTakeoverService._get_app_uuid(tenant_id, consumer_app_code)
        if not consumer_uuid:
            return 0
        menus = await Menu.filter(
            tenant_id=tenant_id,
            application_uuid=consumer_uuid,
            deleted_at__isnull=True,
        ).all()
        restored = 0
        for menu in menus:
            meta: Dict[str, Any] = dict(menu.meta or {})
            changed = False
            if meta.get(META_SUPPRESSED_BY_DEDICATED_SHELL) == consumer_app_code:
                meta.pop(META_SUPPRESSED_BY_DEDICATED_SHELL, None)
                menu.meta = meta or None
                changed = True
            if not menu.is_active:
                menu.is_active = True
                changed = True
            if changed:
                await menu.save(update_fields=["meta", "is_active", "updated_at"])
                restored += 1
        if restored:
            logger.info(
                "dedicated_shell_consumer_menus_active tenant={} consumer={} restored={}",
                tenant_id,
                consumer_app_code,
                restored,
            )
        return restored

    @staticmethod
    async def finalize_dedicated_shell_menus_after_batch_sync(tenant_id: int) -> None:
        """全量菜单同步收尾：已绑定且启用的定制壳抑制宿主；未绑定租户恢复误隐藏的侧栏。"""
        from core.services.application.application_dedicated_binding_service import (
            ApplicationDedicatedBindingService,
        )
        from core.services.application.enabled_apps import manifest_hides_required_app_menus

        consumers = await Application.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_installed=True,
        ).all()
        for app in consumers:
            consumer_code = str(app.code or "")
            if not consumer_code or not manifest_hides_required_app_menus(consumer_code):
                continue
            if await MenuTakeoverService._dedicated_shell_may_apply(tenant_id, consumer_code):
                await MenuTakeoverService.apply_dedicated_shell_hide(tenant_id, consumer_code)
                await MenuTakeoverService.ensure_consumer_menus_active(tenant_id, consumer_code)
            else:
                await MenuTakeoverService.revert_dedicated_shell_hide(tenant_id, consumer_code)

    @staticmethod
    async def revert_dedicated_shell_hide(tenant_id: int, consumer_app_code: str) -> int:
        """恢复由该定制壳抑制的菜单；仍被 1:1 接管或行业包聚合的保持隐藏。"""
        menus = await Menu.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).all()
        restored = 0
        for menu in menus:
            meta: Dict[str, Any] = dict(menu.meta or {})
            if meta.get(META_SUPPRESSED_BY_DEDICATED_SHELL) != consumer_app_code:
                continue
            meta.pop(META_SUPPRESSED_BY_DEDICATED_SHELL, None)
            still_suppressed = bool(
                meta.get(META_SUPPRESSED_BY_TAKEOVER)
                or meta.get(META_SUPPRESSED_BY_INDUSTRY_PACK)
            )
            menu.meta = meta or None
            if not still_suppressed:
                menu.is_active = True
            await menu.save(update_fields=["meta", "is_active", "updated_at"])
            restored += 1
        if restored:
            logger.info(
                "dedicated_shell_hide_reverted tenant={} consumer={} restored={}",
                tenant_id,
                consumer_app_code,
                restored,
            )
        return restored

    @staticmethod
    async def reapply_dedicated_shell_hides_for_source(
        tenant_id: int, source_app_code: str
    ) -> None:
        """某应用菜单同步后，对仍启用且声明隐藏该应用的定制壳重新抑制。"""
        from core.services.application.enabled_apps import manifest_hides_required_app_menus

        consumers = await Application.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_installed=True,
            is_active=True,
        ).all()
        for app in consumers:
            consumer_code = str(app.code or "")
            if consumer_code == source_app_code:
                continue
            if not manifest_hides_required_app_menus(consumer_code):
                continue
            if await MenuTakeoverService._dedicated_shell_may_apply(tenant_id, consumer_code):
                await MenuTakeoverService.apply_dedicated_shell_hide(tenant_id, consumer_code)

    @staticmethod
    async def sync_for_application_lifecycle(
        tenant_id: int,
        app_code: str,
        *,
        enabled: bool,
    ) -> None:
        from core.services.application.enabled_apps import manifest_hides_required_app_menus
        from core.services.system.menu_service import MenuService

        has_rule = app_code in MENU_TAKEOVER_RULES
        hides_required = manifest_hides_required_app_menus(app_code)
        if not has_rule and not hides_required:
            return

        if enabled:
            if has_rule and await MenuTakeoverService.is_consumer_effective(tenant_id, app_code):
                await MenuTakeoverService.apply_takeover(tenant_id, app_code)
            elif has_rule:
                await MenuTakeoverService.revert_takeover(tenant_id, app_code)
            if hides_required:
                if await MenuTakeoverService._dedicated_shell_may_apply(tenant_id, app_code):
                    await MenuTakeoverService.apply_dedicated_shell_hide(tenant_id, app_code)
                else:
                    await MenuTakeoverService.revert_dedicated_shell_hide(tenant_id, app_code)
        else:
            if hides_required:
                await MenuTakeoverService.revert_dedicated_shell_hide(tenant_id, app_code)
            if has_rule:
                await MenuTakeoverService.revert_takeover(tenant_id, app_code)
        await MenuService._clear_menu_cache(tenant_id)

    @staticmethod
    def _path_matches_menu_target(path: str | None, target: str) -> bool:
        normalized = (path or "").strip()
        if not normalized or not target:
            return False
        return normalized == target or normalized.startswith(f"{target}/")

    @staticmethod
    async def apply_extension_pack_menu(
        tenant_id: int,
        module_app_code: str,
        decls: List[IndustryExtensionDecl],
    ) -> int:
        """按当前 pack_menu 同步宿主侧栏：应聚合的隐藏，不再聚合（含 pack_menu 改 false）的恢复。"""
        suppress_by_host: dict[str, set[str]] = {}
        host_apps: set[str] = set()
        for decl in decls:
            if decl.kind != "replace" or not decl.host_app or not decl.menu_path:
                continue
            host = str(decl.host_app)
            host_apps.add(host)
            # 仅 profile + pack_menu 隐藏宿主；document 替代只打 meta，宿主入口仍可见
            if decl.pack_menu and decl.strategy == "profile":
                suppress_by_host.setdefault(host, set()).add(str(decl.menu_path).strip())

        updated = 0
        restored = 0
        for host_app in host_apps:
            source_uuid = await MenuTakeoverService._get_app_uuid(tenant_id, host_app)
            if not source_uuid:
                continue
            targets = suppress_by_host.get(host_app, set())
            menus = await Menu.filter(
                tenant_id=tenant_id,
                application_uuid=source_uuid,
                deleted_at__isnull=True,
            ).all()
            for menu in menus:
                meta: Dict[str, Any] = dict(menu.meta or {})
                tagged = meta.get(META_SUPPRESSED_BY_INDUSTRY_PACK) == module_app_code
                should_suppress = any(
                    MenuTakeoverService._path_matches_menu_target(menu.path, target)
                    for target in targets
                )
                if should_suppress:
                    if (
                        not menu.is_active
                        and meta.get(META_SUPPRESSED_BY_INDUSTRY_PACK) == module_app_code
                    ):
                        continue
                    if (
                        menu.is_active
                        or meta.get(META_SUPPRESSED_BY_INDUSTRY_PACK) != module_app_code
                    ):
                        meta[META_SUPPRESSED_BY_INDUSTRY_PACK] = module_app_code
                        menu.meta = meta
                        menu.is_active = False
                        await menu.save(update_fields=["meta", "is_active", "updated_at"])
                        updated += 1
                elif tagged:
                    meta.pop(META_SUPPRESSED_BY_INDUSTRY_PACK, None)
                    still_suppressed = bool(
                        meta.get(META_SUPPRESSED_BY_TAKEOVER)
                        or meta.get(META_SUPPRESSED_BY_DEDICATED_SHELL)
                    )
                    menu.meta = meta or None
                    if not still_suppressed:
                        menu.is_active = True
                    await menu.save(update_fields=["meta", "is_active", "updated_at"])
                    restored += 1
        if updated or restored:
            logger.info(
                "industry_pack_menu_synced tenant={} module={} suppressed={} restored={}",
                tenant_id,
                module_app_code,
                updated,
                restored,
            )
        return updated + restored

    @staticmethod
    async def revert_extension_pack_menu(
        tenant_id: int,
        module_app_code: str,
        decls: List[IndustryExtensionDecl],
    ) -> int:
        """行业包停用时恢复被聚合隐藏的宿主菜单（按 meta 标记，不依赖当前 pack_menu）。"""
        restored = 0
        host_apps = {
            str(decl.host_app)
            for decl in decls
            if decl.kind == "replace" and decl.host_app
        }
        for host_app in host_apps:
            source_uuid = await MenuTakeoverService._get_app_uuid(tenant_id, host_app)
            if not source_uuid:
                continue
            menus = await Menu.filter(
                tenant_id=tenant_id,
                application_uuid=source_uuid,
                deleted_at__isnull=True,
            ).all()
            for menu in menus:
                meta: Dict[str, Any] = dict(menu.meta or {})
                tagged = meta.get(META_SUPPRESSED_BY_INDUSTRY_PACK) == module_app_code
                if not tagged:
                    continue
                meta.pop(META_SUPPRESSED_BY_INDUSTRY_PACK, None)
                still_suppressed = bool(
                    meta.get(META_SUPPRESSED_BY_TAKEOVER)
                    or meta.get(META_SUPPRESSED_BY_DEDICATED_SHELL)
                )
                menu.meta = meta or None
                if not still_suppressed:
                    menu.is_active = True
                await menu.save(update_fields=["meta", "is_active", "updated_at"])
                restored += 1
        if restored:
            logger.info(
                "industry_pack_menu_restored tenant={} module={} restored={}",
                tenant_id,
                module_app_code,
                restored,
            )
        return restored

    @staticmethod
    async def reapply_industry_pack_after_host_menu_sync(
        tenant_id: int, host_app_code: str
    ) -> None:
        """宿主应用菜单同步后，对已启用行业模块重新隐藏 pack 聚合项。"""
        from core.config.industry_pack import is_industry_module_app_code
        from core.services.application.application_service import ApplicationService
        from core.services.application.industry_extension_runtime_service import (
            IndustryExtensionRuntimeService,
        )

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
            replace_decls = [
                d
                for d in decls
                if d.kind == "replace" and d.pack_menu and d.host_app == host_app_code
            ]
            if replace_decls:
                await MenuTakeoverService.apply_extension_pack_menu(
                    tenant_id, module_code, replace_decls
                )

    @staticmethod
    async def tag_document_replacement(
        tenant_id: int,
        *,
        host_app: str,
        menu_path: str,
        extension_id: str,
    ) -> int:
        """在宿主菜单 meta 标记 document 替代；不隐藏菜单（宿主 path 保持可见）。"""
        source_uuid = await MenuTakeoverService._get_app_uuid(tenant_id, host_app)
        if not source_uuid:
            return 0
        menus = await Menu.filter(
            tenant_id=tenant_id,
            application_uuid=source_uuid,
            deleted_at__isnull=True,
        ).all()
        updated = 0
        target = (menu_path or "").strip()
        for menu in menus:
            path = (menu.path or "").strip()
            if path != target and not path.startswith(f"{target}/"):
                continue
            meta: Dict[str, Any] = dict(menu.meta or {})
            if meta.get(META_DOCUMENT_REPLACED_BY) == extension_id:
                continue
            meta[META_DOCUMENT_REPLACED_BY] = extension_id
            menu.meta = meta
            await menu.save(update_fields=["meta", "updated_at"])
            updated += 1
        return updated

    @staticmethod
    async def clear_document_replacement(
        tenant_id: int,
        *,
        host_app: str,
        menu_path: str,
        extension_id: str,
    ) -> int:
        source_uuid = await MenuTakeoverService._get_app_uuid(tenant_id, host_app)
        if not source_uuid:
            return 0
        menus = await Menu.filter(
            tenant_id=tenant_id,
            application_uuid=source_uuid,
            deleted_at__isnull=True,
        ).all()
        cleared = 0
        target = (menu_path or "").strip()
        for menu in menus:
            path = (menu.path or "").strip()
            if path != target and not path.startswith(f"{target}/"):
                continue
            meta: Dict[str, Any] = dict(menu.meta or {})
            if meta.get(META_DOCUMENT_REPLACED_BY) != extension_id:
                continue
            meta.pop(META_DOCUMENT_REPLACED_BY, None)
            menu.meta = meta or None
            await menu.save(update_fields=["meta", "updated_at"])
            cleared += 1
        return cleared


__all__ = ["MenuTakeoverService"]