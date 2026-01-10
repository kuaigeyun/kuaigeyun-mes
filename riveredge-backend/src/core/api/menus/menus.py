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
)
from core.services.system.menu_service import MenuService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.infrastructure.cache.cache_manager import cache_manager

router = APIRouter(prefix="/menus", tags=["Menus"])


@router.post("", response_model=MenuResponse, status_code=status.HTTP_201_CREATED)
async def create_menu(
    data: MenuCreate,
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
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取菜单树
    
    Args:
        parent_uuid: 父菜单UUID（可选）
        application_uuid: 应用UUID过滤（可选）
        is_active: 是否启用过滤（可选）
        current_user: 当前用户
        tenant_id: 当前组织ID
        
    Returns:
        List[MenuTreeResponse]: 菜单树列表
    """
    # 自动扫描并同步插件菜单，确保菜单配置修改后立即生效
    # 优化：改为后台异步执行，不阻塞菜单请求，提升首次加载速度
    # 检查上次扫描时间（使用缓存存储，避免频繁扫描影响性能）
    last_scan_cache_key = f"menu_scan_timestamp:{tenant_id}"
    should_scan = False
    
    try:
        last_scan_time = await cache_manager.get("menu", last_scan_cache_key)
        current_time = time.time()
        
        # 开发环境：1分钟内扫描一次（减少频率，提升性能）
        # 生产环境：每5分钟扫描一次（平衡性能和实时性）
        scan_interval = 60 if os.getenv("ENVIRONMENT", "development") == "development" else 300
        
        if not last_scan_time or (current_time - last_scan_time) > scan_interval:
            should_scan = True
            # 更新扫描时间戳（提前更新，避免并发请求重复扫描）
            await cache_manager.set("menu", last_scan_cache_key, current_time, ttl=3600)
    except Exception:
        # 缓存失败时，不扫描（避免阻塞请求，依赖下次请求时扫描）
        should_scan = False
    
    # 如果需要扫描，在后台异步执行，不阻塞菜单请求
    if should_scan:
        import asyncio
        async def background_scan():
            """后台异步扫描插件，不阻塞主请求"""
            try:
                from core.services.application.application_service import ApplicationService
                # 自动扫描并注册插件
                await ApplicationService.scan_and_register_plugins(tenant_id=tenant_id)
                # 扫描完成后，清除菜单缓存，下次请求会返回最新数据
                await MenuService._clear_menu_cache(tenant_id)
                logger.info(f"✅ 后台插件扫描完成（tenant_id: {tenant_id}）")
            except Exception as e:
                # 扫描失败不影响菜单获取
                logger.warning(f"⚠️ 后台插件扫描失败（不影响菜单获取）: {e}")
        
        # 使用 asyncio.create_task 在后台执行，不等待完成
        try:
            asyncio.create_task(background_scan())
        except Exception as e:
            # 如果创建任务失败，记录日志但不影响主流程
            logger.warning(f"⚠️ 创建后台扫描任务失败: {e}")
    
    # 开发环境下禁用缓存，确保菜单实时刷新
    # 生产环境使用缓存，但通过定期扫描确保菜单更新
    use_cache = os.getenv("ENVIRONMENT", "development") != "development" and os.getenv("DEBUG", "false").lower() != "true"
    
    return await MenuService.get_menu_tree(
        tenant_id=tenant_id,
        parent_uuid=parent_uuid,
        application_uuid=application_uuid,
        is_active=is_active,
        use_cache=use_cache,
    )


@router.get("/{uuid}", response_model=MenuResponse)
async def get_menu(
    uuid: str,
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


@router.post("/update-order", status_code=status.HTTP_200_OK)
async def update_menu_order(
    menu_orders: List[Dict[str, Any]] = Body(..., description="菜单排序列表"),
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

