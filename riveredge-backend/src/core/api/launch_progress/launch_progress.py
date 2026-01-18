"""
上线进度跟踪 API 路由

提供上线进度跟踪的 RESTful API 接口。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from core.services.launch_progress.launch_progress_service import LaunchProgressService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from loguru import logger

router = APIRouter(prefix="/launch-progress", tags=["Launch Progress"])

launch_progress_service = LaunchProgressService()


@router.get("/tracking", summary="获取上线进度跟踪")
async def get_progress_tracking(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取上线进度跟踪信息
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 进度跟踪信息
    """
    try:
        tracking = await launch_progress_service.get_progress_tracking(tenant_id)
        return {
            "success": True,
            "data": tracking,
        }
    except Exception as e:
        logger.error(f"获取上线进度跟踪失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取上线进度跟踪失败: {str(e)}"
        )


@router.get("/report", summary="生成进度报告")
async def generate_progress_report(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    生成进度报告
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 进度报告
    """
    try:
        report = await launch_progress_service.generate_progress_report(tenant_id)
        return {
            "success": True,
            "data": report,
        }
    except Exception as e:
        logger.error(f"生成进度报告失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成进度报告失败: {str(e)}"
        )
