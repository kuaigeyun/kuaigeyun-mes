"""
上线检查清单 API 路由

提供上线检查清单的 RESTful API 接口。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from core.services.launch_checklist.launch_checklist_service import LaunchChecklistService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from loguru import logger

router = APIRouter(prefix="/launch-checklist", tags=["Launch Checklist"])

launch_checklist_service = LaunchChecklistService()


@router.get("/checklist", summary="获取检查清单")
async def get_checklist(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取检查清单
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[Dict[str, Any]]: 检查清单
    """
    try:
        checklist = await launch_checklist_service.generate_checklist(tenant_id)
        return {
            "success": True,
            "data": checklist,
        }
    except Exception as e:
        logger.error(f"获取检查清单失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取检查清单失败: {str(e)}"
        )


@router.get("/check", summary="执行检查")
async def check_items(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    执行检查清单检查
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[Dict[str, Any]]: 检查结果列表
    """
    try:
        check_results = await launch_checklist_service.check_items(tenant_id)
        return {
            "success": True,
            "data": check_results,
        }
    except Exception as e:
        logger.error(f"执行检查失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"执行检查失败: {str(e)}"
        )


@router.get("/report", summary="生成检查报告")
async def generate_check_report(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    生成检查报告
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 检查报告
    """
    try:
        report = await launch_checklist_service.generate_check_report(tenant_id)
        return {
            "success": True,
            "data": report,
        }
    except Exception as e:
        logger.error(f"生成检查报告失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成检查报告失败: {str(e)}"
        )
