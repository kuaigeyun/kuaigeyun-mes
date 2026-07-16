"""
菜单管理 API 路由

提供菜单的查询、创建、更新、删除和树形结构管理功能。
"""

import os
import time
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from typing import Optional, List, Dict, Any
from loguru import logger

from core.schemas.menu import (
    MenuCreate,
    MenuUpdate,
    MenuResponse,
    MenuTreeResponse,
    MenuListResponse,
    TenantBackendHomeResponse,
    EffectiveHomeResponse,
    CustomMenuLayoutUpdate,
    CustomMenuLayoutResponse,
)
from core.services.system.menu_service import MenuService
from core.api.deps.deps import get_current_tenant
from core.api.deps.access import require_access
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.cache.cache_manager import cache_manager

router = APIRouter(prefix="/menus", tags=["Core - Menus"])


def _menu_cache_enabled() -> bool:
    """
    菜单树是否启用后端缓存。

    默认：开发/调试环境关闭、生产开启（与历史行为一致）。
    可用环境变量 MENU_CACHE_ENABLED（true/false）显式覆盖，便于本地复现生产缓存表现。
    manifest 变更已通过缓存键中的指纹自动失效，故开发环境开启缓存不会导致菜单顺序漂移。
    """
    override = os.getenv("MENU_CACHE_ENABLED")
    if override is not None and override.strip() != "":
        return override.strip().lower() in ("1", "true", "yes", "on")
    is_dev = os.getenv("ENVIRONMENT", "development") == "development"
    is_debug = os.getenv("DEBUG", "false").lower() == "true"
    return not (is_dev or is_debug)


