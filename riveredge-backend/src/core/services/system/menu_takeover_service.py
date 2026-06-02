"""
菜单接管服务

启用 consumer 应用时抑制 source 应用对应菜单；禁用时恢复（仅恢复由接管抑制的项）。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from loguru import logger

from core.config.menu_takeover import (
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
            menu.meta = meta or None
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
            if await MenuTakeoverService.is_consumer_active(tenant_id, rule.consumer_app_code):
                await MenuTakeoverService.apply_takeover(tenant_id, rule.consumer_app_code)

    @staticmethod
    async def sync_for_application_lifecycle(
        tenant_id: int,
        app_code: str,
        *,
        enabled: bool,
    ) -> None:
        if app_code not in MENU_TAKEOVER_RULES:
            return
        from core.services.system.menu_service import MenuService

        if enabled:
            await MenuTakeoverService.apply_takeover(tenant_id, app_code)
        else:
            await MenuTakeoverService.revert_takeover(tenant_id, app_code)
        await MenuService._clear_menu_cache(tenant_id)


__all__ = ["MenuTakeoverService"]
