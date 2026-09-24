"""
用户权限服务模块

提供用户权限检查功能，基于RBAC模型。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import List, Set

from core.models.user_role import UserRole
from core.models.role import Role
from core.models.permission import Permission
from infra.models.user import User
from infra.exceptions.exceptions import AuthorizationError


class UserPermissionService:
    """
    用户权限服务类
    
    提供用户权限检查功能，基于RBAC模型。
    """

    ADMIN_ROLE_CODES = frozenset({"ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN"})
    ADMIN_ROLE_NAME = "系统管理员"

    @staticmethod
    def is_platform_or_tenant_admin(user: User) -> bool:
        """平台超管 / 平台管理员 / 组织管理员标志位（不含系统管理员角色）。"""
        return bool(
            getattr(user, "is_tenant_admin", False)
            or getattr(user, "is_infra_admin", False)
            or getattr(user, "_is_infra_superadmin", False)
        )

    @classmethod
    def is_admin_system_role(cls, role: object) -> bool:
        """系统管理员角色（与 RoleService / EffectiveAccess 共用）。"""
        code = (getattr(role, "code", None) or "").strip().upper()
        name = (getattr(role, "name", None) or "").strip()
        return code in cls.ADMIN_ROLE_CODES or name == cls.ADMIN_ROLE_NAME

    @classmethod
    async def is_admin_bypass_flags(
        cls,
        user_id: int,
        tenant_id: int,
        *,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
    ) -> bool:
        """平台/组织管理员 + 系统管理员角色（无 User 对象时的第三路径）。"""
        if is_infra_admin or is_tenant_admin:
            return True
        from core.services.authorization.effective_access_service import EffectiveAccessService

        access = await EffectiveAccessService.get(user_id, tenant_id)
        return access.is_admin_bypass

    @classmethod
    async def is_admin_bypass(cls, user: User, tenant_id: int) -> bool:
        """平台/组织管理员 + 系统管理员角色（与 permission-responsibility 三路径合一）。"""
        return await cls.is_admin_bypass_flags(
            user.id,
            tenant_id,
            is_infra_admin=cls.is_platform_or_tenant_admin(user),
            is_tenant_admin=bool(getattr(user, "is_tenant_admin", False)),
        )

    @staticmethod
    def _normalize_permission_code(code: str) -> str:
        return (code or "").strip().lower()

    @classmethod
    async def _get_all_tenant_permission_codes(cls, tenant_id: int) -> Set[str]:
        all_permissions = await Permission.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).all()
        return {
            normalized
            for normalized in (
                cls._normalize_permission_code(permission.code or "")
                for permission in all_permissions
                if permission.code
            )
            if normalized
        }
    
    @staticmethod
    async def get_user_permissions(
        user_id: int,
        tenant_id: int,
        include_inactive_roles: bool = False
    ) -> Set[str]:
        """
        获取用户的所有权限代码（多角色并集）。

        唯一真源：EffectiveAccessService（先合并角色授权，再供鉴权读取）。
        """
        from core.services.authorization.effective_access_service import EffectiveAccessService

        access = await EffectiveAccessService.get(
            user_id,
            tenant_id,
            include_inactive_roles=include_inactive_roles,
        )
        return set(access.permission_codes)    
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
        return UserPermissionService._normalize_permission_code(permission_code) in user_permissions
    
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
        user = await User.get_or_none(id=user_id)
        if user and await UserPermissionService.is_admin_bypass(user, tenant_id):
            return True

        user_permissions = await UserPermissionService.get_user_permissions(
            user_id=user_id,
            tenant_id=tenant_id,
            include_inactive_roles=include_inactive_roles
        )

        # 检查是否具有任意一个权限
        normalized_codes = {
            UserPermissionService._normalize_permission_code(c)
            for c in permission_codes
            if c and str(c).strip()
        }
        return bool(user_permissions & normalized_codes)
    
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
        user = await User.get_or_none(id=user_id)
        if user and await UserPermissionService.is_admin_bypass(user, tenant_id):
            return True

        user_permissions = await UserPermissionService.get_user_permissions(
            user_id=user_id,
            tenant_id=tenant_id,
            include_inactive_roles=include_inactive_roles
        )

        # 检查是否具有所有权限
        normalized_codes = {
            UserPermissionService._normalize_permission_code(c)
            for c in permission_codes
            if c and str(c).strip()
        }
        return normalized_codes.issubset(user_permissions)
    
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
