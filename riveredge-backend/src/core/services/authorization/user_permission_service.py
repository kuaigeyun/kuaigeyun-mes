"""
用户权限服务模块

提供用户权限检查功能，基于RBAC模型。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import List, Set, Optional
from tortoise.expressions import Q

from core.models.user_role import UserRole
from core.models.role_permission import RolePermission
from core.models.role import Role
from core.models.permission import Permission
from infra.models.user import User
from infra.exceptions.exceptions import AuthorizationError


class UserPermissionService:
    """
    用户权限服务类
    
    提供用户权限检查功能，基于RBAC模型。
    """
    
    @staticmethod
    async def get_user_permissions(
        user_id: int,
        tenant_id: int,
        include_inactive_roles: bool = False
    ) -> Set[str]:
        """
        获取用户的所有权限代码
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID
            include_inactive_roles: 是否包含非激活角色的权限
            
        Returns:
            Set[str]: 权限代码集合
        """
        # 获取用户的所有角色（通过UserRole关联表）
        # 注意：UserRole表可能没有tenant_id字段，需要通过role的tenant_id过滤
        user_roles_query = UserRole.filter(user_id=user_id)
        
        # 通过role的tenant_id过滤
        user_roles = await user_roles_query.prefetch_related('role').all()
        
        # 过滤出当前租户的角色
        user_roles = [ur for ur in user_roles if ur.role and ur.role.tenant_id == tenant_id]
        
        if not include_inactive_roles:
            # 只获取激活的角色
            user_roles = [ur for ur in user_roles if ur.role.is_active]
        
        if not user_roles:
            return set()
        
        # 获取所有角色的权限
        role_ids = [ur.role_id for ur in user_roles]
        
        # 获取角色权限关联（RolePermission表可能没有tenant_id字段，需要通过permission的tenant_id过滤）
        role_permissions_query = RolePermission.filter(role_id__in=role_ids)
        role_permissions = await role_permissions_query.prefetch_related('permission').all()
        
        # 过滤出当前租户的权限
        role_permissions = [rp for rp in role_permissions if rp.permission and rp.permission.tenant_id == tenant_id]
        
        # 提取权限代码
        permission_codes = set()
        for rp in role_permissions:
            if rp.permission and rp.permission.deleted_at is None:
                permission_codes.add(rp.permission.code)
        
        return permission_codes
    
    @staticmethod
    async def has_permission(
        user_id: int,
        tenant_id: int,
        permission_code: str,
        include_inactive_roles: bool = False
    ) -> bool:
        """
        检查用户是否具有指定权限
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID
            permission_code: 权限代码（格式：resource:action）
            include_inactive_roles: 是否包含非激活角色的权限
            
        Returns:
            bool: 如果用户具有权限则返回True，否则返回False
        """
        # 如果是组织管理员或平台管理员，默认拥有所有权限
        user = await User.get_or_none(id=user_id)
        if user:
            if user.is_tenant_admin or user.is_infra_admin:
                return True
        
        # 获取用户的所有权限
        user_permissions = await UserPermissionService.get_user_permissions(
            user_id=user_id,
            tenant_id=tenant_id,
            include_inactive_roles=include_inactive_roles
        )
        
        # 检查是否具有指定权限
        return permission_code in user_permissions
    
    @staticmethod
    async def has_any_permission(
        user_id: int,
        tenant_id: int,
        permission_codes: List[str],
        include_inactive_roles: bool = False
    ) -> bool:
        """
        检查用户是否具有任意一个权限
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID
            permission_codes: 权限代码列表
            include_inactive_roles: 是否包含非激活角色的权限
            
        Returns:
            bool: 如果用户具有任意一个权限则返回True，否则返回False
        """
        # 如果是组织管理员或平台管理员，默认拥有所有权限
        user = await User.get_or_none(id=user_id)
        if user:
            if user.is_tenant_admin or user.is_infra_admin:
                return True
        
        # 获取用户的所有权限
        user_permissions = await UserPermissionService.get_user_permissions(
            user_id=user_id,
            tenant_id=tenant_id,
            include_inactive_roles=include_inactive_roles
        )
        
        # 检查是否具有任意一个权限
        return bool(user_permissions & set(permission_codes))
    
    @staticmethod
    async def has_all_permissions(
        user_id: int,
        tenant_id: int,
        permission_codes: List[str],
        include_inactive_roles: bool = False
    ) -> bool:
        """
        检查用户是否具有所有权限
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID
            permission_codes: 权限代码列表
            include_inactive_roles: 是否包含非激活角色的权限
            
        Returns:
            bool: 如果用户具有所有权限则返回True，否则返回False
        """
        # 如果是组织管理员或平台管理员，默认拥有所有权限
        user = await User.get_or_none(id=user_id)
        if user:
            if user.is_tenant_admin or user.is_infra_admin:
                return True
        
        # 获取用户的所有权限
        user_permissions = await UserPermissionService.get_user_permissions(
            user_id=user_id,
            tenant_id=tenant_id,
            include_inactive_roles=include_inactive_roles
        )
        
        # 检查是否具有所有权限
        return set(permission_codes).issubset(user_permissions)
    
    @staticmethod
    async def get_user_roles(
        user_id: int,
        tenant_id: int,
        include_inactive: bool = False
    ) -> List[Role]:
        """
        获取用户的所有角色
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID
            include_inactive: 是否包含非激活角色
            
        Returns:
            List[Role]: 角色列表
        """
        # 获取用户的所有角色（通过UserRole关联表）
        user_roles_query = UserRole.filter(user_id=user_id)
        user_roles = await user_roles_query.prefetch_related('role').all()
        
        # 过滤出当前租户的角色
        user_roles = [ur for ur in user_roles if ur.role and ur.role.tenant_id == tenant_id]
        
        if not include_inactive:
            # 只获取激活的角色
            user_roles = [ur for ur in user_roles if ur.role.is_active]
        
        return [ur.role for ur in user_roles if ur.role]
    
    @staticmethod
    async def require_permission(
        user_id: int,
        tenant_id: int,
        permission_code: str,
        include_inactive_roles: bool = False
    ):
        """
        要求用户具有指定权限，否则抛出异常
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID
            permission_code: 权限代码
            include_inactive_roles: 是否包含非激活角色的权限
            
        Raises:
            AuthorizationError: 当用户不具有权限时抛出
        """
        has_perm = await UserPermissionService.has_permission(
            user_id=user_id,
            tenant_id=tenant_id,
            permission_code=permission_code,
            include_inactive_roles=include_inactive_roles
        )
        
        if not has_perm:
            raise AuthorizationError(f"用户不具有权限: {permission_code}")
    
    @staticmethod
    async def require_any_permission(
        user_id: int,
        tenant_id: int,
        permission_codes: List[str],
        include_inactive_roles: bool = False
    ):
        """
        要求用户具有任意一个权限，否则抛出异常
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID
            permission_codes: 权限代码列表
            include_inactive_roles: 是否包含非激活角色的权限
            
        Raises:
            AuthorizationError: 当用户不具有任意一个权限时抛出
        """
        has_perm = await UserPermissionService.has_any_permission(
            user_id=user_id,
            tenant_id=tenant_id,
            permission_codes=permission_codes,
            include_inactive_roles=include_inactive_roles
        )
        
        if not has_perm:
            raise AuthorizationError(f"用户不具有以下任意一个权限: {', '.join(permission_codes)}")
    
    @staticmethod
    async def require_all_permissions(
        user_id: int,
        tenant_id: int,
        permission_codes: List[str],
        include_inactive_roles: bool = False
    ):
        """
        要求用户具有所有权限，否则抛出异常
        
        Args:
            user_id: 用户ID
            tenant_id: 租户ID
            permission_codes: 权限代码列表
            include_inactive_roles: 是否包含非激活角色的权限
            
        Raises:
            AuthorizationError: 当用户不具有所有权限时抛出
        """
        has_perm = await UserPermissionService.has_all_permissions(
            user_id=user_id,
            tenant_id=tenant_id,
            permission_codes=permission_codes,
            include_inactive_roles=include_inactive_roles
        )
        
        if not has_perm:
            raise AuthorizationError(f"用户不具有以下所有权限: {', '.join(permission_codes)}")
