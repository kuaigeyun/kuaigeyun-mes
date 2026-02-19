"""
权限管理 API 路由

提供权限的查询功能。
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.models.permission import Permission
from core.schemas.permission import (
    PermissionResponse,
    PermissionListResponse,
    PermissionListItem,
)
from core.services.authorization.permission_service import PermissionService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/permissions", tags=["Core Permissions"])


@router.get("", response_model=PermissionListResponse)
async def get_permission_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    name: Optional[str] = Query(None, description="权限名称筛选"),
    code: Optional[str] = Query(None, description="权限代码筛选"),
    resource: Optional[str] = Query(None, description="资源筛选"),
    permission_type: Optional[str] = Query(None, description="权限类型筛选"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取权限列表
    
    支持分页、关键词搜索和筛选。
    
    Args:
        page: 页码
        page_size: 每页数量
        keyword: 关键词搜索（搜索权限名称、代码、描述）
        resource: 资源筛选（如 user、role）
        permission_type: 权限类型筛选（function、data、field）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PermissionListResponse: 权限列表响应
    """
    result = await PermissionService.get_permission_list(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        keyword=keyword,
        name=name,
        code=code,
        resource=resource,
        permission_type=permission_type,
    )
    
    # 转换为响应格式
    items = [PermissionListItem.model_validate(item) for item in result["items"]]
    
    return PermissionListResponse(
        items=items,
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.get("/metadata")
async def get_permission_metadata(
    current_user: User = Depends(soil_get_current_user),
):
    """
    获取权限元数据（模块分组、资源列表等），供前端构建权限树使用。
    """
    from core.config.permission_modules import (
        PERMISSION_MODULE_MAP,
        PERMISSION_MODULE_NAMES,
    )

    return {
        "modules": [
            {"key": k, "resources": v, "name": PERMISSION_MODULE_NAMES.get(k, k)}
            for k, v in PERMISSION_MODULE_MAP.items()
        ],
        "module_names": PERMISSION_MODULE_NAMES,
    }


@router.get("/{permission_uuid}", response_model=PermissionResponse)
async def get_permission(
    permission_uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取权限详情
    
    根据UUID获取权限详细信息，包括关联的角色列表。
    
    Args:
        permission_uuid: 权限UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PermissionResponse: 权限详情响应
        
    Raises:
        HTTPException: 当权限不存在时抛出
    """
    try:
        permission = await PermissionService.get_permission_by_uuid(
            tenant_id=tenant_id,
            permission_uuid=permission_uuid
        )
        
        # 获取关联的角色列表
        roles = await permission.roles.all()
        role_list = [{"id": r.id, "uuid": r.uuid, "name": r.name, "code": r.code} for r in roles]
        
        # 转换为响应格式
        response = PermissionResponse.model_validate(permission)
        response.roles = role_list
        response.role_count = len(role_list)
        
        return response
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

