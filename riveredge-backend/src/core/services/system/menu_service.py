"""
菜单服务模块

提供菜单的 CRUD 操作和树形结构管理。
"""

from __future__ import annotations

from typing import List, Optional, Dict, Any, Tuple, TypedDict
from tortoise.exceptions import IntegrityError
import hashlib
import json
import re

from core.models.menu import Menu
from core.models.permission import Permission
from core.config.system_menu_config import LEGACY_SYSTEM_GROUP_ALIASES, SYSTEM_MENU_CONFIG
from core.utils.timezone_utils import now_utc
from core.schemas.menu import (
    MenuCreate,
    MenuUpdate,
    MenuResponse,
    MenuTreeResponse,
    TenantBackendHomeResponse,
    CustomMenuLayoutUpdate,
    CustomMenuLayoutResponse,
    CustomMenuLayoutNode,
)
from core.services.application.application_service import ApplicationService
from core.services.system.site_setting_service import SiteSettingService
from core.config.menu_takeover import (
    MENU_DISPLAY_NAME_MAX_LEN,
    META_DISPLAY_NAME,
    merge_menu_meta_for_sync,
)
from core.config.menu_sync_is_active_policy import resolve_sync_is_active_for_existing_row
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.cache.cache_manager import cache_manager


class ManifestMenuSortIndex(TypedDict):
    """manifest menu_config 排序索引：叶子用 path，分组用 title（与 core_menus.name 一致）。"""

    by_path: Dict[str, int]
    by_title: Dict[str, int]


# 进程级 manifest 指纹缓存。
# manifest.json 仅随部署（进程重启）变化，故进程内只需计算一次。
# 该指纹纳入菜单树缓存键：同进程内 manifest 不变 → 键稳定 → 命中可直出；
# 部署改动 manifest → 新进程重算指纹 → 键变化 → 自动重建一次。
# 保证 manifest 仍是菜单顺序/结构的唯一真源，而无需每请求重读磁盘并重排。
_MANIFEST_FINGERPRINT_CACHE: Optional[str] = None
_CUSTOM_MENU_LAYOUT_KEY = "custom_menu_layout"


