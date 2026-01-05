"""
AI智能建议 API 路由

提供AI智能建议的 RESTful API 接口。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.services.ai.suggestion_service import SuggestionService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from loguru import logger

router = APIRouter(prefix="/ai/suggestions", tags=["AI Suggestions"])


@router.get("/{scene}")
async def get_suggestions(
    scene: str,
    context: Optional[str] = Query(None, description="上下文信息（JSON字符串，可选）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取建议列表
    
    根据业务场景获取智能建议列表。
    
    Args:
        scene: 业务场景（init、work_order、reporting、inventory、production等）
        context: 上下文信息（JSON字符串，可选）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[Dict[str, Any]]: 建议列表
    """
    try:
        # 解析上下文信息
        import json
        context_dict: Dict[str, Any] = {}
        if context:
            try:
                context_dict = json.loads(context)
            except json.JSONDecodeError:
                logger.warning(f"上下文信息格式错误: {context}")
        
        # 获取建议
        service = SuggestionService()
        suggestions = await service.get_suggestions(
            tenant_id=tenant_id,
            scene=scene,
            context=context_dict
        )
        
        return {
            "success": True,
            "data": suggestions,
            "total": len(suggestions),
        }
    except Exception as e:
        logger.error(f"获取建议失败: {scene}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取建议失败: {str(e)}"
        )


@router.get("/work-order/{work_order_id}")
async def get_work_order_suggestions(
    work_order_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取工单相关建议
    
    Args:
        work_order_id: 工单ID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[Dict[str, Any]]: 建议列表
    """
    try:
        service = SuggestionService()
        suggestions = await service.get_suggestions_for_work_order(
            tenant_id=tenant_id,
            work_order_id=work_order_id
        )
        
        return {
            "success": True,
            "data": suggestions,
            "total": len(suggestions),
        }
    except Exception as e:
        logger.error(f"获取工单建议失败: {work_order_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取工单建议失败: {str(e)}"
        )


@router.get("/reporting/{reporting_id}")
async def get_reporting_suggestions(
    reporting_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取报工相关建议
    
    Args:
        reporting_id: 报工记录ID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[Dict[str, Any]]: 建议列表
    """
    try:
        service = SuggestionService()
        suggestions = await service.get_suggestions_for_reporting(
            tenant_id=tenant_id,
            reporting_id=reporting_id
        )
        
        return {
            "success": True,
            "data": suggestions,
            "total": len(suggestions),
        }
    except Exception as e:
        logger.error(f"获取报工建议失败: {reporting_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取报工建议失败: {str(e)}"
        )


@router.get("/inventory/all")
async def get_inventory_suggestions(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取库存相关建议
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[Dict[str, Any]]: 建议列表
    """
    try:
        service = SuggestionService()
        suggestions = await service.get_suggestions_for_inventory(
            tenant_id=tenant_id
        )
        
        return {
            "success": True,
            "data": suggestions,
            "total": len(suggestions),
        }
    except Exception as e:
        logger.error(f"获取库存建议失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取库存建议失败: {str(e)}"
        )


@router.get("/production/all")
async def get_production_suggestions(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取生产看板相关建议
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[Dict[str, Any]]: 建议列表
    """
    try:
        service = SuggestionService()
        suggestions = await service.get_suggestions_for_production(
            tenant_id=tenant_id
        )
        
        return {
            "success": True,
            "data": suggestions,
            "total": len(suggestions),
        }
    except Exception as e:
        logger.error(f"获取生产建议失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取生产建议失败: {str(e)}"
        )

