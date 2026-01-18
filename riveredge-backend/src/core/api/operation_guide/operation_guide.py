"""
操作引导 API 路由

提供操作引导的配置和管理 RESTful API 接口。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.services.operation_guide.operation_guide_service import OperationGuideService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from loguru import logger

router = APIRouter(prefix="/operation-guide", tags=["Operation Guide"])


class OperationGuideStep(BaseModel):
    """操作引导步骤"""
    step: int = Field(..., description="步骤序号")
    target: str = Field(..., description="目标元素选择器")
    title: str = Field(..., description="引导标题")
    description: str = Field(..., description="引导内容")
    placement: str = Field("bottom", description="引导位置")


class OperationGuideCreate(BaseModel):
    """创建操作引导请求"""
    page_key: str = Field(..., description="页面标识")
    page_name: str = Field(..., description="页面名称")
    steps: List[OperationGuideStep] = Field(..., description="引导步骤列表")


@router.get("/{page_key}", summary="获取操作引导")
async def get_operation_guide(
    page_key: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取指定页面的操作引导配置
    
    Args:
        page_key: 页面标识
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 操作引导配置
    """
    try:
        guide = await OperationGuideService.get_operation_guide(
            tenant_id=tenant_id,
            page_key=page_key
        )
        return {
            "success": True,
            "data": guide,
        }
    except Exception as e:
        logger.error(f"获取操作引导失败: {page_key}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取操作引导失败: {str(e)}"
        )


@router.get("", summary="列出所有操作引导")
async def list_operation_guides(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    列出所有操作引导配置
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[Dict[str, Any]]: 操作引导配置列表
    """
    try:
        guides = await OperationGuideService.list_operation_guides(tenant_id=tenant_id)
        return {
            "success": True,
            "data": guides,
        }
    except Exception as e:
        logger.error(f"列出操作引导失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"列出操作引导失败: {str(e)}"
        )


@router.post("", summary="创建或更新操作引导")
async def create_or_update_operation_guide(
    request: OperationGuideCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建或更新操作引导配置
    
    Args:
        request: 创建操作引导请求
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 操作引导配置
    """
    try:
        guide = await OperationGuideService.create_or_update_operation_guide(
            tenant_id=tenant_id,
            page_key=request.page_key,
            page_name=request.page_name,
            steps=[step.model_dump() for step in request.steps]
        )
        return {
            "success": True,
            "data": guide,
        }
    except Exception as e:
        logger.error(f"创建或更新操作引导失败: {request.page_key}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建或更新操作引导失败: {str(e)}"
        )
