"""
插件管理器 API 路由

提供插件发现、注册、启用/停用等管理功能的 REST API。
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from core.services.plugin_manager.plugin_manager import PluginManagerService
from core.api.deps.deps import get_current_tenant
from infra.infrastructure.database.database import get_db_connection

router = APIRouter(prefix="/plugin-manager", tags=["Plugin Manager"])


def get_plugin_manager_service() -> PluginManagerService:
    """获取插件管理器服务实例"""
    from pathlib import Path
    import sys
    src_path = Path(__file__).parent.parent.parent.parent
    apps_dir = src_path / "apps"
    return PluginManagerService(apps_dir)


@router.post("/discover", status_code=status.HTTP_200_OK)
async def discover_and_register_plugins(
    tenant_id: int = Depends(get_current_tenant),
    plugin_manager: PluginManagerService = Depends(get_plugin_manager_service)
):
    """
    发现并注册插件

    扫描 apps 目录，发现所有插件应用并注册到数据库中。

    Args:
        tenant_id: 当前租户ID
        plugin_manager: 插件管理器服务

    Returns:
        Dict[str, Any]: 操作结果
    """
    try:
        result = await plugin_manager.discover_and_register_plugins(tenant_id)
        return {
            "success": True,
            "message": f"发现并注册了 {result['registered']} 个新插件，更新了 {result['updated']} 个现有插件",
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"插件发现失败: {str(e)}"
        )


@router.get("/plugins", response_model=List[Dict[str, Any]])
async def get_available_plugins(
    tenant_id: int = Depends(get_current_tenant),
    plugin_manager: PluginManagerService = Depends(get_plugin_manager_service)
):
    """
    获取所有可用插件

    返回系统中所有发现的插件及其注册状态。

    Args:
        tenant_id: 当前租户ID
        plugin_manager: 插件管理器服务

    Returns:
        List[Dict[str, Any]]: 插件列表
    """
    try:
        plugins = await plugin_manager.get_available_plugins(tenant_id)
        return plugins
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取插件列表失败: {str(e)}"
        )


@router.post("/plugins/{plugin_code}/enable", status_code=status.HTTP_200_OK)
async def enable_plugin(
    plugin_code: str,
    tenant_id: int = Depends(get_current_tenant),
    plugin_manager: PluginManagerService = Depends(get_plugin_manager_service)
):
    """
    启用插件

    Args:
        plugin_code: 插件代码
        tenant_id: 当前租户ID
        plugin_manager: 插件管理器服务

    Returns:
        Dict[str, Any]: 操作结果
    """
    try:
        result = await plugin_manager.enable_plugin(tenant_id, plugin_code)
        if result['success']:
            return {
                "success": True,
                "message": result['message']
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result['message']
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"启用插件失败: {str(e)}"
        )


@router.post("/plugins/{plugin_code}/disable", status_code=status.HTTP_200_OK)
async def disable_plugin(
    plugin_code: str,
    tenant_id: int = Depends(get_current_tenant),
    plugin_manager: PluginManagerService = Depends(get_plugin_manager_service)
):
    """
    停用插件

    Args:
        plugin_code: 插件代码
        tenant_id: 当前租户ID
        plugin_manager: 插件管理器服务

    Returns:
        Dict[str, Any]: 操作结果
    """
    try:
        result = await plugin_manager.disable_plugin(tenant_id, plugin_code)
        if result['success']:
            return {
                "success": True,
                "message": result['message']
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result['message']
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"停用插件失败: {str(e)}"
        )


@router.get("/enabled-plugins", response_model=List[str])
async def get_enabled_plugins(
    tenant_id: int = Depends(get_current_tenant),
    plugin_manager: PluginManagerService = Depends(get_plugin_manager_service)
):
    """
    获取启用的插件列表

    Args:
        tenant_id: 当前租户ID
        plugin_manager: 插件管理器服务

    Returns:
        List[str]: 启用的插件代码列表
    """
    try:
        enabled_plugins = await plugin_manager.get_enabled_plugins(tenant_id)
        return enabled_plugins
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取启用插件列表失败: {str(e)}"
        )
