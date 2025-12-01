"""
权限服务模块

提供权限的查询功能。
"""

from typing import Optional, List
from tortoise.expressions import Q

from tree_root.models.permission import Permission, PermissionType
from tree_root.models.role import Role
from soil.exceptions.exceptions import NotFoundError


class PermissionService:
    """
    权限服务类
    
    提供权限的查询功能。
    """
    
    @staticmethod
    async def get_permission_list(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        resource: Optional[str] = None,
        permission_type: Optional[str] = None,
    ) -> dict:
        """
        获取权限列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            keyword: 关键词搜索
            resource: 资源筛选
            permission_type: 权限类型筛选
            
        Returns:
            dict: 包含权限列表和分页信息
        """
        # 构建查询
        query = Permission.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        
        # 关键词搜索
        if keyword:
            query = query.filter(
                Q(name__icontains=keyword) |
                Q(code__icontains=keyword) |
                Q(description__icontains=keyword)
            )
        
        # 筛选
        if resource:
            query = query.filter(resource=resource)
        
        if permission_type:
            query = query.filter(permission_type=permission_type)
        
        # 分页
        total = await query.count()
        permissions = await query.offset((page - 1) * page_size).limit(page_size).all()
        
        # 获取关联的角色数量
        result = []
        for permission in permissions:
            # 获取关联的角色数量
            role_count = await Role.filter(
                permissions__id=permission.id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).count()
            
            result.append({
                "uuid": permission.uuid,
                "name": permission.name,
                "code": permission.code,
                "resource": permission.resource,
                "action": permission.action,
                "description": permission.description,
                "permission_type": permission.permission_type,
                "role_count": role_count,
                "created_at": permission.created_at,
            })
        
        return {
            "items": result,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    
    @staticmethod
    async def get_permission_by_uuid(
        tenant_id: int,
        permission_uuid: str
    ) -> Permission:
        """
        根据UUID获取权限详情
        
        Args:
            tenant_id: 组织ID
            permission_uuid: 权限UUID
            
        Returns:
            Permission: 权限对象
            
        Raises:
            NotFoundError: 当权限不存在时抛出
        """
        permission = await Permission.filter(
            uuid=permission_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).prefetch_related('roles').first()
        
        if not permission:
            raise NotFoundError("权限", permission_uuid)
        
        return permission

