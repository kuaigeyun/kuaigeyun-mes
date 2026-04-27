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
from core.services.authorization.permission_policy_service import PermissionPolicyService
from core.services.authorization.permission_sync_service import PermissionSyncService
from core.config.permission_action_spec import STANDARD_ACTIONS
from core.api.deps.deps import get_current_tenant
from core.api.deps.access import require_access
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/permissions", tags=["Core Permissions"])


@router.get("", response_model=PermissionListResponse)
async def get_permission_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=1000, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    name: Optional[str] = Query(None, description="权限名称筛选"),
    code: Optional[str] = Query(None, description="权限代码筛选"),
    resource: Optional[str] = Query(None, description="资源筛选"),
    permission_type: Optional[str] = Query(None, description="权限类型筛选"),
    exclude_derived_data: bool = Query(False, description="是否过滤自动派生的数据权限"),
    dry_run: bool = Query(False, description="仅执行权限治理模拟，不落库"),
    _auth: object = Depends(require_access("system.permission", "read")),
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
    # 同步权限定义（非强制同步），利用缓存机制减少性能开销
    await PermissionSyncService.ensure_permissions(
        tenant_id=tenant_id,
        force=False,
        dry_run=dry_run,
        prune=True,
    )

    result = await PermissionService.get_permission_list(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        keyword=keyword,
        name=name,
        code=code,
        resource=resource,
        permission_type=permission_type,
        exclude_derived_data=exclude_derived_data,
    )
    
    # 转换为响应格式
    items = [PermissionListItem.model_validate(item) for item in result["items"]]
    
    return PermissionListResponse(
        items=items,
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.post("/governance/sync")
async def sync_permission_governance(
    force: bool = Query(True, description="是否强制执行治理"),
    dry_run: bool = Query(False, description="是否仅模拟运行"),
    prune: bool = Query(True, description="是否执行废弃清理"),
    _auth: object = Depends(require_access("system.permission", "read")),
    tenant_id: int = Depends(get_current_tenant),
):
    result = await PermissionSyncService.ensure_permissions(
        tenant_id=tenant_id,
        force=force,
        dry_run=dry_run,
        prune=prune,
    )
    return result


@router.post("/governance/sync-all")
async def sync_permission_governance_all_tenants(
    dry_run: bool = Query(False, description="是否仅模拟运行"),
    prune: bool = Query(True, description="是否执行废弃清理"),
    _auth: object = Depends(require_access("system.permission", "read")),
):
    return await PermissionSyncService.sync_all_active_tenants(
        dry_run=dry_run,
        prune=prune,
    )


@router.get("/governance/report")
async def get_permission_governance_report(
    _auth: object = Depends(require_access("system.permission", "read")),
    tenant_id: int = Depends(get_current_tenant),
):
    return await PermissionSyncService.get_governance_report(tenant_id=tenant_id)


@router.get("/metadata")
async def get_permission_metadata(
    _auth: object = Depends(require_access("system.permission", "read")),
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


@router.get("/metadata/layers")
async def get_permission_layer_metadata(
    _auth: object = Depends(require_access("system.permission", "read")),
):
    return {
        "function": {
            "description": "功能权限（能看/能操作）",
            "action_whitelist": sorted(STANDARD_ACTIONS),
        },
        "data": {
            "description": "数据权限（能看多少）",
            "scope_types": sorted(PermissionPolicyService.DATA_SCOPE_TYPES),
        },
        "field": {
            "description": "字段权限（脱敏/可见）",
            "mask_levels": sorted(PermissionPolicyService.FIELD_MASK_LEVELS),
        },
    }


@router.get("/{permission_uuid}", response_model=PermissionResponse)
async def get_permission(
    permission_uuid: str,
    _auth: object = Depends(require_access("system.permission", "read")),
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