class MenuService:
    @staticmethod
    def _parse_app_root_code(path: Optional[str]) -> Optional[str]:
        if not path:
            return None
        normalized = str(path).strip().rstrip("/")
        matched = re.fullmatch(r"/apps/([^/]+)", normalized)
        return matched.group(1).lower() if matched else None

    @staticmethod
    def _is_app_root_menu_path(path: Optional[str]) -> bool:
        return MenuService._parse_app_root_code(path) is not None

    @staticmethod
    def _is_synced_i18n_menu_name(name: Optional[str]) -> bool:
        """manifest / 系统内置菜单的结构键（i18n key），禁止当展示文案改写。"""
        n = (name or "").strip()
        if n.startswith("app.") and ".menu." in n:
            return True
        if n.startswith("menu."):
            return True
        return False

    @staticmethod
    def _apply_menu_display_name(menu: Menu, display_name: Optional[str]) -> None:
        """只改 meta.display_name，不改 name（路径匹配 / 分组键 / 同步仍用 name）。"""
        meta = dict(menu.meta or {})
        trimmed = (display_name or "").strip()[:MENU_DISPLAY_NAME_MAX_LEN]
        if not trimmed:
            meta.pop(META_DISPLAY_NAME, None)
        else:
            meta[META_DISPLAY_NAME] = trimmed
        menu.meta = meta or None

    @staticmethod
    async def _sync_app_root_menu_to_application(
        tenant_id: int,
        menu: Menu,
        update_data: Dict[str, Any],
    ) -> None:
        """应用根入口菜单的名称/排序写入 core_applications（与应用中心一致）。"""
        if not MenuService._is_app_root_menu_path(menu.path) or not menu.application_uuid:
            return
        from core.schemas.application import ApplicationUpdate

        app_fields: Dict[str, Any] = {}
        if "name" in update_data:
            app_fields["name"] = update_data["name"]
            app_fields["is_custom_name"] = True
        if "sort_order" in update_data:
            app_fields["sort_order"] = update_data["sort_order"]
            app_fields["is_custom_sort"] = True
        if not app_fields:
            return
        await ApplicationService.update_application(
            tenant_id=tenant_id,
            uuid=str(menu.application_uuid),
            data=ApplicationUpdate(**app_fields),
            sync_derived_resources=False,
        )

    @staticmethod
    async def enrich_menu_response_for_admin(
        tenant_id: int,
        menu: Menu,
    ) -> MenuResponse:
        """菜单管理详情：应用根入口展示/编辑应用级名称与排序。"""
        payload = MenuResponse.model_validate(menu).model_dump()
        if MenuService._is_app_root_menu_path(menu.path) and menu.application_uuid:
            app = await ApplicationService.get_application_by_uuid_optional(
                tenant_id, str(menu.application_uuid)
            )
            if app:
                payload["name"] = app.get("name") or payload.get("name")
                payload["sort_order"] = int(app.get("sort_order") or 0)
        return MenuResponse.model_validate(payload)

    @staticmethod
    def _infer_root_entry_permission(path: Optional[str], parent_id: Optional[int]) -> Optional[str]:
        """为根入口兜底推导 permission_code（仅根节点）。"""
        if parent_id is not None or not path:
            return None
        normalized = str(path).strip()
        if not normalized:
            return None
        if normalized == "/system":
            return "system:entry:read"
        matched = re.fullmatch(r"/apps/([^/]+)", normalized)
        if matched:
            return f"{matched.group(1).lower()}:entry:read"
        return None

    @staticmethod
    async def _absorb_legacy_system_group_duplicates(
        tenant_id: int,
        parent_id: Optional[int],
        canonical_menu: Menu,
        legacy_names: List[str],
    ) -> None:
        """将同层旧英文 slug 分组并入现行 menu.group.* 行，避免菜单管理出现重复分组。"""
        if not legacy_names:
            return
        for legacy_name in legacy_names:
            filter_kw: Dict[str, Any] = dict(
                tenant_id=tenant_id,
                name=legacy_name,
                application_uuid__isnull=True,
                deleted_at__isnull=True,
            )
            if parent_id is None:
                filter_kw["parent_id__isnull"] = True
            else:
                filter_kw["parent_id"] = parent_id
            legacy = await Menu.filter(**filter_kw).first()
            if not legacy or legacy.id == canonical_menu.id:
                continue
            await Menu.filter(parent_id=legacy.id, deleted_at__isnull=True).update(
                parent_id=canonical_menu.id
            )
            legacy.deleted_at = now_utc()
            legacy.is_active = False
            await legacy.save()

    @staticmethod
    async def _sync_builtin_system_menu_tree(tenant_id: int) -> int:
        """同步系统级菜单真源到 core_menus。"""

        async def _upsert_node(node: Dict[str, Any], parent_id: Optional[int]) -> int:
            title = str(node.get("title") or "").strip()
            path = str(node.get("path") or "").strip() or None
            icon = node.get("icon")
            component = node.get("component")
            permission_raw = node.get("permission")
            permission_code = (
                str(permission_raw).strip()
                if isinstance(permission_raw, str) and str(permission_raw).strip()
                else None
            )
            permission_code = permission_code or MenuService._infer_root_entry_permission(path, parent_id)
            sort_order = int(node.get("sort_order") or 0)
            is_external = bool(node.get("is_external", False))
            external_url = node.get("external_url")
            meta = node.get("meta")
            children = node.get("children") if isinstance(node.get("children"), list) else []
            has_children = len(children) > 0
            is_clickable_leaf = bool(path) and (not is_external) and (not has_children)
            if is_clickable_leaf and not permission_code:
                raise ValidationError(
                    f"系统菜单 {title or path} 缺少 permission：叶子页面必须显式声明权限"
                )

            existing_menu = None
            if path:
                existing_menu = await Menu.filter(
                    tenant_id=tenant_id,
                    path=path,
                    deleted_at__isnull=True,
                ).first()
            if not existing_menu:
                filter_kw: Dict[str, Any] = dict(
                    tenant_id=tenant_id,
                    name=title,
                    application_uuid__isnull=True,
                    deleted_at__isnull=True,
                )
                if parent_id is None:
                    filter_kw["parent_id__isnull"] = True
                else:
                    filter_kw["parent_id"] = parent_id
                existing_menu = await Menu.filter(**filter_kw).first()

            if existing_menu:
                existing_menu.name = title
                existing_menu.path = path
                existing_menu.icon = icon
                existing_menu.component = component
                existing_menu.permission_code = permission_code
                existing_menu.application_uuid = None
                existing_menu.parent_id = parent_id
                existing_menu.sort_order = sort_order
                existing_menu.is_external = is_external
                existing_menu.external_url = external_url
                existing_menu.meta = merge_menu_meta_for_sync(existing_menu.meta, meta)
                existing_menu.is_active = True
                await existing_menu.save()
                menu_obj = existing_menu
            else:
                menu_obj = await Menu.create(
                    tenant_id=tenant_id,
                    name=title,
                    path=path,
                    icon=icon,
                    component=component,
                    permission_code=permission_code,
                    application_uuid=None,
                    parent_id=parent_id,
                    sort_order=sort_order,
                    is_active=True,
                    is_external=is_external,
                    external_url=external_url,
                    meta=meta,
                )

            legacy_aliases = LEGACY_SYSTEM_GROUP_ALIASES.get(title)
            if legacy_aliases and not path:
                await MenuService._absorb_legacy_system_group_duplicates(
                    tenant_id=tenant_id,
                    parent_id=parent_id,
                    canonical_menu=menu_obj,
                    legacy_names=legacy_aliases,
                )

            processed = 1
            for child in children:
                if isinstance(child, dict):
                    processed += await _upsert_node(child, menu_obj.id)
            return processed

        if not isinstance(SYSTEM_MENU_CONFIG, dict):
            return 0
        count = await _upsert_node(SYSTEM_MENU_CONFIG, None)
        await MenuService._clear_menu_cache(tenant_id)
        return count

    """
    菜单服务类
    
    提供菜单的 CRUD 操作和树形结构管理。
    """
    
    @staticmethod
    def _get_cache_key(tenant_id: int, key_type: str, key_value: str = "") -> str:
        """
        生成缓存键
        
        Args:
            tenant_id: 组织ID
            key_type: 键类型（list、tree）
            key_value: 键值（可选，用于区分不同的查询条件）
            
        Returns:
            str: 缓存键
        """
        if key_value:
            return f"{tenant_id}:{key_type}:{key_value}"
        return f"{tenant_id}:{key_type}"

    @staticmethod
    def _get_manifest_fingerprint() -> str:
        """
        进程级稳定的 manifest 指纹（菜单顺序/结构唯一真源的版本标识）。

        仅取影响菜单的字段（code / menu_config / sort_order），按 code 稳定排序后
        哈希。首次调用读盘计算并缓存，后续 O(1)。manifest 仅随部署变化（进程重启会
        重新计算），因此命中缓存可直接返回成品树，无需每请求重读 manifest 重排。
        """
        global _MANIFEST_FINGERPRINT_CACHE
        if _MANIFEST_FINGERPRINT_CACHE is not None:
            return _MANIFEST_FINGERPRINT_CACHE
        try:
            plugins = ApplicationService._scan_plugin_manifests()
            payload = [
                {
                    "code": m.get("code"),
                    "menu_config": m.get("menu_config"),
                    "sort_order": m.get("sort_order"),
                }
                for m in sorted(plugins, key=lambda x: str(x.get("code") or ""))
            ]
            raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
            fingerprint = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]
        except Exception:
            # 指纹计算失败时退化为固定值：仍可命中缓存，依赖既有失效机制兜底
            fingerprint = "nofp"
        _MANIFEST_FINGERPRINT_CACHE = fingerprint
        return fingerprint
    
    @staticmethod
    def _build_manifest_menu_sort_index(menu_config: Any) -> ManifestMenuSortIndex:
        """从 manifest menu_config 构建排序索引（应用菜单唯一数据源）。"""
        by_path: Dict[str, int] = {}
        by_title: Dict[str, int] = {}

        def walk(node: Dict[str, Any]) -> None:
            title = node.get("title")
            if title and str(title).strip():
                so = node.get("sort_order", 0)
                by_title[str(title).strip()] = int(so) if so is not None else 0
            path = node.get("path")
            if path and str(path).strip():
                so = node.get("sort_order", 0)
                by_path[str(path).strip()] = int(so) if so is not None else 0
            for child in node.get("children") or []:
                if isinstance(child, dict):
                    walk(child)

        if isinstance(menu_config, dict):
            walk(menu_config)
            for child in menu_config.get("children") or []:
                if isinstance(child, dict):
                    walk(child)
        elif isinstance(menu_config, list):
            for item in menu_config:
                if isinstance(item, dict):
                    walk(item)
        return ManifestMenuSortIndex(by_path=by_path, by_title=by_title)

    @staticmethod
    def _try_resolve_manifest_sort_order(
        *,
        menu_path: Optional[str],
        menu_name: Optional[str],
        index: ManifestMenuSortIndex,
    ) -> Optional[int]:
        """manifest 中声明的排序；未声明时返回 None（由调用方用 sort_order 兜底）。"""
        path = (menu_path or "").strip()
        if path and path in index["by_path"]:
            return index["by_path"][path]
        name = (menu_name or "").strip()
        if name and name in index["by_title"]:
            return index["by_title"][name]
        return None

    # manifest 菜单 sort_order 通常 < 1000；自定义子菜单排在 manifest 项之后
    _MANUAL_APP_MENU_SORT_OFFSET = 100_000

    @staticmethod
    def _app_menu_item_sort_key(
        item: MenuTreeResponse,
        index: ManifestMenuSortIndex,
    ) -> tuple:
        manifest_order = MenuService._try_resolve_manifest_sort_order(
            menu_path=item.path,
            menu_name=item.name,
            index=index,
        )
        if manifest_order is not None:
            return (manifest_order, str(item.uuid))
        db_order = int(item.sort_order) if item.sort_order is not None else 0
        return (MenuService._MANUAL_APP_MENU_SORT_OFFSET + db_order, str(item.uuid))

    @staticmethod
    async def _load_manifest_sort_indexes_for_apps(
        tenant_id: int,
        application_uuids: set[str],
    ) -> Dict[str, ManifestMenuSortIndex]:
        """按应用 UUID 从磁盘 manifest.json 加载同级菜单排序索引。"""
        indexes: Dict[str, ManifestMenuSortIndex] = {}
        for app_uuid in application_uuids:
            app = await ApplicationService.get_application_by_uuid_optional(tenant_id, app_uuid)
            if not app:
                continue
            code = (app.get("code") or "").strip()
            if not code:
                continue
            manifest = ApplicationService._get_manifest_by_code(code)
            if not manifest:
                continue
            menu_config = manifest.get("menu_config")
            if menu_config:
                indexes[app_uuid] = MenuService._build_manifest_menu_sort_index(menu_config)
        return indexes

    @staticmethod
    def _sort_menu_tree_children_inplace(
        nodes: List[MenuTreeResponse],
        app_manifest_sort_indexes: Optional[Dict[str, ManifestMenuSortIndex]] = None,
    ) -> None:
        """
        递归稳定排序每级 children。

        - 应用菜单：manifest 声明项优先；未在 manifest 声明的自定义子菜单用 core_menus.sort_order（排在 manifest 项之后）
        - 系统菜单（无 application_uuid）：只认 core_menus.sort_order
        """
        from loguru import logger

        indexes = app_manifest_sort_indexes or {}

        for node in nodes:
            ch = node.children
            if not ch:
                continue
            app_uuid = None
            for c in ch:
                if c.application_uuid:
                    app_uuid = str(c.application_uuid)
                    break
            if not app_uuid and node.application_uuid:
                app_uuid = str(node.application_uuid)

            if app_uuid:
                manifest_idx = indexes.get(app_uuid)
                if not manifest_idx:
                    logger.error(
                        "应用菜单排序失败：无法从 manifest 加载索引 application_uuid={}",
                        app_uuid,
                    )
                    raise ValidationError(
                        f"应用菜单排序配置缺失（application_uuid={app_uuid}），"
                        "请确认 riveredge-backend/src/apps 下 manifest.json 已部署"
                    )

                def _app_menu_sort_key(item: MenuTreeResponse, _idx=manifest_idx) -> tuple:
                    return MenuService._app_menu_item_sort_key(item, _idx)

                ch.sort(key=_app_menu_sort_key)
            else:
                ch.sort(
                    key=lambda c: (
                        int(c.sort_order) if c.sort_order is not None else 0,
                        c.created_at.timestamp() if c.created_at is not None else 0.0,
                        str(c.uuid),
                    )
                )
            MenuService._sort_menu_tree_children_inplace(ch, app_manifest_sort_indexes)

    @staticmethod
    def _overlay_manifest_sort_order_on_tree(
        nodes: List[MenuTreeResponse],
        app_manifest_sort_indexes: Dict[str, ManifestMenuSortIndex],
    ) -> None:
        """将 manifest 排序写回响应 sort_order，避免前端再按库内旧值重排。"""
        for node in nodes:
            if node.application_uuid:
                app_uuid = str(node.application_uuid)
                idx = app_manifest_sort_indexes.get(app_uuid)
                if idx:
                    manifest_order = MenuService._try_resolve_manifest_sort_order(
                        menu_path=node.path,
                        menu_name=node.name,
                        index=idx,
                    )
                    if manifest_order is not None:
                        node.sort_order = manifest_order
            if node.children:
                MenuService._overlay_manifest_sort_order_on_tree(
                    node.children, app_manifest_sort_indexes
                )

    @staticmethod
    async def _clear_menu_cache(tenant_id: int) -> None:
        """
        清除菜单缓存
        
        Args:
            tenant_id: 组织ID
        """
        try:
            # 使用通配符清除该租户的所有菜单相关缓存
            # 模式为 "tenant_id:list*" 和 "tenant_id:tree*"
            await cache_manager.delete_pattern("menu", f"{tenant_id}:list*")
            await cache_manager.delete_pattern("menu", f"{tenant_id}:tree*")
        except Exception:
            # 缓存清除失败不影响主流程
            pass

    @staticmethod
    def _default_custom_menu_layout() -> Dict[str, Any]:
        return {
            "enabled": False,
            "show_app_names": True,
            "version": 0,
            "nodes": [],
        }

    @staticmethod
    def _normalize_custom_menu_layout(raw: Any) -> Dict[str, Any]:
        base = MenuService._default_custom_menu_layout()
        if not isinstance(raw, dict):
            return base
        enabled = bool(raw.get("enabled", False))
        # 缺省为 True；仅显式 false/0/"false" 视为关闭
        raw_show = raw.get("show_app_names", True)
        if isinstance(raw_show, str):
            show_app_names = raw_show.strip().lower() not in ("0", "false", "off", "no")
        else:
            show_app_names = bool(raw_show)
        version = int(raw.get("version", 0) or 0)
        nodes = raw.get("nodes")
        if not isinstance(nodes, list):
            nodes = []
        return {
            "enabled": enabled,
            "show_app_names": show_app_names,
            "version": max(0, version),
            "nodes": nodes,
        }

    @staticmethod
    def _iter_custom_layout_nodes(
        nodes: List[CustomMenuLayoutNode],
    ) -> List[CustomMenuLayoutNode]:
        ordered: List[CustomMenuLayoutNode] = []

        def walk(items: List[CustomMenuLayoutNode]) -> None:
            for item in items:
                ordered.append(item)
                if item.children:
                    walk(item.children)

        walk(nodes)
        return ordered

    @staticmethod
    def _collect_menu_tree_lookup(
        roots: List[MenuTreeResponse],
    ) -> Dict[str, MenuTreeResponse]:
        by_uuid: Dict[str, MenuTreeResponse] = {}

        def walk(items: List[MenuTreeResponse]) -> None:
            for item in items:
                by_uuid[str(item.uuid)] = item
                if item.children:
                    walk(item.children)

        walk(roots)
        return by_uuid

    @staticmethod
    async def _resolve_active_menu_ref_paths(
        tenant_id: int,
        menu_uuids: List[str],
        source_lookup: Dict[str, MenuTreeResponse],
    ) -> Dict[str, str]:
        """
        解析 menu_ref 可用路径：优先导航树，树中不可达时再查库。

        导航树会过滤孤儿节点（父级已禁用等），但库内菜单仍可能 is_active=true；
        仅用树校验会导致「菜单存在却保存失败」的偶发误报。
        """
        paths: Dict[str, str] = {}
        missing_from_tree: List[str] = []
        for menu_uuid in menu_uuids:
            source = source_lookup.get(menu_uuid)
            if source and source.path:
                paths[menu_uuid] = str(source.path).strip()
            elif menu_uuid not in paths:
                missing_from_tree.append(menu_uuid)

        if not missing_from_tree:
            return paths

        db_menus = await Menu.filter(
            tenant_id=tenant_id,
            uuid__in=missing_from_tree,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        visible_app_uuids: set[str] | None = None
        for menu in db_menus:
            app_uuid = menu.application_uuid
            if app_uuid:
                if visible_app_uuids is None:
                    visible_apps = await ApplicationService.get_installed_applications(
                        tenant_id=tenant_id
                    )
                    visible_app_uuids = {str(a["uuid"]) for a in visible_apps}
                if str(app_uuid) not in visible_app_uuids:
                    continue
            paths[str(menu.uuid)] = str(menu.path or "").strip()
        return paths

    @staticmethod
    async def _validate_custom_menu_layout_nodes(
        tenant_id: int,
        nodes: List[CustomMenuLayoutNode],
        source_lookup: Dict[str, MenuTreeResponse],
    ) -> None:
        flat_nodes = MenuService._iter_custom_layout_nodes(nodes)
        seen_ids: set[str] = set()
        seen_menu_refs: set[str] = set()
        ref_uuids: List[str] = []
        for node in flat_nodes:
            node_id = (node.id or "").strip()
            if not node_id:
                raise ValidationError("自组菜单节点 id 不能为空")
            if node_id in seen_ids:
                raise ValidationError(f"自组菜单节点 id 重复：{node_id}")
            seen_ids.add(node_id)

            if node.type != "menu_ref":
                continue
            menu_uuid = (node.menu_uuid or "").strip()
            if menu_uuid in seen_menu_refs:
                raise ValidationError(f"菜单引用重复：{menu_uuid}")
            seen_menu_refs.add(menu_uuid)
            ref_uuids.append(menu_uuid)

        ref_paths = await MenuService._resolve_active_menu_ref_paths(
            tenant_id, ref_uuids, source_lookup
        )
        for node in flat_nodes:
            if node.type != "menu_ref":
                continue
            menu_uuid = (node.menu_uuid or "").strip()
            source_path = ref_paths.get(menu_uuid)
            if source_path is None:
                raise ValidationError(f"引用菜单不存在或已禁用：{menu_uuid}")

            if (
                node.menu_path
                and source_path
                and str(node.menu_path).strip() != source_path
            ):
                raise ValidationError(f"菜单路径校验失败：{menu_uuid}")

    @staticmethod
    async def get_custom_menu_layout(tenant_id: int) -> CustomMenuLayoutResponse:
        settings_row = await SiteSettingService.get_settings(tenant_id)
        settings = dict(settings_row.settings or {})
        payload = MenuService._normalize_custom_menu_layout(
            settings.get(_CUSTOM_MENU_LAYOUT_KEY)
        )
        # 顶层键供全体登录用户经站点设置读取；与布局内字段保持一致
        if "show_app_menu_names" in settings:
            raw_show = settings.get("show_app_menu_names")
            if isinstance(raw_show, str):
                payload["show_app_names"] = raw_show.strip().lower() not in (
                    "0",
                    "false",
                    "off",
                    "no",
                )
            else:
                payload["show_app_names"] = bool(raw_show)
        validated = CustomMenuLayoutResponse.model_validate(payload)
        return validated

    @staticmethod
    async def update_custom_menu_layout(
        tenant_id: int,
        data: CustomMenuLayoutUpdate,
    ) -> CustomMenuLayoutResponse:
        source_tree = await MenuService.get_menu_tree(
            tenant_id=tenant_id,
            is_active=True,
            use_cache=False,
            cache_key_suffix="nav_v1",
        )
        source_lookup = MenuService._collect_menu_tree_lookup(source_tree)
        await MenuService._validate_custom_menu_layout_nodes(
            tenant_id, data.nodes, source_lookup
        )

        settings_row = await SiteSettingService.get_settings(tenant_id)
        current = MenuService._normalize_custom_menu_layout(
            (settings_row.settings or {}).get(_CUSTOM_MENU_LAYOUT_KEY)
        )
        show_app_names = bool(data.show_app_names)
        next_layout = {
            "enabled": bool(data.enabled),
            "show_app_names": show_app_names,
            "version": int(current.get("version", 0) or 0) + 1,
            "nodes": data.model_dump(mode="json").get("nodes", []),
        }
        merged_settings = dict(settings_row.settings or {})
        merged_settings[_CUSTOM_MENU_LAYOUT_KEY] = next_layout
        # 镜像到顶层，侧栏经 configStore / 站点设置即可读取（默认与自组均生效）
        merged_settings["show_app_menu_names"] = show_app_names
        settings_row.settings = merged_settings
        await settings_row.save(update_fields=["settings"])
        await MenuService._clear_menu_cache(tenant_id)
        return CustomMenuLayoutResponse.model_validate(next_layout)
    
    @staticmethod
    async def create_menu(
        tenant_id: int,
        data: MenuCreate
    ) -> MenuResponse:
        """
        创建菜单
        
        Args:
            tenant_id: 组织ID
            data: 菜单创建数据
            
        Returns:
            MenuResponse: 创建的菜单对象
            
        Raises:
            ValidationError: 当父菜单不存在或不属于当前组织时抛出
        """
        # 验证父菜单（如果提供）
        parent_id = None
        parent = None
        if data.parent_uuid:
            parent = await Menu.filter(
                uuid=data.parent_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not parent:
                raise ValidationError("父菜单不存在或不属于当前组织")
            
            parent_id = parent.id
        
        application_uuid = data.application_uuid
        if parent and parent.application_uuid:
            application_uuid = parent.application_uuid
        elif application_uuid:
            raise ValidationError(
                "仅在选择应用菜单作为父级时可关联应用；系统菜单请勿填写关联应用"
            )

        if data.is_external and not (data.external_url or "").strip():
            raise ValidationError("外部链接菜单必须填写外部链接 URL")
        
        # 可点击页面必须显式绑定权限码，禁止空值入库
        if data.path and (not data.is_external) and (not data.permission_code):
            raise ValidationError("可点击页面菜单必须配置 permission_code，禁止为空")

        # 验证权限代码（如果提供）
        if data.permission_code:
            permission = await Permission.filter(
                code=data.permission_code,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not permission:
                raise ValidationError(f"权限代码 {data.permission_code} 不存在或不属于当前组织")
        
        # 创建菜单
        menu = await Menu.create(
            tenant_id=tenant_id,
            name=data.name,
            path=data.path,
            icon=data.icon,
            component=data.component,
            permission_code=data.permission_code,
            application_uuid=application_uuid,
            parent_id=parent_id,
            sort_order=data.sort_order,
            is_active=data.is_active,
            is_external=data.is_external,
            external_url=data.external_url,
            meta=data.meta,
        )
        
        # 清除菜单缓存
        await MenuService._clear_menu_cache(tenant_id)
        
        return MenuResponse.model_validate(menu)
    
    @staticmethod
    async def get_menu_by_uuid(
        tenant_id: int,
        menu_uuid: str
    ) -> Menu:
        """
        根据 UUID 获取菜单
        
        Args:
            tenant_id: 组织ID
            menu_uuid: 菜单UUID
            
        Returns:
            Menu: 菜单对象
            
        Raises:
            NotFoundError: 当菜单不存在时抛出
        """
        menu = await Menu.filter(
            tenant_id=tenant_id,
            uuid=menu_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not menu:
            raise NotFoundError(f"菜单 {menu_uuid} 不存在")
        
        return menu
    
    @staticmethod
    async def get_menus(
        tenant_id: int,
        page: int = 1,
        page_size: int = 100,
        parent_uuid: Optional[str] = None,
        application_uuid: Optional[str] = None,
        is_active: Optional[bool] = None,
        use_cache: bool = True
    ) -> List[MenuResponse]:
        """
        获取菜单列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            parent_uuid: 父菜单UUID过滤（可选）
            application_uuid: 应用UUID过滤（可选）
            is_active: 是否启用过滤（可选）
            use_cache: 是否使用缓存（默认True）
            
        Returns:
            List[MenuResponse]: 菜单列表
        """
        # 生成缓存键（基于查询参数）
        cache_key_value = f"p{page}_s{page_size}_p{parent_uuid or 'root'}_a{application_uuid or 'all'}_i{is_active if is_active is not None else 'all'}"
        cache_key = MenuService._get_cache_key(tenant_id, "list", cache_key_value)
        
        # 尝试从缓存获取
        if use_cache:
            try:
                cached = await cache_manager.get("menu", cache_key)
                if cached:
                    return [MenuResponse.model_validate(item) for item in cached]
            except Exception:
                # 缓存失败不影响主流程
                pass
        
        # 从数据库获取
        query = Menu.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if parent_uuid:
            parent = await Menu.filter(
                uuid=parent_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            if parent:
                query = query.filter(parent_id=parent.id)
            else:
                return []
        else:
            # 如果没有指定父菜单，只返回根菜单（parent_id 为 NULL）
            query = query.filter(parent_id__isnull=True)
        
        if application_uuid:
            query = query.filter(application_uuid=application_uuid)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        menus = await query.order_by("sort_order", "created_at").all()
        result = [MenuResponse.model_validate(menu) for menu in menus]
        
        # 缓存结果（序列化为字典列表）
        if use_cache:
            try:
                await cache_manager.set(
                    "menu",
                    cache_key,
                    [item.model_dump(mode='json') for item in result],
                    ttl=3600  # 缓存1小时
                )
            except Exception:
                # 缓存失败不影响主流程
                pass
        
        return result
    
    @staticmethod
    async def get_menu_tree(
        tenant_id: int,
        parent_uuid: Optional[str] = None,
        application_uuid: Optional[str] = None,
        is_active: Optional[bool] = None,
        use_cache: bool = True,
        *,
        cache_key_suffix: str = "",
        overlay_manifest_sort: bool = True,
    ) -> List[MenuTreeResponse]:
        """
        获取菜单树
        
        Args:
            tenant_id: 组织ID
            parent_uuid: 父菜单UUID（可选，如果提供则从该菜单开始构建树）
            application_uuid: 应用UUID过滤（可选）
            is_active: 是否启用过滤（可选）
            use_cache: 是否使用缓存（默认True）
            cache_key_suffix: 缓存键附加段（导航树与管理树分离）
            overlay_manifest_sort: 是否用 manifest 排序覆盖响应 sort_order（侧栏为 true，菜单管理为 false）
            
        Returns:
            List[MenuTreeResponse]: 菜单树列表
        """
        # 生成缓存键（基于查询参数）
        # v7：缓存命中直出（不再每请求重过滤/重排），键纳入 manifest 指纹，
        #     使部署改动 manifest 后自动失效；改版本号使旧缓存失效
        suffix = f"_{cache_key_suffix}" if cache_key_suffix else ""
        manifest_fp = MenuService._get_manifest_fingerprint()
        overlay_tag = "o1" if overlay_manifest_sort else "o0"
        cache_key_value = (
            f"p{parent_uuid or 'root'}_a{application_uuid or 'all'}"
            f"_i{is_active if is_active is not None else 'all'}_v7{suffix}_m{manifest_fp}_{overlay_tag}"
        )
        cache_key = MenuService._get_cache_key(tenant_id, "tree", cache_key_value)
        
        # 尝试从缓存获取（命中直出）。
        # 缓存写入的就是已做孤儿过滤 + manifest 排序的成品树（见下方构建逻辑），
        # 且所有改变菜单可见性/顺序的操作都会失效缓存：
        #   - 应用 安装/卸载/启用/禁用、专用应用 绑定/解绑 → _clear_menu_cache
        #   - manifest 同步扫描、菜单 CRUD → _clear_menu_cache
        #   - manifest 内容变更（部署）→ 缓存键中的 manifest 指纹变化
        # 因此命中后无需再查已安装应用做孤儿过滤、也无需重读 manifest 重排。
        if use_cache:
            try:
                cached = await cache_manager.get("menu", cache_key)
                if cached:
                    def rebuild_tree(items: List[Dict[str, Any]]) -> List[MenuTreeResponse]:
                        """递归重建菜单树"""
                        result = []
                        for item in items:
                            menu_tree = MenuTreeResponse.model_validate(item)
                            if item.get("children"):
                                menu_tree.children = rebuild_tree(item["children"])
                            else:
                                menu_tree.children = []
                            result.append(menu_tree)
                        return result
                    return rebuild_tree(cached)
            except Exception:
                # 缓存失败不影响主流程
                pass
        
        # 从数据库获取
        query = Menu.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if application_uuid:
            query = query.filter(application_uuid=application_uuid)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        # 注意：prefetch_related 对于自关联可能有问题，直接查询所有菜单，然后在内存中构建树
        all_menus = await query.order_by("sort_order", "created_at").all()

        # 过滤孤儿菜单：application_uuid 对应的应用已卸载/禁用/软删除/占位时不显示
        # 说明：平台/系统菜单（application_uuid 为 NULL）照常保留。
        try:
            visible_apps = await ApplicationService.get_installed_applications(tenant_id=tenant_id)
            visible_app_uuids = {str(a["uuid"]) for a in visible_apps}
            all_menus = [
                m for m in all_menus
                if (not m.application_uuid) or (str(m.application_uuid) in visible_app_uuids)
            ]
        except Exception:
            # 过滤失败不影响主流程（降级返回未过滤结果）
            pass
        
        # 构建菜单映射
        menu_map: Dict[int, MenuTreeResponse] = {}
        root_menus: List[MenuTreeResponse] = []
        
        # 第一遍：创建所有菜单的响应对象
        # 构建 parent_id 到 parent_uuid 的映射
        parent_id_to_uuid = {}
        for menu in all_menus:
            if menu.parent_id:
                # 查找父菜单的 UUID
                parent_menu = next((m for m in all_menus if m.id == menu.parent_id), None)
                if parent_menu:
                    parent_id_to_uuid[menu.parent_id] = parent_menu.uuid
        
        for menu in all_menus:
            # 手动构建响应对象，确保 parent_uuid 正确设置
            menu_dict = {
                "uuid": menu.uuid,
                "tenant_id": menu.tenant_id,
                "name": menu.name,
                "path": menu.path,
                "icon": menu.icon,
                "component": menu.component,
                "permission_code": menu.permission_code,
                "application_uuid": menu.application_uuid,
                "parent_uuid": parent_id_to_uuid.get(menu.parent_id) if menu.parent_id else None,
                "sort_order": menu.sort_order,
                "is_active": menu.is_active,
                "is_external": menu.is_external,
                "external_url": menu.external_url,
                "meta": menu.meta,
                "created_at": menu.created_at,
                "updated_at": menu.updated_at,
            }
            menu_response = MenuTreeResponse.model_validate(menu_dict)
            menu_response.children = []
            menu_map[menu.id] = menu_response
        
        # 第二遍：构建树形结构
        for menu in all_menus:
            menu_response = menu_map[menu.id]
            
            if menu.parent_id:
                # 有父菜单，添加到父菜单的 children 中
                if menu.parent_id in menu_map:
                    menu_map[menu.parent_id].children.append(menu_response)
            else:
                # 根菜单
                if parent_uuid is None:
                    # 没有指定父菜单，添加所有根菜单
                    root_menus.append(menu_response)
                elif str(menu.uuid) == parent_uuid:
                    # 指定的父菜单，只返回该菜单及其子菜单
                    root_menus.append(menu_response)

        app_uuids = {str(m.application_uuid) for m in all_menus if m.application_uuid}
        manifest_sort_indexes = await MenuService._load_manifest_sort_indexes_for_apps(
            tenant_id, app_uuids
        )
        MenuService._sort_menu_tree_children_inplace(root_menus, manifest_sort_indexes)
        if overlay_manifest_sort:
            MenuService._overlay_manifest_sort_order_on_tree(root_menus, manifest_sort_indexes)

        # 使用 ApplicationService（raw SQL）避免 Tortoise 模型列与数据库不一致
        applications = await ApplicationService.get_applications_uuid_sort_order(tenant_id)
        app_sort_order_map = {a["uuid"]: a["sort_order"] for a in applications}

        def apply_app_root_admin_sort(items: List[MenuTreeResponse]) -> None:
            for node in items:
                if MenuService._is_app_root_menu_path(node.path) and node.application_uuid:
                    app_sort = app_sort_order_map.get(str(node.application_uuid))
                    if app_sort is not None:
                        node.sort_order = int(app_sort)
                if node.children:
                    apply_app_root_admin_sort(node.children)

        if not overlay_manifest_sort:
            apply_app_root_admin_sort(root_menus)
        
        # 第三遍：如果根菜单有关联应用，按应用的 sort_order 排序
        # 按应用的 sort_order 排序根菜单（如果有关联应用）
        # 没有关联应用的菜单保持原顺序（按菜单的 sort_order）
        root_menus.sort(key=lambda m: (
            app_sort_order_map.get(m.application_uuid, 999999) if m.application_uuid else 999999,
            m.sort_order
        ))
        
        # 缓存结果（序列化为字典列表，包含树形结构）
        if use_cache:
            try:
                def serialize_tree(items: List[MenuTreeResponse]) -> List[Dict[str, Any]]:
                    """递归序列化菜单树"""
                    result = []
                    for item in items:
                        item_dict = item.model_dump(mode='json')
                        if item.children:
                            item_dict["children"] = serialize_tree(item.children)
                        else:
                            item_dict["children"] = []
                        result.append(item_dict)
                    return result
                
                await cache_manager.set(
                    "menu",
                    cache_key,
                    serialize_tree(root_menus),
                    ttl=3600  # 缓存1小时
                )
            except Exception:
                # 缓存失败不影响主流程
                pass
        
        return root_menus
    
    @staticmethod
    async def update_menu(
        tenant_id: int,
        menu_uuid: str,
        data: MenuUpdate
    ) -> MenuResponse:
        """
        更新菜单
        
        Args:
            tenant_id: 组织ID
            menu_uuid: 菜单UUID
            data: 菜单更新数据
            
        Returns:
            MenuResponse: 更新后的菜单对象
            
        Raises:
            NotFoundError: 当菜单不存在时抛出
            ValidationError: 当父菜单不存在或形成循环引用时抛出
        """
        menu = await MenuService.get_menu_by_uuid(tenant_id, menu_uuid)
        
        # 更新字段
        update_data = data.model_dump(exclude_unset=True)
        # 前端空字符串经 Schema 规范化为 None：仅表示不修改该字段，避免写入 sort_order=NULL 或误清空 meta
        for _optional in ("sort_order", "meta"):
            if _optional in update_data and update_data[_optional] is None:
                update_data.pop(_optional, None)

        display_name_provided = "display_name" in update_data
        display_name_value = update_data.pop("display_name", None) if display_name_provided else None

        # 可点击页面必须显式绑定权限码，禁止空值入库
        next_path = update_data.get("path", menu.path)
        next_is_external = update_data.get("is_external", menu.is_external)
        next_permission_code = update_data.get("permission_code", menu.permission_code)
        if next_path and (not next_is_external) and (not next_permission_code):
            raise ValidationError("可点击页面菜单必须配置 permission_code，禁止为空")
        
        # 验证权限代码（如果提供）
        if "permission_code" in update_data and update_data["permission_code"]:
            permission_code = update_data["permission_code"]
            permission = await Permission.filter(
                code=permission_code,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not permission:
                raise ValidationError(f"权限代码 {permission_code} 不存在或不属于当前组织")
        
        # 处理父菜单UUID
        if "parent_uuid" in update_data:
            parent_uuid = update_data.pop("parent_uuid")
            if parent_uuid:
                parent = await Menu.filter(
                    uuid=parent_uuid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if not parent:
                    raise ValidationError("父菜单不存在或不属于当前组织")
                
                if parent.application_uuid:
                    menu.application_uuid = parent.application_uuid
                elif menu.application_uuid:
                    menu.application_uuid = None
                
                # 检查循环引用：不能将自己或自己的子菜单设置为父菜单
                if parent.id == menu.id:
                    raise ValidationError("不能将菜单设置为自己的父菜单")
                
                # 检查是否形成循环引用（父菜单不能是自己的子菜单）
                current_parent_id = parent.id
                while current_parent_id:
                    if current_parent_id == menu.id:
                        raise ValidationError("不能形成循环引用")
                    current_parent = await Menu.filter(id=current_parent_id).first()
                    if not current_parent or not current_parent.parent_id:
                        break
                    current_parent_id = current_parent.parent_id
                
                menu.parent_id = parent.id
            else:
                menu.parent_id = None
        
        # 检查权限代码是否变更
        old_permission_code = menu.permission_code
        new_permission_code = update_data.get("permission_code", old_permission_code)

        # 同步菜单的 name 是结构键（i18n / 分组匹配），展示名走 meta.display_name
        if (
            MenuService._is_synced_i18n_menu_name(menu.name)
            and not MenuService._is_app_root_menu_path(menu.path)
        ):
            update_data.pop("name", None)
        
        # 更新其他字段
        for key, value in update_data.items():
            if hasattr(menu, key):
                setattr(menu, key, value)

        if display_name_provided:
            MenuService._apply_menu_display_name(menu, display_name_value)

        await MenuService._sync_app_root_menu_to_application(tenant_id, menu, update_data)

        next_is_external = menu.is_external
        next_external_url = menu.external_url
        if next_is_external and not (next_external_url or "").strip():
            raise ValidationError("外部链接菜单必须填写外部链接 URL")
        
        await menu.save()
        
        # 清除菜单缓存
        await MenuService._clear_menu_cache(tenant_id)
        
        # 如果权限代码变更，需要更新相关角色的菜单可见性
        # 注意：菜单的可见性应该基于用户的所有角色权限，这里只是触发更新
        if old_permission_code != new_permission_code:
            import asyncio
            # 异步更新菜单可见性（不阻塞主流程）
            if old_permission_code:
                asyncio.create_task(
                    MenuService.update_menus_by_permission_code(
                        tenant_id=tenant_id,
                        permission_code=old_permission_code
                    )
                )
            if new_permission_code:
                asyncio.create_task(
                    MenuService.update_menus_by_permission_code(
                        tenant_id=tenant_id,
                        permission_code=new_permission_code
                    )
                )
        
        return await MenuService.enrich_menu_response_for_admin(tenant_id, menu)
    
    @staticmethod
    async def delete_menu(
        tenant_id: int,
        menu_uuid: str
    ) -> bool:
        """
        删除菜单（软删除）
        
        Args:
            tenant_id: 组织ID
            menu_uuid: 菜单UUID
            
        Returns:
            bool: 是否成功
            
        Raises:
            NotFoundError: 当菜单不存在时抛出
            ValidationError: 当菜单有子菜单时抛出
        """
        menu = await MenuService.get_menu_by_uuid(tenant_id, menu_uuid)
        
        # 检查是否有子菜单
        children_count = await Menu.filter(
            parent_id=menu.id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).count()
        
        if children_count > 0:
            raise ValidationError("该菜单下有子菜单，无法删除")
        
        # 软删除
        await menu.delete()

        from core.models.tenant_backend_home import TenantBackendHome

        await TenantBackendHome.filter(tenant_id=tenant_id, menu_uuid=str(menu.uuid)).delete()

        # 清除菜单缓存
        await MenuService._clear_menu_cache(tenant_id)
        
        return True

    @staticmethod
    async def get_tenant_backend_home_response(tenant_id: int) -> TenantBackendHomeResponse:
        """解析当前租户的后台首页；无效指针返回全空。"""
        from core.models.tenant_backend_home import TenantBackendHome

        row = await TenantBackendHome.filter(tenant_id=tenant_id).first()
        if not row:
            return TenantBackendHomeResponse(menu_uuid=None, path=None, name=None)
        menu = await Menu.filter(
            tenant_id=tenant_id,
            uuid=row.menu_uuid,
            deleted_at__isnull=True,
        ).first()
        if not menu or not menu.is_active or menu.is_external:
            return TenantBackendHomeResponse(menu_uuid=None, path=None, name=None)
        path = (menu.path or "").strip()
        if not path:
            return TenantBackendHomeResponse(menu_uuid=None, path=None, name=None)
        return TenantBackendHomeResponse(
            menu_uuid=str(menu.uuid),
            path=path,
            name=menu.name,
        )

    @staticmethod
    async def set_tenant_backend_home(tenant_id: int, menu_uuid: str) -> MenuResponse:
        """
        将某菜单设为当前租户后台首页（排他：先删后插，仅一条）。

        Raises:
            ValidationError: 外部链接、无 path、未启用
        """
        from core.models.tenant_backend_home import TenantBackendHome
        from tortoise.transactions import in_transaction

        menu = await MenuService.get_menu_by_uuid(tenant_id, menu_uuid)
        if menu.is_external:
            raise ValidationError("外部链接菜单不能设为后台首页")
        if not menu.path or not str(menu.path).strip():
            raise ValidationError("请先为该菜单配置路由 path")
        if not menu.is_active:
            raise ValidationError("仅可将已启用的菜单设为后台首页")

        async with in_transaction() as conn:
            await TenantBackendHome.filter(tenant_id=tenant_id).using_db(conn).delete()
            await TenantBackendHome.create(
                tenant_id=tenant_id,
                menu_uuid=str(menu.uuid),
                using_db=conn,
            )
        await MenuService._clear_menu_cache(tenant_id)
        return MenuResponse.model_validate(menu)

    @staticmethod
    async def clear_tenant_backend_home(tenant_id: int) -> None:
        from core.models.tenant_backend_home import TenantBackendHome

        await TenantBackendHome.filter(tenant_id=tenant_id).delete()
        await MenuService._clear_menu_cache(tenant_id)
    
    @staticmethod
    async def update_menu_order(
        tenant_id: int,
        menu_orders: List[Dict[str, Any]]
    ) -> bool:
        """
        更新菜单排序
        
        Args:
            tenant_id: 组织ID
            menu_orders: 菜单排序列表，格式：[{"uuid": "...", "sort_order": 1}, ...]
            
        Returns:
            bool: 是否成功
        """
        for order_item in menu_orders:
            menu_uuid = order_item.get("uuid")
            sort_order = order_item.get("sort_order")
            
            if menu_uuid and sort_order is not None:
                menu = await Menu.filter(
                    uuid=menu_uuid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if menu:
                    menu.sort_order = sort_order
                    await menu.save()
        
        # 清除菜单缓存（排序变更会影响菜单列表和菜单树）
        await MenuService._clear_menu_cache(tenant_id)
        
        return True
    
    @staticmethod
    async def update_menus_by_permission_code(
        tenant_id: int,
        permission_code: str
    ) -> int:
        """
        根据权限代码更新菜单可见性

        仅在权限被删除（不存在）时：清空关联菜单的 permission_code 并禁用菜单。

        不在「权限仍存在」时自动把 is_active 改回 True：带同一 permission_code 的菜单
        可能由管理员在菜单管理中手动禁用，若此处批量启用会与手动设置冲突（例如角色权限
        变更时会触发本方法）。
        """
        permission = await Permission.filter(
            code=permission_code,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()

        if not permission:
            updated_count = await Menu.filter(
                tenant_id=tenant_id,
                permission_code=permission_code,
                deleted_at__isnull=True
            ).update(
                permission_code=None,
                is_active=False
            )
            return updated_count
        return 0

    @staticmethod
    async def activate_menus_for_permission_codes(
        tenant_id: int,
        permission_codes: list[str],
    ) -> int:
        """
        角色被授予权限后，启用仍绑定这些 permission_code 的菜单（仅 is_active 置 True，不改 permission_code）。
        """
        codes = [c.strip() for c in permission_codes if isinstance(c, str) and c.strip()]
        if not codes:
            return 0
        updated = await Menu.filter(
            tenant_id=tenant_id,
            permission_code__in=codes,
            deleted_at__isnull=True,
        ).update(is_active=True)
        if updated:
            await MenuService._clear_menu_cache(tenant_id)
        return updated

    @staticmethod
    async def sync_menus_from_application_config(
        tenant_id: int,
        application_uuid: str,
        menu_config: Dict[str, Any],
        is_active: bool = True,
        *,
        preserve_existing_is_active: bool = True,
        skip_permission_sync: bool = False,
        defer_cache_clear: bool = False,
        defer_menu_takeover: bool = False,
    ) -> int:
        """
        从应用菜单配置同步菜单到菜单管理
        
        当应用的 menu_config 更新时，自动创建或更新关联的菜单。
        支持树形结构的菜单配置。
        
        Args:
            tenant_id: 组织ID
            application_uuid: 应用UUID
            menu_config: 菜单配置（JSON格式）
            is_active: 新建菜单项是否启用（默认与应用状态一致）
            preserve_existing_is_active: 对已存在行的写入规则见
                ``core.config.menu_sync_is_active_policy.resolve_sync_is_active_for_existing_row``
                （菜单同步 is_active 策略见业务文档）
            skip_permission_sync: 为 True 时不同步 core_permissions（例如「扫描应用」批量路径由调用方在最后统一同步）
            defer_cache_clear: 为 True 时跳过本应用菜单缓存清理（批量 sync-all 结束时统一清理）
            defer_menu_takeover: 为 True 时跳过菜单接管重算（批量 sync-all 结束时统一处理）
            
        Returns:
            int: 同步的菜单数量
        """
        from loguru import logger
        
        if not menu_config:
            logger.info(f"应用 {application_uuid} 没有菜单配置，跳过同步")
            return 0
        
        # 获取现有的关联菜单（用于更新或删除）
        existing_menus = await Menu.filter(
            tenant_id=tenant_id,
            application_uuid=application_uuid,
            deleted_at__isnull=True
        ).all()
        
        # 获取应用信息，以确定是否需要使用应用名称作为根菜单名称
        app = await ApplicationService.get_application_by_uuid_optional(
            tenant_id, application_uuid
        )
        app_name = app.get("name") if app else None

        existing_menu_map = {menu.uuid: menu for menu in existing_menus}
        # 性能优化：同步过程使用内存索引匹配，避免每个菜单节点重复访问数据库
        existing_menu_by_path: Dict[str, Menu] = {}
        existing_menu_by_parent_name: Dict[Tuple[Optional[int], str], Menu] = {}
        for menu in existing_menus:
            if menu.path and menu.path not in existing_menu_by_path:
                existing_menu_by_path[menu.path] = menu
            if menu.name:
                key = (menu.parent_id, menu.name)
                if key not in existing_menu_by_parent_name:
                    existing_menu_by_parent_name[key] = menu
        
        # 递归创建或更新菜单
        created_count = 0
        synced_count = 0
        
        async def _create_or_update_menu(
            menu_item: Dict[str, Any],
            parent_uuid: Optional[str] = None,
            parent_id: Optional[int] = None
        ) -> Optional[Menu]:
            nonlocal created_count, synced_count
            """
            递归创建或更新菜单项
            
            Args:
                menu_item: 菜单项配置
                parent_uuid: 父菜单UUID
                parent_id: 父菜单ID
                
            Returns:
                Menu: 创建或更新的菜单对象
            """
            # 提取菜单项信息
            menu_uuid = menu_item.get("uuid")  # 如果配置中有UUID，使用它
            menu_name = menu_item.get("title", "")
            
            if parent_id is None and app_name:
                menu_name = app_name

            menu_path = menu_item.get("path")
            menu_icon = menu_item.get("icon")
            menu_component = menu_item.get("component")
            menu_permission_code_raw = menu_item.get("permission")
            menu_permission_code = (
                str(menu_permission_code_raw).strip()
                if isinstance(menu_permission_code_raw, str) and str(menu_permission_code_raw).strip()
                else None
            )
            menu_permission_code = (
                menu_permission_code
                or MenuService._infer_root_entry_permission(menu_path, parent_id)
            )
            # 应用菜单展示顺序以 manifest 为唯一数据源，不同步 sort_order 至 core_menus
            menu_is_external = menu_item.get("is_external", False)
            menu_external_url = menu_item.get("external_url")
            menu_meta = menu_item.get("meta")
            children = menu_item.get("children", [])
            has_children = isinstance(children, list) and len(children) > 0
            is_clickable_leaf = bool(menu_path and str(menu_path).strip()) and (not menu_is_external) and (not has_children)
            if is_clickable_leaf and not menu_permission_code:
                raise ValidationError(
                    f"manifest 菜单 {menu_name or menu_path} 缺少 permission：叶子页面必须显式声明权限"
                )
            
            # 检查菜单是否已存在（按优先级：uuid > path > parent+name）
            # 无 path 的父级菜单必须按 parent_id+name 匹配，否则每次同步都会新建导致重复
            existing_menu = None
            if menu_uuid and menu_uuid in existing_menu_map:
                existing_menu = existing_menu_map[menu_uuid]
            elif menu_path:
                existing_menu = existing_menu_by_path.get(menu_path)
            elif menu_name:
                # 无 path 的菜单（如父级分组）：按 parent_id + name 匹配，从源头杜绝重复
                existing_menu = existing_menu_by_parent_name.get((parent_id, menu_name))
            
            if existing_menu:
                old_path = existing_menu.path
                old_parent_id = existing_menu.parent_id
                old_name = existing_menu.name
                # 更新现有菜单
                existing_menu.name = menu_name
                existing_menu.path = menu_path
                existing_menu.icon = menu_icon
                existing_menu.component = menu_component
                existing_menu.permission_code = menu_permission_code
                _resolved = resolve_sync_is_active_for_existing_row(
                    is_active, preserve_existing_is_active
                )
                if _resolved is not None:
                    existing_menu.is_active = _resolved
                existing_menu.is_external = menu_is_external
                existing_menu.external_url = menu_external_url
                existing_menu.meta = merge_menu_meta_for_sync(existing_menu.meta, menu_meta)
                existing_menu.parent_id = parent_id
                await existing_menu.save()
                
                # 从 existing_menu_map 中移除，表示已处理
                if existing_menu.uuid in existing_menu_map:
                    del existing_menu_map[existing_menu.uuid]
                if old_path and existing_menu_by_path.get(old_path) is existing_menu:
                    del existing_menu_by_path[old_path]
                if old_name and existing_menu_by_parent_name.get((old_parent_id, old_name)) is existing_menu:
                    del existing_menu_by_parent_name[(old_parent_id, old_name)]
                if existing_menu.path:
                    existing_menu_by_path[existing_menu.path] = existing_menu
                if existing_menu.name:
                    existing_menu_by_parent_name[(existing_menu.parent_id, existing_menu.name)] = existing_menu
                
                menu_obj = existing_menu
                synced_count += 1
            else:
                # 创建新菜单
                menu_obj = await Menu.create(
                    tenant_id=tenant_id,
                    name=menu_name,
                    path=menu_path,
                    icon=menu_icon,
                    component=menu_component,
                    permission_code=menu_permission_code,
                    application_uuid=application_uuid,
                    parent_id=parent_id,
                    sort_order=0,
                    is_active=is_active,
                    is_external=menu_is_external,
                    external_url=menu_external_url,
                    meta=menu_meta,
                )
                created_count += 1
                synced_count += 1
                if menu_obj.path:
                    existing_menu_by_path[menu_obj.path] = menu_obj
                if menu_obj.name:
                    existing_menu_by_parent_name[(menu_obj.parent_id, menu_obj.name)] = menu_obj
            
            # 递归处理子菜单
            if children:
                logger.debug(f"处理菜单 {menu_name} 的 {len(children)} 个子菜单")
                for child_item in children:
                    await _create_or_update_menu(child_item, parent_uuid=str(menu_obj.uuid), parent_id=menu_obj.id)
            
            return menu_obj
        
        # 处理菜单配置（支持单个菜单或菜单列表）
        if isinstance(menu_config, list):
            # 如果是列表，遍历每个菜单项
            for menu_item in menu_config:
                await _create_or_update_menu(menu_item)
        elif isinstance(menu_config, dict):
            # 如果是字典，作为单个菜单项处理
            # 注意：应用的根菜单配置（包含应用名称、图标等）会创建为根菜单项
            # 前端会将其显示为分组标题，其 children 会作为一级菜单显示
            children_count = len(menu_config.get("children", []))
            logger.info(f"开始同步应用菜单配置，根菜单项: {menu_config.get('title') or menu_config.get('name')}, 子菜单数量: {children_count}")
            await _create_or_update_menu(menu_config)
            logger.info(f"应用菜单配置同步完成，已处理 {children_count} 个子菜单")
        
        # 删除不再存在于配置中的菜单（软删除）
        if existing_menu_map:
            from datetime import datetime
            deleted_uuids = list(existing_menu_map.keys())
            await Menu.filter(
                tenant_id=tenant_id,
                uuid__in=deleted_uuids,
                deleted_at__isnull=True
            ).update(deleted_at=now_utc())
            logger.info(f"应用 {application_uuid} 菜单配置同步完成，删除 {len(deleted_uuids)} 个不再存在的菜单")
        
        logger.info(
            f"应用 {application_uuid} 菜单配置同步完成，处理 {synced_count} 个菜单（新建 {created_count} 个）"
        )

        # 菜单同步后，清除相关缓存，确保前端能立即获取最新菜单
        if not defer_cache_clear:
            try:
                # 使用通配符清除该租户的所有菜单缓存
                await cache_manager.delete_pattern("menu", f"{tenant_id}:list*")
                await cache_manager.delete_pattern("menu", f"{tenant_id}:tree*")
                logger.debug(f"已清除租户 {tenant_id} 的菜单缓存")
            except Exception as e:
                from loguru import logger
                logger.warning(f"清除菜单缓存失败: {e}")

        # 菜单同步后强制同步权限到 core_permissions，保证角色权限页「全部权限」含应用级菜单权限
        if not skip_permission_sync:
            try:
                from core.services.authorization.permission_sync_service import PermissionSyncService
                await PermissionSyncService.ensure_permissions(tenant_id=tenant_id, force=True)
            except Exception as e:
                logger.warning(f"菜单同步后权限同步失败: {e}")

        if not defer_menu_takeover and app and app.get("code"):
            from core.services.system.menu_takeover_service import MenuTakeoverService
            await MenuTakeoverService.reapply_after_source_menu_sync(tenant_id, str(app["code"]))

        return synced_count

    @staticmethod
    async def sync_all_menus_from_applications(
        tenant_id: int,
        *,
        skip_permission_sync: bool = False,
        skip_canonical_sort: bool = False,
    ) -> int:
        """
        根据已安装应用的菜单配置，同步所有菜单到数据库。
        用于初始化向导或组织首次进入时，确保菜单已写入数据库。

        Args:
            tenant_id: 组织ID

        Returns:
            int: 同步的菜单总数
        """
        from loguru import logger

        apps = await ApplicationService.list_applications(
            tenant_id=tenant_id,
            skip=0,
            limit=500,
            is_installed=True,
            is_active=True,
        )
        total = await MenuService._sync_builtin_system_menu_tree(tenant_id=tenant_id)
        need_permission_sync = False
        synced_app_codes: List[str] = []
        for app in apps:
            menu_config = app.get("menu_config")
            app_uuid = app.get("uuid")
            if app_uuid and not isinstance(app_uuid, str):
                app_uuid = str(app_uuid)
            if menu_config and app_uuid:
                try:
                    count = await MenuService.sync_menus_from_application_config(
                        tenant_id=tenant_id,
                        application_uuid=str(app_uuid),
                        menu_config=menu_config,
                        is_active=app.get("is_active", True),
                        skip_permission_sync=True,
                        defer_cache_clear=True,
                        defer_menu_takeover=True,
                    )
                    total += count
                    need_permission_sync = True
                    app_code = app.get("code")
                    if app_code:
                        synced_app_codes.append(str(app_code))
                except Exception as e:
                    logger.warning(f"同步应用 {app.get('code')} 菜单失败: {e}")
        if need_permission_sync and not skip_permission_sync:
            try:
                from core.services.authorization.permission_sync_service import PermissionSyncService
                await PermissionSyncService.ensure_permissions(tenant_id=tenant_id, force=False)
            except Exception as e:
                logger.warning(f"全量菜单同步后权限同步失败: {e}")
        if synced_app_codes:
            from core.services.system.menu_takeover_service import MenuTakeoverService
            for app_code in synced_app_codes:
                await MenuTakeoverService.reapply_after_source_menu_sync(tenant_id, app_code)
        if total > 0 or synced_app_codes:
            await MenuService._clear_menu_cache(tenant_id)
            logger.info(f"租户 {tenant_id} 菜单同步完成，共 {total} 个菜单")
        return total
