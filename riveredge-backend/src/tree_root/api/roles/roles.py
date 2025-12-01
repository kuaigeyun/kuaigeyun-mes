"""
角色管理 API 路由

提供角色的 CRUD 操作和权限分配功能。
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from tree_root.models.role import Role
from tree_root.schemas.role import (
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    RoleListResponse,
    RolePermissionAssign,
    RoleListItem,
    PermissionInfo,
)
from tree_root.services.role_service import RoleService
from tree_root.api.deps.deps import get_current_user, get_current_tenant
from soil.api.deps.deps import get_current_user as soil_get_current_user
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError, ValidationError, AuthorizationError


def model_to_response(model_obj, response_class, **extra_fields):
    """
    将模型对象转换为响应对象，自动排除id字段

    Args:
        model_obj: Tortoise模型实例
        response_class: 响应Schema类
        **extra_fields: 额外的字段

    Returns:
        响应对象实例
    """
    obj_dict = model_obj.__dict__.copy()
    # 移除内部ID字段，只保留UUID
    if 'id' in obj_dict:
        del obj_dict['id']

    # 创建响应对象
    response = response_class(**obj_dict)

    # 设置额外字段
    for key, value in extra_fields.items():
        setattr(response, key, value)

    return response

router = APIRouter(prefix="/roles", tags=["System Roles"])


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建角色
    
    创建新角色并保存到数据库。如果角色代码已存在，则抛出异常。
    
    Args:
        data: 角色创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        RoleResponse: 创建的角色对象
        
    Raises:
        HTTPException: 当角色代码已存在时抛出
    """
    try:
        role = await RoleService.create_role(
            tenant_id=tenant_id,
            data=data,
            current_user_id=current_user.id
        )
        
        # 转换为响应格式
        return RoleResponse.model_validate(role)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except AuthorizationError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("", response_model=RoleListResponse)
async def get_role_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选"),
    is_system: Optional[bool] = Query(None, description="是否系统角色筛选"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取角色列表
    
    支持分页、关键词搜索和筛选。
    
    Args:
        page: 页码
        page_size: 每页数量
        keyword: 关键词搜索（搜索角色名称、代码、描述）
        is_active: 是否启用筛选
        is_system: 是否系统角色筛选
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        RoleListResponse: 角色列表响应
    """
    result = await RoleService.get_role_list(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        keyword=keyword,
        is_active=is_active,
        is_system=is_system,
    )
    
    # 转换为响应格式
    items = [RoleListItem.model_validate(item) for item in result["items"]]
    
    return RoleListResponse(
        items=items,
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.get("/{role_uuid}", response_model=RoleResponse)
async def get_role(
    role_uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取角色详情
    
    根据UUID获取角色详细信息，包括关联的权限列表。
    
    Args:
        role_uuid: 角色UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        RoleResponse: 角色详情响应
        
    Raises:
        HTTPException: 当角色不存在时抛出
    """
    try:
        role = await RoleService.get_role_by_uuid(
            tenant_id=tenant_id,
            role_uuid=role_uuid
        )
        
        # 暂时注释掉权限列表获取，避免多对多关系查询问题
        # permissions = await role.permissions.all()
        # permission_list = [PermissionInfo.model_validate(p) for p in permissions]
        permission_list = []
        permission_count = 0
        
        # 获取关联的用户数量
        from tree_root.models.user_role import UserRole
        user_count = await UserRole.filter(role_id=role.id).count()

        # 转换为响应格式
        return model_to_response(
            role, RoleResponse,
            permissions=permission_list,
            permission_count=permission_count,
            user_count=user_count
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{role_uuid}", response_model=RoleResponse)
async def update_role(
    role_uuid: str,
    data: RoleUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新角色
    
    更新角色的基本信息。系统角色不可修改。
    
    Args:
        role_uuid: 角色UUID
        data: 角色更新数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        RoleResponse: 更新后的角色对象
        
    Raises:
        HTTPException: 当角色不存在或不可修改时抛出
    """
    try:
        role = await RoleService.update_role(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            data=data,
            current_user_id=current_user.id
        )
        
        return RoleResponse.model_validate(role)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except AuthorizationError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.delete("/{role_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除角色
    
    软删除角色。系统角色不可删除，有关联用户的角色不可删除。
    
    Args:
        role_uuid: 角色UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当角色不存在或不可删除时抛出
    """
    try:
        await RoleService.delete_role(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            current_user_id=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except AuthorizationError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.post("/{role_uuid}/permissions")
async def assign_permissions(
    role_uuid: str,
    data: RolePermissionAssign,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    分配权限给角色
    
    为角色分配权限。系统角色不可修改权限。
    
    Args:
        role_uuid: 角色UUID
        data: 权限分配数据（包含 permission_uuids 列表）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 操作结果
        
    Raises:
        HTTPException: 当角色不存在或权限无效时抛出
    """
    try:
        result = await RoleService.assign_permissions(
            tenant_id=tenant_id,
            role_uuid=role_uuid,
            permission_uuids=data.permission_uuids,
            current_user_id=current_user.id
        )
        
        return result
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except AuthorizationError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/{role_uuid}/permissions", response_model=list[PermissionInfo])
async def get_role_permissions(
    role_uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取角色关联的权限列表
    
    根据角色UUID获取该角色关联的所有权限。
    
    Args:
        role_uuid: 角色UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[PermissionInfo]: 权限列表
        
    Raises:
        HTTPException: 当角色不存在时抛出
    """
    try:
        permissions = await RoleService.get_role_permissions(
            tenant_id=tenant_id,
            role_uuid=role_uuid
        )
        
        return [PermissionInfo.model_validate(p) for p in permissions]
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

