"""
菜单服务模块

提供菜单的 CRUD 操作和树形结构管理。
"""

from typing import List, Optional, Dict, Any
from tortoise.exceptions import IntegrityError
import json

from core.models.menu import Menu
from core.models.permission import Permission
from core.schemas.menu import MenuCreate, MenuUpdate, MenuResponse, MenuTreeResponse
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.cache.cache_manager import cache_manager


class MenuService:
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
        use_cache: bool = True
    ) -> List[MenuTreeResponse]:
        """
        获取菜单树
        
        Args:
            tenant_id: 组织ID
            parent_uuid: 父菜单UUID（可选，如果提供则从该菜单开始构建树）
            application_uuid: 应用UUID过滤（可选）
            is_active: 是否启用过滤（可选）
            use_cache: 是否使用缓存（默认True）
            
        Returns:
            List[MenuTreeResponse]: 菜单树列表
        """
        # 生成缓存键（基于查询参数）
        cache_key_value = f"p{parent_uuid or 'root'}_a{application_uuid or 'all'}_i{is_active if is_active is not None else 'all'}"
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
        
        # 第三遍：如果根菜单有关联应用，按应用的 sort_order 排序
        # 需要导入 Application 模型
        from core.models.application import Application
        
        # 获取所有应用及其 sort_order
        applications = await Application.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).all()
        
        # 构建应用 UUID 到 sort_order 的映射
        app_sort_order_map = {app.uuid: app.sort_order for app in applications}
        
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
        
        # 清除菜单缓存
        await MenuService._clear_menu_cache(tenant_id)
        
        return True
    
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
        
        当权限被删除或禁用时，自动更新关联菜单的状态。
        
        Args:
            tenant_id: 组织ID
            permission_code: 权限代码
            
        Returns:
            int: 更新的菜单数量
        """
        # 检查权限是否存在
        permission = await Permission.filter(
            code=permission_code,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not permission:
            # 权限不存在或被删除，将关联菜单的权限代码清空并禁用菜单
            updated_count = await Menu.filter(
                tenant_id=tenant_id,
                permission_code=permission_code,
                deleted_at__isnull=True
            ).update(
                permission_code=None,
                is_active=False
            )
            return updated_count
        else:
            # 权限存在，确保关联菜单是启用的（如果之前被禁用）
            # 注意：这里只更新之前因为权限问题被禁用的菜单
            updated_count = await Menu.filter(
                tenant_id=tenant_id,
                permission_code=permission_code,
                deleted_at__isnull=True,
                is_active=False
            ).update(
                is_active=True
            )
            return updated_count

    @staticmethod
    async def sync_menus_from_application_config(
        tenant_id: int,
        application_uuid: str,
        menu_config: Dict[str, Any],
        is_active: bool = True
    ) -> int:
        """
        从应用菜单配置同步菜单到菜单管理
        
        当应用的 menu_config 更新时，自动创建或更新关联的菜单。
        支持树形结构的菜单配置。
        
        Args:
            tenant_id: 组织ID
            application_uuid: 应用UUID
            menu_config: 菜单配置（JSON格式）
            is_active: 菜单是否启用（默认与应用状态一致）
            
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
        from core.models.application import Application
        app = await Application.filter(uuid=application_uuid, tenant_id=tenant_id).first()
        app_name = app.name if app else None

        existing_menu_map = {menu.uuid: menu for menu in existing_menus}
        
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
            # 兼容 title 和 name 字段（manifest.json 使用 title，优先使用 title）
            menu_name = menu_item.get("title") or menu_item.get("name", "")
            
            # 如果是根菜单（没有父菜单），且应用有自定义名称，则使用应用名称作为菜单名称
            if parent_id is None and app_name:
                menu_name = app_name

            menu_path = menu_item.get("path")
            menu_icon = menu_item.get("icon")
            menu_component = menu_item.get("component")
            # 兼容 permission 和 permission_code 字段（manifest.json 使用 permission）
            menu_permission_code = menu_item.get("permission_code") or menu_item.get("permission")
            menu_sort_order = menu_item.get("sort_order", 0)
            menu_is_external = menu_item.get("is_external", False)
            menu_external_url = menu_item.get("external_url")
            menu_meta = menu_item.get("meta")
            children = menu_item.get("children", [])
            
            # 检查菜单是否已存在
            existing_menu = None
            if menu_uuid and menu_uuid in existing_menu_map:
                existing_menu = existing_menu_map[menu_uuid]
            elif menu_path:
                # 如果没有UUID，尝试通过路径查找
                existing_menu = await Menu.filter(
                    tenant_id=tenant_id,
                    application_uuid=application_uuid,
                    path=menu_path,
                    deleted_at__isnull=True
                ).first()
            
            if existing_menu:
                # 更新现有菜单
                existing_menu.name = menu_name
                existing_menu.path = menu_path
                existing_menu.icon = menu_icon
                existing_menu.component = menu_component
                existing_menu.permission_code = menu_permission_code
                existing_menu.sort_order = menu_sort_order
                existing_menu.is_active = is_active
                existing_menu.is_external = menu_is_external
                existing_menu.external_url = menu_external_url
                existing_menu.meta = menu_meta
                existing_menu.parent_id = parent_id
                await existing_menu.save()
                
                # 从 existing_menu_map 中移除，表示已处理
                if existing_menu.uuid in existing_menu_map:
                    del existing_menu_map[existing_menu.uuid]
                
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
                    sort_order=menu_sort_order,
                    is_active=is_active,
                    is_external=menu_is_external,
                    external_url=menu_external_url,
                    meta=menu_meta,
                )
                created_count += 1
            
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
            ).update(deleted_at=datetime.now())
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
        try:
            from core.services.authorization.permission_sync_service import PermissionSyncService
            await PermissionSyncService.ensure_permissions(tenant_id=tenant_id, force=True)
        except Exception as e:
            logger.warning(f"菜单同步后权限同步失败: {e}")

        return created_count