@router.post("", response_model=MenuResponse, status_code=status.HTTP_201_CREATED)
async def create_menu(
    data: MenuCreate,
    _auth: object = Depends(require_access("system.menu", "create")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建菜单
    
    Args:
        data: 菜单创建数据
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Returns:
        MenuResponse: 创建的菜单对象
    """
    return await MenuService.create_menu(tenant_id=tenant_id, data=data)


@router.get("", response_model=List[MenuResponse])
async def get_menus(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(100, ge=1, le=1000, description="每页数量"),
    parent_uuid: Optional[str] = Query(None, description="父菜单UUID过滤"),
    application_uuid: Optional[str] = Query(None, description="应用UUID过滤"),
    is_active: Optional[bool] = Query(None, description="是否启用过滤"),
    _auth: object = Depends(require_access("system.menu", "read")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取菜单列表
    
    Args:
        page: 页码
        page_size: 每页数量
        parent_uuid: 父菜单UUID过滤（可选）
        application_uuid: 应用UUID过滤（可选）
        is_active: 是否启用过滤（可选）
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Returns:
        List[MenuResponse]: 菜单列表
    """
    return await MenuService.get_menus(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        parent_uuid=parent_uuid,
        application_uuid=application_uuid,
        is_active=is_active,
    )


@router.get("/tree", response_model=List[MenuTreeResponse])
async def get_menu_tree(
    parent_uuid: Optional[str] = Query(None, description="父菜单UUID（可选，如果提供则从该菜单开始构建树）"),
    application_uuid: Optional[str] = Query(None, description="应用UUID过滤"),
    is_active: Optional[bool] = Query(None, description="是否启用过滤"),
    _auth: object = Depends(require_access("system.menu", "read")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取菜单树（菜单管理 / 权限配置用，需 system.menu:read）
    """
    use_cache = _menu_cache_enabled()

    return await MenuService.get_menu_tree(
        tenant_id=tenant_id,
        parent_uuid=parent_uuid,
        application_uuid=application_uuid,
        is_active=is_active,
        use_cache=use_cache,
    )


@router.get("/navigation-tree", response_model=List[MenuTreeResponse])
async def get_navigation_menu_tree(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    侧栏 / 工作台导航用菜单树：任意登录用户可读（仅返回 is_active=true）。
    可见性由前端按 RBAC 过滤；勿与菜单管理接口共用 system.menu 权限。
    """
    use_cache = _menu_cache_enabled()

    return await MenuService.get_menu_tree(
        tenant_id=tenant_id,
        is_active=True,
        use_cache=use_cache,
        cache_key_suffix="nav_v1",
    )


@router.get("/custom-layout", response_model=CustomMenuLayoutResponse)
async def get_custom_menu_layout(
    _auth: object = Depends(require_access("system.menu", "read")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取租户级自组菜单布局配置。"""
    return await MenuService.get_custom_menu_layout(tenant_id=tenant_id)


@router.put("/custom-layout", response_model=CustomMenuLayoutResponse)
async def update_custom_menu_layout(
    data: CustomMenuLayoutUpdate,
    _auth: object = Depends(require_access("system.menu", "update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新租户级自组菜单布局配置。"""
    try:
        return await MenuService.update_custom_menu_layout(tenant_id=tenant_id, data=data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/backend-home", response_model=TenantBackendHomeResponse, summary="当前租户后台首页")
async def get_backend_home(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """登录用户可读；未配置或指向已删除/禁用菜单时返回全 null，前端回落系统默认工作台。"""
    return await MenuService.get_tenant_backend_home_response(tenant_id=tenant_id)


@router.get("/effective-home", response_model=EffectiveHomeResponse, summary="当前用户 UniTabs 有效首页")
async def get_effective_home(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    按优先级解析：角色首页 > 菜单设为主页 > 系统级工作台 > 独立兜底页。
    """
    from core.services.system.effective_home_service import EffectiveHomeService

    user_id = getattr(current_user, "id", None)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    result = await EffectiveHomeService.resolve_for_user(tenant_id=tenant_id, user_id=int(user_id))
    return EffectiveHomeResponse(
        path=result.path,
        source=result.source,
        role_uuid=result.role_uuid,
        menu_uuid=result.menu_uuid,
    )


@router.delete("/backend-home", status_code=status.HTTP_204_NO_CONTENT, summary="清除后台首页配置")
async def clear_backend_home(
    _auth: object = Depends(require_access("system.menu", "update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """清除后按有效首页规则回落（角色首页 / 工作台 / 兜底页）。"""
    await MenuService.clear_tenant_backend_home(tenant_id=tenant_id)


@router.post(
    "/{uuid}/set-as-backend-home",
    response_model=MenuResponse,
    summary="将指定菜单设为后台首页（租户内唯一）",
)
async def set_menu_as_backend_home(
    uuid: str,
    _auth: object = Depends(require_access("system.menu", "update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    同一租户仅允许一条配置：设置新首页后自动取消其他菜单的首页身份。
    仅允许已启用、非外部链接且已配置 path 的菜单。
    """
    try:
        return await MenuService.set_tenant_backend_home(tenant_id=tenant_id, menu_uuid=uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{uuid}", response_model=MenuResponse)
async def get_menu(
    uuid: str,
    _auth: object = Depends(require_access("system.menu", "read")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取菜单详情
    
    Args:
        uuid: 菜单UUID
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Returns:
        MenuResponse: 菜单对象
        
    Raises:
        HTTPException: 当菜单不存在时抛出
    """
    try:
        menu = await MenuService.get_menu_by_uuid(tenant_id=tenant_id, menu_uuid=uuid)
        return MenuResponse.model_validate(menu)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=MenuResponse)
async def update_menu(
    uuid: str,
    data: MenuUpdate,
    _auth: object = Depends(require_access("system.menu", "update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新菜单
    
    Args:
        uuid: 菜单UUID
        data: 菜单更新数据
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Returns:
        MenuResponse: 更新后的菜单对象
        
    Raises:
        HTTPException: 当菜单不存在或更新失败时抛出
    """
    try:
        return await MenuService.update_menu(tenant_id=tenant_id, menu_uuid=uuid, data=data)
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu(
    uuid: str,
    _auth: object = Depends(require_access("system.menu", "delete")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除菜单
    
    Args:
        uuid: 菜单UUID
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Raises:
        HTTPException: 当菜单不存在或删除失败时抛出
    """
    try:
        await MenuService.delete_menu(tenant_id=tenant_id, menu_uuid=uuid)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/sync-all", status_code=status.HTTP_200_OK)
async def sync_all_menus(
    _auth: object = Depends(require_access("system.menu", "update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    根据已安装应用的菜单配置，重新同步所有菜单到数据库。
    用于 manifest 更新后，确保菜单与数据库一致。
    已存在菜单行的启用/关闭（is_active）由租户在菜单管理维护，同步仅更新结构字段，不覆盖 is_active。
    """
    count = await MenuService.sync_all_menus_from_applications(tenant_id)
    return {"success": True, "message": f"已同步 {count} 个应用菜单", "count": count}


@router.post("/update-order", status_code=status.HTTP_200_OK)
async def update_menu_order(
    menu_orders: List[Dict[str, Any]] = Body(..., description="菜单排序列表"),
    _auth: object = Depends(require_access("system.menu", "update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新菜单排序
    
    Args:
        menu_orders: 菜单排序列表，格式：[{"uuid": "...", "sort_order": 1}, ...]
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Returns:
        dict: 更新结果
    """
    await MenuService.update_menu_order(tenant_id=tenant_id, menu_orders=menu_orders)
    return {"success": True, "message": "菜单排序更新成功"}
