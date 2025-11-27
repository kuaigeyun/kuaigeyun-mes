"""
角色服务模块

提供角色的 CRUD 操作和业务逻辑处理
"""

from typing import Optional, List, Dict, Any

from fastapi import HTTPException, status

from models.role import Role
from models.permission import Permission
from schemas.role import RoleCreate, RoleUpdate
from core.tenant_context import get_current_tenant_id, require_tenant_context


class RoleService:
    """
    角色服务类
    
    提供角色的 CRUD 操作和业务逻辑处理。
    所有查询自动过滤组织，所有创建操作自动设置 tenant_id。
    """
    
    async def create_role(
        self,
        data: RoleCreate,
        tenant_id: Optional[int] = None
    ) -> Role:
        """
        创建角色
        
        创建新角色并自动设置组织 ID。
        
        Args:
            data: 角色创建数据
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            Role: 创建的角色对象
            
        Raises:
            HTTPException: 当组织内角色名称或代码已存在时抛出
            
        Example:
            >>> service = RoleService()
            >>> role = await service.create_role(
            ...     RoleCreate(
            ...         name="管理员",
            ...         code="admin",
            ...         tenant_id=1
            ...     )
            ... )
        """
        # 获取组织 ID（从参数或上下文）
        if tenant_id is None:
            tenant_id = await require_tenant_context()
        
        # 检查组织内角色名称是否已存在
        existing_name = await Role.get_or_none(
            tenant_id=tenant_id,
            name=data.name
        )
        if existing_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该组织下角色名称已被使用"
            )
        
        # 检查组织内角色代码是否已存在
        existing_code = await Role.get_or_none(
            tenant_id=tenant_id,
            code=data.code
        )
        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该组织下角色代码已被使用"
            )
        
        # 创建角色（自动设置 tenant_id）⭐ 关键
        role = await Role.create(
            tenant_id=tenant_id,  # ⭐ 关键：自动设置组织 ID
            name=data.name,
            code=data.code,
            description=data.description,
            is_system=data.is_system,
        )
        
        return role
    
    async def get_role_by_id(
        self,
        role_id: int,
        tenant_id: Optional[int] = None
    ) -> Optional[Role]:
        """
        根据 ID 获取角色
        
        获取指定 ID 的角色，自动过滤组织。
        
        Args:
            role_id: 角色 ID
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            Optional[Role]: 角色对象，如果不存在或不属于当前组织则返回 None
            
        Example:
            >>> service = RoleService()
            >>> role = await service.get_role_by_id(1)
            >>> if role:
            ...     print(role.name)
        """
        # 获取组织 ID（从参数或上下文）
        if tenant_id is None:
            tenant_id = await require_tenant_context()
        
        # 查询角色（自动过滤组织）⭐ 关键
        role = await Role.get_or_none(
            id=role_id,
            tenant_id=tenant_id  # ⭐ 关键：自动过滤组织
        )
        
        return role
    
    async def list_roles(
        self,
        page: int = 1,
        page_size: int = 10,
        keyword: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取角色列表
        
        获取角色列表，支持分页和关键词搜索（支持拼音首字母搜索）。
        自动过滤组织：只返回当前组织的角色。
        
        Args:
            page: 页码（默认 1）
            page_size: 每页数量（默认 10）
            keyword: 关键词搜索（可选，搜索角色名称、代码、描述，支持拼音首字母搜索）
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            Dict[str, Any]: 包含 items、total、page、page_size 的字典
            
        Example:
            >>> service = RoleService()
            >>> result = await service.list_roles(
            ...     page=1,
            ...     page_size=20,
            ...     keyword="admin"
            ... )
            >>> len(result["items"]) >= 0
            True
        """
        from core.search_utils import list_with_search
        
        # 使用通用搜索工具（自动支持拼音首字母搜索）
        return await list_with_search(
            model=Role,
            page=page,
            page_size=page_size,
            keyword=keyword,
            search_fields=['name', 'code', 'description'],
            allowed_sort_fields=['name', 'code', 'created_at', 'updated_at'],
            default_sort='-created_at',
            tenant_id=tenant_id,
            skip_tenant_filter=False
        )
    
    async def update_role(
        self,
        role_id: int,
        data: RoleUpdate,
        tenant_id: Optional[int] = None
    ) -> Optional[Role]:
        """
        更新角色
        
        更新角色信息，自动验证组织权限。
        
        Args:
            role_id: 角色 ID
            data: 角色更新数据
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            Optional[Role]: 更新后的角色对象，如果不存在或不属于当前组织则返回 None
            
        Raises:
            HTTPException: 当角色名称或代码冲突时抛出
            
        Example:
            >>> service = RoleService()
            >>> role = await service.update_role(
            ...     1,
            ...     RoleUpdate(description="新描述")
            ... )
        """
        # 获取组织 ID（从参数或上下文）
        if tenant_id is None:
            tenant_id = await require_tenant_context()
        
        # 获取角色（自动验证组织权限）⭐ 关键
        role = await self.get_role_by_id(role_id, tenant_id)
        if not role:
            return None
        
        # 检查是否为系统角色（系统角色不可修改）
        if role.is_system and data.is_system is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="系统角色不可修改"
            )
        
        # 检查角色名称是否冲突（如果更新名称）
        if data.name and data.name != role.name:
            existing_name = await Role.get_or_none(
                tenant_id=tenant_id,
                name=data.name
            )
            if existing_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="该组织下角色名称已被使用"
                )
        
        # 检查角色代码是否冲突（如果更新代码）
        if data.code and data.code != role.code:
            existing_code = await Role.get_or_none(
                tenant_id=tenant_id,
                code=data.code
            )
            if existing_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="该组织下角色代码已被使用"
                )
        
        # 更新角色信息
        update_data = data.model_dump(exclude_unset=True)
        
        # 执行更新
        for key, value in update_data.items():
            setattr(role, key, value)
        
        await role.save()
        
        return role
    
    async def delete_role(
        self,
        role_id: int,
        tenant_id: Optional[int] = None
    ) -> bool:
        """
        删除角色
        
        删除角色，自动验证组织权限。
        系统角色不可删除。
        
        Args:
            role_id: 角色 ID
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            bool: 删除成功返回 True，否则返回 False
            
        Raises:
            HTTPException: 当角色是系统角色时抛出
            
        Example:
            >>> service = RoleService()
            >>> success = await service.delete_role(1)
            >>> success
            True
        """
        # 获取组织 ID（从参数或上下文）
        if tenant_id is None:
            tenant_id = await require_tenant_context()
        
        # 获取角色（自动验证组织权限）⭐ 关键
        role = await self.get_role_by_id(role_id, tenant_id)
        if not role:
            return False
        
        # 检查是否为系统角色（系统角色不可删除）
        if role.is_system:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="系统角色不可删除"
            )
        
        # 删除角色
        await role.delete()
        
        return True
    
    async def assign_permissions(
        self,
        role_id: int,
        permission_ids: List[int],
        tenant_id: Optional[int] = None
    ) -> Role:
        """
        分配权限给角色
        
        为角色分配权限列表，自动验证组织权限。
        
        Args:
            role_id: 角色 ID
            permission_ids: 权限 ID 列表
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            Role: 更新后的角色对象
            
        Raises:
            HTTPException: 当角色不存在或权限不属于当前组织时抛出
            
        Example:
            >>> service = RoleService()
            >>> role = await service.assign_permissions(1, [1, 2, 3])
        """
        # 获取组织 ID（从参数或上下文）
        if tenant_id is None:
            tenant_id = await require_tenant_context()
        
        # 获取角色（自动验证组织权限）⭐ 关键
        role = await self.get_role_by_id(role_id, tenant_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )
        
        # 获取权限（自动过滤组织）⭐ 关键
        permissions = await Permission.filter(
            id__in=permission_ids,
            tenant_id=tenant_id  # ⭐ 关键：自动过滤组织
        ).all()
        
        # 验证权限数量是否匹配（防止跨组织权限分配）
        if len(permissions) != len(permission_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="部分权限不存在或不属于当前组织"
            )
        
        # 分配权限（替换现有权限）
        await role.permissions.clear()
        await role.permissions.add(*permissions)
        
        # 重新加载角色以获取权限关系
        await role.fetch_related("permissions")
        
        return role
    
    async def get_role_permissions(
        self,
        role_id: int,
        tenant_id: Optional[int] = None
    ) -> List[Permission]:
        """
        获取角色权限列表
        
        获取角色的所有权限，自动过滤组织。
        
        Args:
            role_id: 角色 ID
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            List[Permission]: 权限列表（已过滤组织）
            
        Raises:
            HTTPException: 当角色不存在时抛出
        """
        # 获取组织 ID（从参数或上下文）
        if tenant_id is None:
            tenant_id = await require_tenant_context()
        
        # 获取角色（自动验证组织权限）⭐ 关键
        role = await self.get_role_by_id(role_id, tenant_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )
        
        # 获取角色的权限（自动过滤组织）⭐ 关键
        permissions = await role.permissions.filter(tenant_id=tenant_id).all()
        
        return permissions

