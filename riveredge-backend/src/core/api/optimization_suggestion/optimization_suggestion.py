"""
优化建议推送 API 路由

提供优化建议的 RESTful API 接口。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.services.optimization_suggestion.optimization_suggestion_service import OptimizationSuggestionService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from loguru import logger

router = APIRouter(prefix="/optimization-suggestion", tags=["Optimization Suggestion"])

optimization_suggestion_service = OptimizationSuggestionService()


@router.get("/suggestions", summary="获取优化建议")
async def get_suggestions(
    category: Optional[str] = Query(None, description="分类（可选：function_optimization/data_optimization/performance_optimization）"),
    priority: Optional[str] = Query(None, description="优先级（可选：high/medium/low）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取优化建议
    
    Args:
        category: 分类（可选）
        priority: 优先级（可选）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[Dict[str, Any]]: 优化建议列表
    """
    try:
        if category:
            result = await optimization_suggestion_service.get_suggestions_by_category(
                tenant_id=tenant_id,
                category=category
            )
            return {
                "success": True,
                "data": result.get(category, []),
            }
        elif priority:
            result = await optimization_suggestion_service.get_suggestions_by_priority(
                tenant_id=tenant_id,
                priority=priority
            )
            return {
                "success": True,
                "data": result.get(priority, []),
            }
        else:
            suggestions = await optimization_suggestion_service.generate_suggestions(tenant_id)
            return {
                "success": True,
                "data": suggestions,
            }
    except Exception as e:
        logger.error(f"获取优化建议失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取优化建议失败: {str(e)}"
        )


@router.get("/suggestions/by-category", summary="按分类获取优化建议")
async def get_suggestions_by_category(
    category: Optional[str] = Query(None, description="分类"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    按分类获取优化建议
    
    Args:
        category: 分类（可选）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, List[Dict[str, Any]]]: 按分类的建议列表
    """
    try:
        result = await optimization_suggestion_service.get_suggestions_by_category(
            tenant_id=tenant_id,
            category=category
        )
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        logger.error(f"按分类获取优化建议失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"按分类获取优化建议失败: {str(e)}"
        )


@router.get("/suggestions/by-priority", summary="按优先级获取优化建议")
async def get_suggestions_by_priority(
    priority: Optional[str] = Query(None, description="优先级"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    按优先级获取优化建议
    
    Args:
        priority: 优先级（可选）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, List[Dict[str, Any]]]: 按优先级的建议列表
    """
    try:
        result = await optimization_suggestion_service.get_suggestions_by_priority(
            tenant_id=tenant_id,
            priority=priority
        )
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        logger.error(f"按优先级获取优化建议失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"按优先级获取优化建议失败: {str(e)}"
        )
