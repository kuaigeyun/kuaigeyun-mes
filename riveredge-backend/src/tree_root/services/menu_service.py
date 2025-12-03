"""
菜单服务模块

提供菜单的 CRUD 操作和树形结构管理。
"""

from typing import List, Optional, Dict, Any
from tortoise.exceptions import IntegrityError

from tree_root.models.menu import Menu
from tree_root.schemas.menu import MenuCreate, MenuUpdate, MenuResponse, MenuTreeResponse
from soil.exceptions.exceptions import NotFoundError, ValidationError


class MenuService:
    """
    菜单服务类
    
    提供菜单的 CRUD 操作和树形结构管理。
    """
    
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
            
        Returns:
            List[MenuResponse]: 菜单列表
        """
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
        
        return [MenuResponse.model_validate(menu) for menu in menus]
    
    @staticmethod
    async def get_menu_tree(
        tenant_id: int,
        parent_uuid: Optional[str] = None,
        application_uuid: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[MenuTreeResponse]:
        """
        获取菜单树
        
        Args:
            tenant_id: 组织ID
            parent_uuid: 父菜单UUID（可选，如果提供则从该菜单开始构建树）
            application_uuid: 应用UUID过滤（可选）
            is_active: 是否启用过滤（可选）
            
        Returns:
            List[MenuTreeResponse]: 菜单树列表
        """
        # 获取所有菜单
        query = Menu.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if application_uuid:
            query = query.filter(application_uuid=application_uuid)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        all_menus = await query.prefetch_related("parent", "children").order_by("sort_order", "created_at").all()
        
        # 构建菜单映射
        menu_map: Dict[int, MenuTreeResponse] = {}
        root_menus: List[MenuTreeResponse] = []
        
        # 第一遍：创建所有菜单的响应对象
        for menu in all_menus:
            menu_response = MenuTreeResponse.model_validate(menu)
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
        
        # 更新其他字段
        for key, value in update_data.items():
            if hasattr(menu, key):
                setattr(menu, key, value)
        
        await menu.save()
        
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
        
        return True

