"""
菜单服务模块

提供菜单的 CRUD 操作和树形结构管理。
"""

from __future__ import annotations

from typing import List, Optional, Dict, Any, Tuple, TypedDict
from tortoise.exceptions import IntegrityError
import json
import re

from core.models.menu import Menu
from core.models.permission import Permission
from core.config.system_menu_config import LEGACY_SYSTEM_GROUP_ALIASES, SYSTEM_MENU_CONFIG
from core.timezone_utils import now_utc
from core.schemas.menu import MenuCreate, MenuUpdate, MenuResponse, MenuTreeResponse, TenantBackendHomeResponse
from core.services.application.application_service import ApplicationService
from core.menu_sync_is_active_policy import resolve_sync_is_active_for_existing_row
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.cache.cache_manager import cache_manager


class ManifestMenuSortIndex(TypedDict):
    """manifest menu_config 排序索引：叶子用 path，分组用 title（与 core_menus.name 一致）。"""

    by_path: Dict[str, int]
    by_title: Dict[str, int]


class MenuService:
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
                existing_menu.meta = meta
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
    def _resolve_manifest_sort_order(
        *,
        menu_path: Optional[str],
        menu_name: Optional[str],
        index: ManifestMenuSortIndex,
        application_uuid: str,
    ) -> int:
        path = (menu_path or "").strip()
        if path and path in index["by_path"]:
            return index["by_path"][path]
        name = (menu_name or "").strip()
        if name and name in index["by_title"]:
            return index["by_title"][name]
        from loguru import logger

        logger.error(
            "应用菜单项未在 manifest 中配置排序 path={} name={} application_uuid={}",
            path or None,
            name or None,
            application_uuid,
        )
        raise ValidationError(
            f"菜单未在应用 manifest menu_config 中声明排序"
            f"（path={path or '-'}, name={name or '-'}）"
        )

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

        - 应用菜单：只认 manifest（path 或 title/sort_order）；不读 core_menus.sort_order
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

                def _app_menu_sort_key(item: MenuTreeResponse, _idx=manifest_idx, _au=app_uuid) -> tuple:
                    order = MenuService._resolve_manifest_sort_order(
                        menu_path=item.path,
                        menu_name=item.name,
                        index=_idx,
                        application_uuid=_au,
                    )
                    return (order, str(item.uuid))

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
                    node.sort_order = MenuService._resolve_manifest_sort_order(
                        menu_path=node.path,
                        menu_name=node.name,
                        index=idx,
                        application_uuid=app_uuid,
                    )
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
        if data.parent_uuid:
            parent = await Menu.filter(
                uuid=data.parent_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not parent:
                raise ValidationError("父菜单不存在或不属于当前组织")
            
            parent_id = parent.id
        
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
            application_uuid=data.application_uuid,
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
            
        Returns:
            List[MenuTreeResponse]: 菜单树列表
        """
        # 生成缓存键（基于查询参数）
        # v6：应用菜单按 manifest path+title 排序；改版本号使旧缓存失效
        suffix = f"_{cache_key_suffix}" if cache_key_suffix else ""
        cache_key_value = (
            f"p{parent_uuid or 'root'}_a{application_uuid or 'all'}"
            f"_i{is_active if is_active is not None else 'all'}_v6{suffix}"
        )
        cache_key = MenuService._get_cache_key(tenant_id, "tree", cache_key_value)
        
        # 尝试从缓存获取
        if use_cache:
            try:
                cached = await cache_manager.get("menu", cache_key)
                if cached:
                    # 从缓存的字典数据重建菜单树
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
                    cached_tree = rebuild_tree(cached)
                    # 对缓存命中结果做孤儿菜单过滤，确保仅展示当前已安装应用菜单
                    try:
                        visible_apps = await ApplicationService.get_installed_applications(tenant_id=tenant_id)
                        visible_app_uuids = {str(a["uuid"]) for a in visible_apps}

                        def filter_orphan(nodes: List[MenuTreeResponse]) -> List[MenuTreeResponse]:
                            kept: List[MenuTreeResponse] = []
                            for n in nodes:
                                if n.application_uuid and str(n.application_uuid) not in visible_app_uuids:
                                    continue
                                n.children = filter_orphan(n.children or [])
                                kept.append(n)
                            return kept

                        cached_tree = filter_orphan(cached_tree)
                    except Exception:
                        pass
                    cached_app_uuids: set[str] = set()

                    def _collect_app_uuids(nodes: List[MenuTreeResponse]) -> None:
                        for n in nodes:
                            if n.application_uuid:
                                cached_app_uuids.add(str(n.application_uuid))
                            if n.children:
                                _collect_app_uuids(n.children)

                    _collect_app_uuids(cached_tree)
                    manifest_sort_indexes = await MenuService._load_manifest_sort_indexes_for_apps(
                        tenant_id, cached_app_uuids
                    )
                    MenuService._sort_menu_tree_children_inplace(
                        cached_tree, manifest_sort_indexes
                    )
                    MenuService._overlay_manifest_sort_order_on_tree(
                        cached_tree, manifest_sort_indexes
                    )
                    return cached_tree
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
        MenuService._overlay_manifest_sort_order_on_tree(root_menus, manifest_sort_indexes)

        # 第三遍：如果根菜单有关联应用，按应用的 sort_order 排序
        # 使用 ApplicationService（raw SQL）避免 Tortoise 模型列与数据库不一致
        applications = await ApplicationService.get_applications_uuid_sort_order(tenant_id)
        app_sort_order_map = {a["uuid"]: a["sort_order"] for a in applications}
        
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
        
        # 更新其他字段
        for key, value in update_data.items():
            if hasattr(menu, key):
                setattr(menu, key, value)
        
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
        
        return MenuResponse.model_validate(menu)
    
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
                ``core.menu_sync_is_active_policy.resolve_sync_is_active_for_existing_row``
                （单测：tests/test_menu_sync_is_active_policy.py）
            skip_permission_sync: 为 True 时不同步 core_permissions（例如「扫描应用」批量路径由调用方在最后统一同步）
            
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
        
        async def _create_or_update_menu(
            menu_item: Dict[str, Any],
            parent_uuid: Optional[str] = None,
            parent_id: Optional[int] = None
        ) -> Optional[Menu]:
            nonlocal created_count  # 允许修改外部函数的变量
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
                existing_menu.meta = menu_meta
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
        
        logger.info(f"应用 {application_uuid} 菜单配置同步完成，创建/更新 {created_count} 个菜单")

        # 菜单同步后，清除相关缓存，确保前端能立即获取最新菜单
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

        if app and app.get("code"):
            from core.services.system.menu_takeover_service import MenuTakeoverService
            await MenuTakeoverService.reapply_after_source_menu_sync(tenant_id, str(app["code"]))

        return created_count

    @staticmethod
    async def sync_all_menus_from_applications(tenant_id: int) -> int:
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
                    )
                    total += count
                    need_permission_sync = True
                except Exception as e:
                    logger.warning(f"同步应用 {app.get('code')} 菜单失败: {e}")
        if need_permission_sync:
            try:
                from core.services.authorization.permission_sync_service import PermissionSyncService
                await PermissionSyncService.ensure_permissions(tenant_id=tenant_id, force=True)
            except Exception as e:
                logger.warning(f"全量菜单同步后权限同步失败: {e}")
        if total > 0:
            logger.info(f"租户 {tenant_id} 菜单同步完成，共 {total} 个菜单")
        return total
