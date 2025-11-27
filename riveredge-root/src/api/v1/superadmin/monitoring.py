"""
超级管理员运营监控 API 模块

提供组织运营监控和系统监控相关的 API 接口
"""

from typing import Optional
from fastapi import APIRouter, Query, Depends

from services.monitoring_service import MonitoringService
from api.deps import get_current_superadmin
from models.user import User

# 创建路由
router = APIRouter(prefix="/superadmin/monitoring", tags=["SuperAdmin Monitoring"])


@router.get("/tenants/statistics")
async def get_tenant_statistics(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取组织数量统计
    
    统计所有组织的数量，按状态和套餐分组。
    
    Args:
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        Dict[str, Any]: 组织统计信息
    """
    service = MonitoringService()
    return await service.get_tenant_statistics()


@router.get("/tenants/activity")
async def get_tenant_activity(
    tenant_id: Optional[int] = Query(None, description="组织 ID（可选）"),
    days: int = Query(30, ge=1, le=365, description="统计天数（默认 30 天）"),
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取组织活跃度监控数据
    
    统计组织的日活、月活、访问量等数据。
    
    Args:
        tenant_id: 组织 ID（可选，如果提供则只统计该组织）
        days: 统计天数（默认 30 天）
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        Dict[str, Any]: 组织活跃度数据
    """
    service = MonitoringService()
    return await service.get_tenant_activity(tenant_id=tenant_id, days=days)


@router.get("/tenants/resource-usage")
async def get_tenant_resource_usage(
    tenant_id: Optional[int] = Query(None, description="组织 ID（可选）"),
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取组织资源使用监控数据
    
    统计组织的存储空间、API 调用次数、数据量等。
    
    Args:
        tenant_id: 组织 ID（可选，如果提供则只统计该组织）
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        Dict[str, Any]: 组织资源使用数据
    """
    service = MonitoringService()
    return await service.get_tenant_resource_usage(tenant_id=tenant_id)


@router.get("/tenants/data-statistics")
async def get_tenant_data_statistics(
    tenant_id: Optional[int] = Query(None, description="组织 ID（可选）"),
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取组织数据统计
    
    统计组织的用户数、订单数、业务数据量等。
    
    Args:
        tenant_id: 组织 ID（可选，如果提供则只统计该组织）
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        Dict[str, Any]: 组织数据统计
    """
    service = MonitoringService()
    return await service.get_tenant_data_statistics(tenant_id=tenant_id)


@router.get("/system/status")
async def get_system_status(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取系统整体运行状态
    
    返回系统的基本运行状态信息。
    
    Args:
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        Dict[str, Any]: 系统运行状态
    """
    service = MonitoringService()
    return await service.get_system_status()


@router.get("/system/resources")
async def get_system_resources(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取系统资源使用情况
    
    返回系统的 CPU、内存、磁盘等资源使用情况。
    
    Args:
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        Dict[str, Any]: 系统资源使用情况
    """
    service = MonitoringService()
    return await service.get_system_resources()


@router.get("/system/performance")
async def get_system_performance(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取系统性能指标
    
    返回系统的性能指标，如 API 响应时间、请求量等。
    
    Args:
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        Dict[str, Any]: 系统性能指标
    """
    service = MonitoringService()
    return await service.get_system_performance()


@router.get("/system/alerts")
async def get_system_alerts(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取系统异常告警
    
    返回系统的异常告警列表。
    
    Args:
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        List[Dict[str, Any]]: 异常告警列表
    """
    service = MonitoringService()
    return await service.get_system_alerts()


@router.get("/system/info")
async def get_system_info(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取系统环境信息
    
    返回系统的环境信息，包括 Python 版本、操作系统、平台信息、网络信息等。
    
    Args:
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        Dict[str, Any]: 系统环境信息
    """
    service = MonitoringService()
    return await service.get_system_info()


@router.get("/cache/stats")
async def get_cache_stats(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取缓存统计信息

    显示缓存的命中率、使用情况等统计数据。

    Args:
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 缓存统计信息
    """
    from core.cache_manager import cache_manager
    return cache_manager.get_stats()


@router.delete("/cache/clear")
async def clear_cache(
    namespace: str = Query(..., description="缓存命名空间"),
    key: Optional[str] = Query(None, description="缓存键（可选，不提供则清空整个命名空间）"),
    current_admin: User = Depends(get_current_superadmin)
):
    """
    清除缓存

    根据命名空间和键清除缓存数据。

    Args:
        namespace: 缓存命名空间
        key: 缓存键（可选）
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 操作结果
    """
    from core.cache_manager import cache_manager

    if key:
        # 删除特定键
        success = await cache_manager.delete(namespace, key)
        return {
            "success": success,
            "message": f"缓存键 '{namespace}:{key}' 删除{'成功' if success else '失败'}"
        }
    else:
        # 清空命名空间
        deleted_count = await cache_manager.clear_namespace(namespace)
        return {
            "success": True,
            "message": f"命名空间 '{namespace}' 已清空，删除了 {deleted_count} 个缓存项"
        }


@router.post("/cache/warmup")
async def trigger_cache_warmup(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    触发缓存预热

    执行所有注册的缓存预热任务。

    Args:
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 预热结果
    """
    from core.cache_manager import cache_manager

    try:
        await cache_manager.run_warmup_tasks()
        return {
            "success": True,
            "message": "缓存预热任务已执行完成"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"缓存预热失败: {str(e)}"
        }


@router.get("/api/stats")
async def get_api_stats(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取 API 统计信息

    显示 API 调用统计、响应时间等监控数据。

    Args:
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: API 统计信息
    """
    from core.api_middleware import get_api_stats
    return get_api_stats()


@router.post("/api/stats/reset")
async def reset_api_stats(
    current_admin: User = Depends(get_current_superadmin)
):
    """
    重置 API 统计信息

    清空所有 API 调用统计数据。

    Args:
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        Dict[str, Any]: 操作结果
    """
    from core.api_middleware import reset_api_stats
    reset_api_stats()
    return {
        "success": True,
        "message": "API 统计信息已重置"
    }