"""
权限检查服务模块

提供权限验证相关的业务逻辑，包括用户权限查询、权限验证等功能
"""

from typing import List, Optional

from fastapi import HTTPException, status

from models.user import User
from models.role import Role
from models.permission import Permission
from core.tenant_context import get_current_tenant_id


class PermissionService:
    """
    权限检查服务类
    
    提供权限验证相关的业务逻辑处理。
    所有权限查询自动过滤组织。
    """
    
    async def get_user_permissions(
        self,
        user: User,
        tenant_id: Optional[int] = None
    ) -> List[Permission]:
        """
        获取用户权限列表
        
        查询用户的所有权限（通过角色关联）。
        自动过滤组织：只返回当前组织内的权限。
        
        Args:
            user: 用户对象
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            List[Permission]: 用户权限列表（已过滤组织）
            
        Example:
            >>> service = PermissionService()
            >>> permissions = await service.get_user_permissions(user)
            >>> len(permissions) >= 0
            True
        """
        if tenant_id is None:
            tenant_id = get_current_tenant_id()
        
        # 平台管理员可以访问所有组织的权限（但这里只返回当前组织的权限）
        if user.is_platform_admin_user():
            return await Permission.filter(tenant_id=tenant_id).all()
        
        # 组织管理员返回当前组织的所有权限
        if user.is_organization_admin():
            return await Permission.filter(tenant_id=tenant_id).all()
        
        # 获取用户的所有角色（自动过滤组织）
        roles = await user.roles.filter(tenant_id=tenant_id).all()
        
        # 获取所有角色的权限（去重）
        permissions = []
        permission_ids = set()
        
        for role in roles:
            role_permissions = await role.permissions.filter(tenant_id=tenant_id).all()
            for permission in role_permissions:
                if permission.id not in permission_ids:
                    permissions.append(permission)
                    permission_ids.add(permission.id)
        
        return permissions
    
    async def check_permission(
        self,
        user: User,
        permission_code: str,
        tenant_id: Optional[int] = None
    ) -> bool:
        """
        检查用户是否具有指定权限
        
        验证用户是否具有指定的权限代码。
        自动过滤组织：只检查当前组织内的权限。
        
        Args:
            user: 用户对象
            permission_code: 权限代码（格式：resource:action）
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            bool: 如果用户具有权限返回 True，否则返回 False
            
        Example:
            >>> service = PermissionService()
            >>> has_permission = await service.check_permission(
            ...     user,
            ...     "user:create"
            ... )
            >>> isinstance(has_permission, bool)
            True
        """
        if tenant_id is None:
            tenant_id = get_current_tenant_id()
        
        # 平台管理员和组织管理员拥有所有权限
        if user.is_platform_admin_user() or user.is_organization_admin():
            return True
        
        # 获取用户权限
        permissions = await self.get_user_permissions(user, tenant_id)
        
        # 检查是否具有指定权限
        for permission in permissions:
            if permission.code == permission_code:
                return True
        
        return False
    
    async def require_permission(
        self,
        user: User,
        permission_code: str,
        tenant_id: Optional[int] = None
    ) -> None:
        """
        要求用户具有指定权限（否则抛出异常）
        
        验证用户是否具有指定的权限代码，如果没有则抛出 403 错误。
        自动过滤组织：只检查当前组织内的权限。
        
        Args:
            user: 用户对象
            permission_code: 权限代码（格式：resource:action）
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Raises:
            HTTPException: 当用户不具有指定权限时抛出 403 错误
            
        Example:
            >>> service = PermissionService()
            >>> await service.require_permission(user, "user:create")
            >>> # 如果没有权限，会抛出 HTTPException
        """
        has_permission = await self.check_permission(user, permission_code, tenant_id)
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"权限不足：需要 {permission_code} 权限"
            )
    
    async def get_role_permissions(
        self,
        role: Role,
        tenant_id: Optional[int] = None
    ) -> List[Permission]:
        """
        获取角色权限列表
        
        查询角色的所有权限。
        自动过滤组织：只返回当前组织内的权限。
        
        Args:
            role: 角色对象
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            List[Permission]: 角色权限列表（已过滤组织）
            
        Example:
            >>> service = PermissionService()
            >>> permissions = await service.get_role_permissions(role)
            >>> len(permissions) >= 0
            True
        """
        if tenant_id is None:
            tenant_id = get_current_tenant_id()
        
        # 获取角色的权限（自动过滤组织）
        return await role.permissions.filter(tenant_id=tenant_id).all()
    
    async def check_user_role(
        self,
        user: User,
        role_code: str,
        tenant_id: Optional[int] = None
    ) -> bool:
        """
        检查用户是否具有指定角色
        
        验证用户是否具有指定的角色代码。
        自动过滤组织：只检查当前组织内的角色。
        
        Args:
            user: 用户对象
            role_code: 角色代码
            tenant_id: 组织 ID（可选，默认从上下文获取）
            
        Returns:
            bool: 如果用户具有角色返回 True，否则返回 False
            
        Example:
            >>> service = PermissionService()
            >>> has_role = await service.check_user_role(user, "admin")
            >>> isinstance(has_role, bool)
            True
        """
        if tenant_id is None:
            tenant_id = get_current_tenant_id()
        
        # 获取用户的所有角色（自动过滤组织）
        roles = await user.roles.filter(tenant_id=tenant_id).all()
        
        # 检查是否具有指定角色
        for role in roles:
            if role.code == role_code:
                return True
        
        return False
    
    async def is_platform_admin(
        self,
        user: User
    ) -> bool:
        """
        检查用户是否为平台管理员（系统级超级管理员，可跨组织）
        
        验证用户是否为平台管理员（系统级超级管理员）。
        注意：此方法不检查组织，因为平台管理员可以跨组织访问。
        
        Args:
            user: 用户对象
            
        Returns:
            bool: 如果用户是平台管理员返回 True，否则返回 False
        """
        return user.is_platform_admin_user()
    
    async def is_organization_admin(
        self,
        user: User
    ) -> bool:
        """
        检查用户是否为组织管理员
        
        验证用户是否为组织管理员。
        
        Args:
            user: 用户对象
            
        Returns:
            bool: 如果用户是组织管理员返回 True，否则返回 False
        """
        return user.is_organization_admin()
    
    async def is_super_admin(
        self,
        user: User
    ) -> bool:
        """
        检查用户是否为超级管理员（可跨组织）
        
        已废弃：请使用 is_platform_admin() 方法。
        此方法保留用于向后兼容。
        
        Args:
            user: 用户对象
            
        Returns:
            bool: 如果用户是平台管理员返回 True，否则返回 False
        """
        return user.is_platform_admin_user()
    
    async def can_access_tenant(
        self,
        user: User,
        target_tenant_id: int
    ) -> bool:
        """
        检查用户是否可以访问指定组织
        
        验证用户是否可以访问指定的组织。
        普通用户只能访问自己的组织，超级管理员可以访问所有组织。
        
        Args:
            user: 用户对象
            target_tenant_id: 目标组织 ID
            
        Returns:
            bool: 如果用户可以访问返回 True，否则返回 False
            
        Example:
            >>> service = PermissionService()
            >>> can_access = await service.can_access_tenant(user, 1)
            >>> isinstance(can_access, bool)
            True
        """
        # 平台管理员可以访问所有组织
        if user.is_platform_admin_user():
            return True
        
        # 组织管理员和普通用户只能访问自己的组织
        return user.tenant_id == target_tenant_id

