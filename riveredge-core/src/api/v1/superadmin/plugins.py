"""
超级管理员插件管理 API 模块

提供插件系统的管理接口，包括插件的加载、激活、停用等操作
"""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends

from plugins import plugin_registry, plugin_loader
from api.deps import get_current_superadmin
from models.user import User

# 创建路由
router = APIRouter(prefix="/superadmin/plugins", tags=["SuperAdmin Plugins"])


@router.get("/list")
async def list_plugins(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    列出所有已注册的插件

    Args:
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 插件列表信息
    """
    try:
        plugins = plugin_registry.list_plugins()
        return {
            "plugins": plugins,
            "total": len(plugins),
            "active": len([p for p in plugins if p.get("is_active")])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取插件列表失败: {e}")


@router.get("/{plugin_name}")
async def get_plugin_info(
    plugin_name: str,
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取插件详细信息

    Args:
        plugin_name: 插件名称
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 插件详细信息
    """
    plugin_info = plugin_registry.get_plugin_info(plugin_name)
    if not plugin_info:
        raise HTTPException(status_code=404, detail=f"插件 '{plugin_name}' 未找到")

    return plugin_info


@router.post("/load")
async def load_plugins(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    加载所有插件

    Args:
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 加载结果
    """
    try:
        loaded_count = plugin_loader.load_all_directories(plugin_registry)
        return {
            "success": True,
            "message": f"成功加载 {loaded_count} 个插件"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载插件失败: {e}")


@router.post("/{plugin_name}/activate")
async def activate_plugin(
    plugin_name: str,
    current_admin: User = Depends(get_current_superadmin)
):
    """
    激活插件

    Args:
        plugin_name: 插件名称
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 操作结果
    """
    try:
        plugin_registry.activate_plugin(plugin_name)
        return {
            "success": True,
            "message": f"插件 '{plugin_name}' 已激活"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"激活插件失败: {e}")


@router.post("/{plugin_name}/deactivate")
async def deactivate_plugin(
    plugin_name: str,
    current_admin: User = Depends(get_current_superadmin)
):
    """
    停用插件

    Args:
        plugin_name: 插件名称
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 操作结果
    """
    try:
        plugin_registry.deactivate_plugin(plugin_name)
        return {
            "success": True,
            "message": f"插件 '{plugin_name}' 已停用"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"停用插件失败: {e}")


@router.post("/activate-all")
async def activate_all_plugins(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    激活所有插件

    Args:
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 操作结果
    """
    try:
        plugin_registry.activate_all()
        return {
            "success": True,
            "message": "所有插件已激活"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"激活所有插件失败: {e}")


@router.post("/deactivate-all")
async def deactivate_all_plugins(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    停用所有插件

    Args:
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 操作结果
    """
    try:
        plugin_registry.deactivate_all()
        return {
            "success": True,
            "message": "所有插件已停用"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"停用所有插件失败: {e}")


@router.post("/{plugin_name}/reload")
async def reload_plugin(
    plugin_name: str,
    current_admin: User = Depends(get_current_superadmin)
):
    """
    重新加载插件

    Args:
        plugin_name: 插件名称
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 操作结果
    """
    try:
        success = plugin_loader.reload_plugin(plugin_name, plugin_registry)
        if success:
            return {
                "success": True,
                "message": f"插件 '{plugin_name}' 重新加载成功"
            }
        else:
            raise HTTPException(status_code=500, detail=f"插件 '{plugin_name}' 重新加载失败")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重新加载插件失败: {e}")


@router.delete("/{plugin_name}")
async def unregister_plugin(
    plugin_name: str,
    current_admin: User = Depends(get_current_superadmin)
):
    """
    取消注册插件

    Args:
        plugin_name: 插件名称
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 操作结果
    """
    try:
        plugin_registry.unregister(plugin_name)
        return {
            "success": True,
            "message": f"插件 '{plugin_name}' 已取消注册"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"取消注册插件失败: {e}")


@router.get("/services/list")
async def list_plugin_services(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    列出所有插件提供的服务

    Args:
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 服务列表
    """
    services = {}
    plugins = plugin_registry.get_active_plugins()

    for plugin_name, plugin in plugins.items():
        plugin_services = plugin.get_services()
        if plugin_services:
            services[plugin_name] = list(plugin_services.keys())

    return {
        "services": services,
        "total_plugins": len(services)
    }


@router.get("/routes/list")
async def list_plugin_routes(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    列出所有插件提供的路由

    Args:
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 路由列表
    """
    routes = {}
    plugins = plugin_registry.get_active_plugins()

    for plugin_name, plugin in plugins.items():
        plugin_routes = plugin.get_api_routes()
        if plugin_routes:
            # 提取路由信息（简化版本）
            routes[plugin_name] = {
                "prefix": getattr(plugin_routes, "prefix", ""),
                "tags": getattr(plugin_routes, "tags", [])
            }

    return {
        "routes": routes,
        "total_plugins": len(routes)
    }
