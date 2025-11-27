"""
权限管理 API 模块

提供权限管理的 RESTful API 接口
"""

from typing import Optional
from fastapi import APIRouter, Query, Depends

from schemas.permission import PermissionResponse, PermissionListResponse
from models.permission import Permission
from api.deps import get_current_user
from models.user import User
from core.tenant_context import get_current_tenant_id

# 创建路由
router = APIRouter(prefix="/permissions", tags=["Permissions"])


@router.get("", response_model=PermissionListResponse)
async def list_permissions(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(100, ge=1, le=1000, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键词搜索（权限名称、代码、资源）"),
    current_user: User = Depends(get_current_user)
):
    """
    获取权限列表接口
    
    获取权限列表，支持分页和关键词搜索。
    自动过滤组织：只返回当前组织的权限。
    
    Args:
        page: 页码（默认 1）
        page_size: 每页数量（默认 100，最大 1000）
        keyword: 关键词搜索（可选，搜索权限名称、代码、资源）
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        PermissionListResponse: 权限列表响应数据
        
    Example:
        ```
        GET /api/v1/permissions?page=1&page_size=100&keyword=user
        ```
    """
    # 从当前用户获取组织 ID（自动过滤）⭐ 关键
    tenant_id = current_user.tenant_id
    
    # 构建查询（自动过滤组织）⭐ 关键
    query = Permission.filter(tenant_id=tenant_id)
    
    # 关键词搜索
    if keyword:
        from tortoise.expressions import Q
        query = query.filter(
            Q(name__icontains=keyword) |
            Q(code__icontains=keyword) |
            Q(resource__icontains=keyword)
        )
    
    # 获取总数
    total = await query.count()
    
    # 分页查询
    offset = (page - 1) * page_size
    items = await query.offset(offset).limit(page_size).all()
    
    return PermissionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )

