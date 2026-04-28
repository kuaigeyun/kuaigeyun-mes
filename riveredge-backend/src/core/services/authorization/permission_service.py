"""
权限服务模块

提供权限的查询功能。
"""

from typing import Optional, List
from tortoise.expressions import Q

from core.models.permission import Permission, PermissionType
from core.models.role import Role
from core.models.role_permission import RolePermission
from core.services.authorization.permission_registry_service import PermissionRegistryService
from infra.infrastructure.database.database import get_db_connection
from infra.exceptions.exceptions import NotFoundError


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
        name: Optional[str] = None,
        code: Optional[str] = None,
        resource: Optional[str] = None,
        permission_type: Optional[str] = None,
        exclude_derived_data: bool = False,
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
        query = Permission.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            deprecated_at__isnull=True,
        )
        # 仅展示“权限真源”（核心常量 + 启用应用 manifest）中的权限，屏蔽历史遗留脏数据。
        # 这样可从后端源头消除“未挂载到菜单”的幽灵权限，无需前端补丁兜底。
        desired_definitions = await PermissionRegistryService.collect_definitions(tenant_id=tenant_id)
        desired_codes = sorted(desired_definitions.keys())
        if desired_codes:
            query = query.filter(code__in=desired_codes)
        else:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
            }
        dormant_app_codes = await PermissionService._get_dormant_app_codes(tenant_id=tenant_id)
        if dormant_app_codes:
            dormant_q = Q()
            for app_code in dormant_app_codes:
                dormant_q |= Q(code=app_code) | Q(code__startswith=f"{app_code}:")
            query = query.exclude(dormant_q)
        
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
        else:
            # 三层模型默认仅返回功能权限，数据/字段策略走独立策略 API。
            query = query.filter(permission_type=PermissionType.FUNCTION)

        # 过滤自动派生数据权限（来源：PermissionRegistryService._derive_data_scope_permissions）
        if exclude_derived_data:
            query = query.exclude(source_type="derived", source_path="data-scope")

        if name:
            query = query.filter(name__icontains=name)
        
        if code:
            query = query.filter(code__icontains=code)
        
        # 分页（不在 annotate 里跨 role_permissions→role 过滤：Tortoise 会生成缺失 JOIN 的 SQL）
        total = await query.count()
        # 分页必须使用稳定排序，否则多页拉取会出现重复/漏项，导致权限树节点随机丢失
        ordered_query = query.order_by("code", "id")
        permissions = await ordered_query.offset((page - 1) * page_size).limit(page_size).all()
        perm_ids = [p.id for p in permissions]
        role_count_map: dict[int, int] = {pid: 0 for pid in perm_ids}
        if perm_ids:
            links = await RolePermission.filter(permission_id__in=perm_ids).select_related("role")
            for rp in links:
                rel_role = getattr(rp, "role", None)
                if rel_role is None or rel_role.deleted_at is not None:
                    continue
                if rel_role.tenant_id != tenant_id:
                    continue
                pid = rp.permission_id
                if pid in role_count_map:
                    role_count_map[pid] += 1

        # 构建返回结果
        result = []
        for permission in permissions:
            result.append({
                "uuid": permission.uuid,
                "name": permission.name,
                "code": permission.code,
                "resource": permission.resource,
                "action": permission.action,
                "description": permission.description,
                "permission_type": permission.permission_type,
                "role_count": role_count_map.get(permission.id, 0),
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
            deleted_at__isnull=True,
            deprecated_at__isnull=True,
        ).prefetch_related('roles').first()
        
        if not permission:
            raise NotFoundError("权限", permission_uuid)

        dormant_app_codes = await PermissionService._get_dormant_app_codes(tenant_id=tenant_id)
        prefix = permission.code.split(":", 1)[0] if ":" in permission.code else permission.code
        if prefix in dormant_app_codes:
            raise NotFoundError("权限", permission_uuid)
        
        return permission

    @staticmethod
    async def _get_dormant_app_codes(tenant_id: int) -> set[str]:
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT code, is_installed, is_active
                FROM core_applications
                WHERE tenant_id = $1
                  AND deleted_at IS NULL
                """,
                tenant_id,
            )
            all_codes = {str(r["code"]).strip() for r in rows if str(r["code"]).strip()}
            enabled_codes = {
                str(r["code"]).strip()
                for r in rows
                if str(r["code"]).strip() and bool(r["is_installed"]) and bool(r["is_active"])
            }
            return all_codes - enabled_codes
        finally:
            await conn.close()

