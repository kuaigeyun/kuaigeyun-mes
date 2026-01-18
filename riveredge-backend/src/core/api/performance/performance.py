"""
API性能监控API模块

提供性能监控相关的API接口，包括性能统计、慢API列表等。

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional
from loguru import logger

from core.middleware.performance_middleware import PerformanceMiddleware
from infra.infrastructure.cache.cache_manager import cache_manager
from infra.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User

# 创建路由
router = APIRouter(prefix="/performance", tags=["Performance"])


@router.get("/stats", summary="获取性能统计信息")
async def get_performance_stats(
    limit: int = Query(10, ge=1, le=100, description="返回数量限制"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取性能统计信息
    
    返回所有API的性能统计信息，包括响应时间、调用次数等。
    """
    try:
        stats = PerformanceMiddleware.get_stats()
        slow_apis = PerformanceMiddleware.get_slow_apis(limit=limit)
        cache_stats = cache_manager.get_stats()
        
        return {
            "api_stats": stats,
            "slow_apis": slow_apis,
            "cache_stats": cache_stats,
        }
    except Exception as e:
        logger.error(f"获取性能统计信息失败: {e}")
        raise


@router.get("/slow-apis", summary="获取慢API列表")
async def get_slow_apis(
    limit: int = Query(10, ge=1, le=100, description="返回数量限制"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取慢API列表
    
    返回响应时间超过阈值的API列表。
    """
    try:
        slow_apis = PerformanceMiddleware.get_slow_apis(limit=limit)
        
        return {
            "slow_apis": slow_apis,
            "threshold": PerformanceMiddleware.SLOW_API_THRESHOLD,
        }
    except Exception as e:
        logger.error(f"获取慢API列表失败: {e}")
        raise


@router.post("/reset-stats", summary="重置性能统计")
async def reset_performance_stats(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    重置性能统计
    
    清空所有性能统计信息。
    """
    try:
        PerformanceMiddleware.reset_stats()
        return {
            "success": True,
            "message": "性能统计已重置",
        }
    except Exception as e:
        logger.error(f"重置性能统计失败: {e}")
        raise