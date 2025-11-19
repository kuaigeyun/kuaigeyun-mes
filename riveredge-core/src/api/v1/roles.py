"""
角色管理 API 模块

提供角色管理的 RESTful API 接口
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Depends, status, Body

from schemas.role import (
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    RoleListResponse,
)
from schemas.permission import PermissionResponse
from services.role_service import RoleService
from api.deps import get_current_user
from models.user import User

# 创建路由
router = APIRouter(prefix="/roles", tags=["Roles"])


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    current_user: User = Depends(get_current_user)
):
    """
    创建角色接口
    
    创建新角色并自动设置租户 ID。
    需要租户管理员或超级用户权限。
    
    Args:
        data: 角色创建数据（tenant_id 将从当前用户上下文自动获取，请求中的 tenant_id 将被忽略）
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        RoleResponse: 创建的角色对象
        
    Raises:
        HTTPException: 当租户内角色名称或代码已存在时抛出
        
    Example:
        ```json
        {
            "name": "管理员",
            "code": "admin",
            "description": "系统管理员角色",
            "is_system": false
        }
        ```
    """
    service = RoleService()
    
    # 从当前用户获取租户 ID（自动设置）⭐ 关键
    tenant_id = current_user.tenant_id
    
    # 创建角色数据副本，自动设置 tenant_id（忽略请求中的 tenant_id）
    role_data = RoleCreate(
        **data.model_dump(exclude={"tenant_id"}),
        tenant_id=tenant_id  # ⭐ 关键：自动设置当前用户的租户 ID
    )
    
    role = await service.create_role(role_data, tenant_id)
    return role


@router.get("", response_model=RoleListResponse)
async def list_roles(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键词搜索（角色名称、代码、描述）"),
    current_user: User = Depends(get_current_user)
):
    """
    获取角色列表接口
    
    获取角色列表，支持分页和关键词搜索。
    自动过滤租户：只返回当前租户的角色。
    
    Args:
        page: 页码（默认 1）
        page_size: 每页数量（默认 10，最大 100）
        keyword: 关键词搜索（可选，搜索角色名称、代码、描述）
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        RoleListResponse: 角色列表响应数据
        
    Example:
        ```
        GET /api/v1/roles?page=1&page_size=20&keyword=admin
        ```
    """
    service = RoleService()
    
    # 从当前用户获取租户 ID（自动过滤）⭐ 关键
    tenant_id = current_user.tenant_id
    
    result = await service.list_roles(
        page=page,
        page_size=page_size,
        keyword=keyword,
        tenant_id=tenant_id
    )
    
    return RoleListResponse(**result)


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    获取角色详情接口
    
    获取指定 ID 的角色信息，自动验证租户权限。
    
    Args:
        role_id: 角色 ID
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        RoleResponse: 角色详情
        
    Raises:
        HTTPException: 当角色不存在或不属于当前租户时抛出 404 错误
    """
    service = RoleService()
    
    # 从当前用户获取租户 ID（自动验证租户权限）⭐ 关键
    tenant_id = current_user.tenant_id
    
    role = await service.get_role_by_id(role_id, tenant_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    return role


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    data: RoleUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    更新角色接口
    
    更新角色信息，自动验证租户权限。
    系统角色不可修改。
    
    Args:
        role_id: 角色 ID
        data: 角色更新数据
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        RoleResponse: 更新后的角色对象
        
    Raises:
        HTTPException: 当角色不存在、不属于当前租户、是系统角色或数据冲突时抛出
    """
    service = RoleService()
    
    # 从当前用户获取租户 ID（自动验证租户权限）⭐ 关键
    tenant_id = current_user.tenant_id
    
    role = await service.update_role(role_id, data, tenant_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    删除角色接口
    
    删除角色，自动验证租户权限。
    系统角色不可删除。
    
    Args:
        role_id: 角色 ID
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        None: 删除成功返回 204 状态码
        
    Raises:
        HTTPException: 当角色不存在、不属于当前租户或是系统角色时抛出
    """
    service = RoleService()
    
    # 从当前用户获取租户 ID（自动验证租户权限）⭐ 关键
    tenant_id = current_user.tenant_id
    
    success = await service.delete_role(role_id, tenant_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在或不可删除"
        )
    
    return None


@router.post("/{role_id}/permissions", response_model=RoleResponse)
async def assign_permissions(
    role_id: int,
    permission_ids: List[int] = Body(..., description="权限 ID 列表"),
    current_user: User = Depends(get_current_user)
):
    """
    分配权限给角色接口
    
    为角色分配权限列表，自动验证租户权限。
    
    Args:
        role_id: 角色 ID
        permission_ids: 权限 ID 列表
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        RoleResponse: 更新后的角色对象
        
    Raises:
        HTTPException: 当角色不存在或权限不属于当前租户时抛出
        
    Example:
        ```json
        {
            "permission_ids": [1, 2, 3]
        }
        ```
    """
    service = RoleService()
    
    # 从当前用户获取租户 ID（自动验证租户权限）⭐ 关键
    tenant_id = current_user.tenant_id
    
    role = await service.assign_permissions(role_id, permission_ids, tenant_id)
    return role


@router.get("/{role_id}/permissions", response_model=List[PermissionResponse])
async def get_role_permissions(
    role_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    获取角色权限列表接口
    
    获取角色的所有权限，自动过滤租户。
    
    Args:
        role_id: 角色 ID
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        List[PermissionResponse]: 权限列表（已过滤租户）
        
    Raises:
        HTTPException: 当角色不存在时抛出
    """
    service = RoleService()
    
    # 从当前用户获取租户 ID（自动验证租户权限）⭐ 关键
    tenant_id = current_user.tenant_id
    
    permissions = await service.get_role_permissions(role_id, tenant_id)
    return permissions

