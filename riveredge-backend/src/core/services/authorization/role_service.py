"""
角色服务模块

提供角色的 CRUD 操作和权限分配功能。
"""

from typing import Optional, List
from tortoise.expressions import Q

from core.models.role import Role
from core.models.permission import Permission
from core.models.user_role import UserRole
from core.schemas.role import RoleCreate, RoleUpdate
from core.services.authorization.permission_version_service import PermissionVersionService
from infra.exceptions.exceptions import NotFoundError, ValidationError, AuthorizationError

# 向后兼容别名
PermissionDeniedError = AuthorizationError


class RoleService:
    """
    角色服务类
    
    提供角色的 CRUD 操作和权限分配功能。
    """
    
    @staticmethod
    def _is_admin_system_role(role: Role) -> bool:
        """
        判断是否为“系统管理员”角色（允许管理权限）。

        仅对该角色放开系统角色的权限编辑限制，避免影响其他系统内置角色。
        """
        role_code = (role.code or "").strip().upper()
        role_name = (role.name or "").strip()
        return role_code in {"ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"} or role_name == "系统管理员"

    @staticmethod
    async def create_role(
        tenant_id: int,
        data: RoleCreate,
        current_user_id: int
    ) -> Role:
        """
        创建角色
        
        Args:
            tenant_id: 组织ID
            data: 角色创建数据
            current_user_id: 当前用户ID
            
        Returns:
            Role: 创建的角色对象
            
        Raises:
            ValidationError: 当角色代码已存在时抛出
            AuthorizationError: 当用户无权限时抛出
        """
        # 验证权限（需要组织管理员或超级用户）
        # TODO: 实现权限验证逻辑
        
        # 检查角色代码是否已存在
        existing_role = await Role.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing_role:
            raise ValidationError(f"角色代码 {data.code} 已存在")
        
        # 创建角色
        role = await Role.create(
            tenant_id=tenant_id,
            name=data.name,
            code=data.code,
            description=data.description,
            is_active=data.is_active if data.is_active is not None else True,
            is_system=False,  # 系统角色只能由系统创建
        )
        
        return role
    
    @staticmethod
    async def get_role_list(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        name: Optional[str] = None,
        code: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_system: Optional[bool] = None,
    ) -> dict:
        """
        获取角色列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            keyword: 关键词搜索
            is_active: 是否启用筛选
            is_system: 是否系统角色筛选
            
        Returns:
            dict: 包含角色列表和分页信息
        """
        from core.utils.search_utils import list_with_search
        
        # 构建精确匹配条件
        exact_filters = {'deleted_at__isnull': True}
        if is_active is not None:
            exact_filters['is_active'] = is_active
        if is_system is not None:
            exact_filters['is_system'] = is_system
        
        # 字段搜索（用于高级搜索）
        if name:
            exact_filters['name__icontains'] = name
        if code:
            exact_filters['code__icontains'] = code
        
        # 使用通用搜索工具（自动支持拼音首字母搜索）
        search_result = await list_with_search(
            model=Role,
            page=page,
            page_size=page_size,
            keyword=keyword,
            search_fields=['name', 'code', 'description'],
            exact_filters=exact_filters if exact_filters else None,
            allowed_sort_fields=['name', 'code', 'is_active', 'is_system', 'created_at', 'updated_at'],
            default_sort='-created_at',
            tenant_id=tenant_id,
            skip_tenant_filter=False
        )
        
        # 获取搜索结果的角色对象
        roles = search_result["items"]
        
        # 获取关联的权限数量和用户数量
        result = []
        for role in roles:
            # 暂时注释掉权限预加载，避免多对多关系查询问题
            # await role.fetch_related('permissions')
            permission_count = 0  # 暂时设为0
            
            # 获取用户数量
            user_count = await UserRole.filter(role_id=role.id).count()
            
            result.append({
                "uuid": role.uuid,
                "name": role.name,
                "code": role.code,
                "description": role.description,
                "is_system": role.is_system,
                "is_active": role.is_active,
                "permission_count": permission_count,
                "user_count": user_count,
                "created_at": role.created_at,
            })
        
        return {
            "items": result,
            "total": search_result["total"],
            "page": search_result["page"],
            "page_size": search_result["page_size"],
        }
    
    @staticmethod
    async def get_role_by_uuid(
        tenant_id: int,
        role_uuid: str
    ) -> Role:
        """
        根据UUID获取角色详情
        
        Args:
            tenant_id: 组织ID
            role_uuid: 角色UUID
            
        Returns:
            Role: 角色对象
            
        Raises:
            NotFoundError: 当角色不存在时抛出
        """
        # 不再使用 prefetch_related('permissions')，避免多对多关系查询问题
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not role:
            raise NotFoundError("角色", role_uuid)
        
        return role
    
    @staticmethod
    async def update_role(
        tenant_id: int,
        role_uuid: str,
        data: RoleUpdate,
        current_user_id: int
    ) -> Role:
        """
        更新角色
        
        Args:
            tenant_id: 组织ID
            role_uuid: 角色UUID
            data: 角色更新数据
            current_user_id: 当前用户ID
            
        Returns:
            Role: 更新后的角色对象
            
        Raises:
            NotFoundError: 当角色不存在时抛出
            ValidationError: 当角色代码已存在时抛出
            AuthorizationError: 当系统角色不可修改时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取角色
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not role:
            raise NotFoundError("角色", role_uuid)
        
        # 检查系统角色
        if role.is_system:
            raise AuthorizationError("系统角色不可修改")
        
        # 如果更新代码，检查是否已存在
        if data.code and data.code != role.code:
            existing_role = await Role.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).exclude(id=role.id).first()
            
            if existing_role:
                raise ValidationError(f"角色代码 {data.code} 已存在")
        
        # 更新角色
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(role, key, value)
        
        await role.save()
        
        return role
    
    @staticmethod
    async def delete_role(
        tenant_id: int,
        role_uuid: str,
        current_user_id: int
    ) -> None:
        """
        删除角色
        
        Args:
            tenant_id: 组织ID
            role_uuid: 角色UUID
            current_user_id: 当前用户ID
            
        Raises:
            NotFoundError: 当角色不存在时抛出
            ValidationError: 当角色有关联用户时抛出
            AuthorizationError: 当系统角色不可删除时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取角色
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not role:
            raise NotFoundError("角色", role_uuid)
        
        # 检查系统角色
        if role.is_system:
            raise AuthorizationError("系统角色不可删除")
        
        # 检查是否有关联用户
        user_count = await UserRole.filter(role_id=role.id).count()
        if user_count > 0:
            raise ValidationError(f"角色下有关联用户（{user_count}人），无法删除")
        
        # 软删除
        from datetime import datetime
        role.deleted_at = datetime.now()
        await role.save()
    
    @staticmethod
    async def assign_permissions(
        tenant_id: int,
        role_uuid: str,
        permission_uuids: List[str],
        current_user_id: int
    ) -> dict:
        """
        分配权限给角色
        
        Args:
            tenant_id: 组织ID
            role_uuid: 角色UUID
            permission_uuids: 权限UUID列表
            current_user_id: 当前用户ID
            
        Returns:
            dict: 操作结果
            
        Raises:
            NotFoundError: 当角色不存在时抛出
            ValidationError: 当权限不属于当前组织时抛出
            AuthorizationError: 当系统角色不可修改权限时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取角色
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not role:
            raise NotFoundError("角色", role_uuid)
        
        # 检查系统角色：仅“系统管理员”允许调整权限
        if role.is_system and not RoleService._is_admin_system_role(role):
            raise AuthorizationError("系统角色不可修改权限")
        
        # 验证权限属于当前组织并转换为ID
        if permission_uuids:
            permissions = await Permission.filter(
                uuid__in=permission_uuids,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            
            if len(permissions) != len(permission_uuids):
                raise ValidationError("部分权限不存在或不属于当前组织")
            
            permission_ids = [p.id for p in permissions]
        else:
            permission_ids = []
        
        # 通过 RolePermission 关联表获取当前角色的权限
        from core.models.role_permission import RolePermission
        current_role_permissions = await RolePermission.filter(role_id=role.id).all()
        current_permission_ids = {rp.permission_id for rp in current_role_permissions}
        new_permission_ids = set(permission_ids)
        
        # 计算需要添加和移除的权限
        to_add = new_permission_ids - current_permission_ids
        to_remove = current_permission_ids - new_permission_ids
        
        # 添加权限（通过 RolePermission 关联表）
        if to_add:
            from datetime import datetime
            role_permissions_to_add = [
                RolePermission(
                    role_id=role.id,
                    permission_id=permission_id,
                    created_at=datetime.now()
                )
                for permission_id in to_add
            ]
            await RolePermission.bulk_create(role_permissions_to_add, ignore_conflicts=True)
        
        # 移除权限（通过 RolePermission 关联表）
        if to_remove:
            await RolePermission.filter(
                role_id=role.id,
                permission_id__in=list(to_remove)
            ).delete()
        
        # 角色权限变更后，自动更新关联菜单的可见性
        # 获取变更的权限代码
        changed_permission_codes = []
        if to_add and permission_uuids:
            # 获取添加的权限对象
            added_permissions = [p for p in permissions if p.id in to_add]
            changed_permission_codes.extend([p.code for p in added_permissions])
        if to_remove:
            # 获取移除的权限对象（从数据库中查询）
            removed_permissions = await Permission.filter(
                id__in=list(to_remove),
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            changed_permission_codes.extend([p.code for p in removed_permissions])
        
        # 更新关联菜单的可见性（异步，不阻塞主流程）
        if changed_permission_codes:
            import asyncio
            from core.services.system.menu_service import MenuService
            for permission_code in changed_permission_codes:
                asyncio.create_task(
                    MenuService.update_menus_by_permission_code(
                        tenant_id=tenant_id,
                        permission_code=permission_code
                    )
                )
        # 权限变更后 bump 租户级版本，驱动缓存失效
        await PermissionVersionService.bump(tenant_id=tenant_id, user_id=None)
        
        return {
            "success": True,
            "message": "权限分配成功",
            "added_count": len(to_add),
            "removed_count": len(to_remove),
        }
    
    @staticmethod
    async def get_role_permissions(
        tenant_id: int,
        role_uuid: str
    ) -> List[Permission]:
        """
        获取角色关联的权限列表
        
        Args:
            tenant_id: 组织ID
            role_uuid: 角色UUID
            
        Returns:
            List[Permission]: 权限列表（仅包含未删除的权限）
            
        Raises:
            NotFoundError: 当角色不存在时抛出
        """
        # 获取角色
        role = await Role.filter(
            uuid=role_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not role:
            raise NotFoundError("角色", role_uuid)
        
        # 通过 RolePermission 关联表查询权限
        from core.models.role_permission import RolePermission
        role_permissions = await RolePermission.filter(role_id=role.id).all()
        permission_ids = [rp.permission_id for rp in role_permissions]

        # 查询权限（仅未删除的）
        if permission_ids:
            permissions = await Permission.filter(
                id__in=permission_ids,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
        else:
            # “系统管理员”默认拥有全量权限：当未显式绑定时回显全量权限用于前端默认全选。
            if RoleService._is_admin_system_role(role):
                permissions = await Permission.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).all()
            else:
                permissions = []
        
        return list(permissions)
