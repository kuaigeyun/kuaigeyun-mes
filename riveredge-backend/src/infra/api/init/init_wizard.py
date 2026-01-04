"""
初始化向导 API 模块

提供初始化向导相关的 RESTful API 接口。

Author: Luigi Lu
Date: 2025-01-15
"""

from fastapi import APIRouter, Depends, HTTPException, status, Path
from loguru import logger
from typing import Any, Dict

from infra.schemas.init_wizard import (
    InitStepsResponse,
    StepCompleteRequest,
    InitWizardCompleteRequest,
    InitWizardResponse,
)
from infra.services.init_wizard_service import InitWizardService
from infra.api.deps.deps import get_current_user
from infra.models.user import User

# 创建路由
router = APIRouter(prefix="/init", tags=["Init Wizard"])


def get_init_wizard_service() -> InitWizardService:
    """获取初始化向导服务实例"""
    return InitWizardService()


@router.get("/steps", response_model=InitStepsResponse)
async def get_init_steps(
    tenant_id: int,
    current_user: User = Depends(get_current_user),
    init_wizard_service: InitWizardService = Depends(get_init_wizard_service)
) -> InitStepsResponse:
    """
    获取初始化步骤列表
    
    返回初始化向导的步骤列表，包括步骤状态和进度。
    
    Args:
        tenant_id: 组织ID（查询参数）
        current_user: 当前用户（通过依赖注入获取）
        init_wizard_service: 初始化向导服务（通过依赖注入获取）
        
    Returns:
        InitStepsResponse: 初始化步骤列表响应
    """
    # 验证用户是否有权限访问该组织
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问该组织的初始化向导"
        )
    
    return await init_wizard_service.get_init_steps(tenant_id)


@router.post("/steps/{step_id}/complete")
async def complete_step(
    step_id: str = Path(..., description="步骤ID"),
    request: StepCompleteRequest = None,
    current_user: User = Depends(get_current_user),
    init_wizard_service: InitWizardService = Depends(get_init_wizard_service)
) -> Dict[str, Any]:
    """
    完成初始化步骤
    
    保存某个步骤的数据，标记该步骤为已完成。
    
    Args:
        step_id: 步骤ID（路径参数）
        request: 完成步骤请求（包含步骤数据）
        current_user: 当前用户（通过依赖注入获取）
        init_wizard_service: 初始化向导服务（通过依赖注入获取）
        
    Returns:
        dict: 完成结果
    """
    # 使用用户的组织ID
    user_tenant_id = current_user.tenant_id
    
    if not request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请求数据不能为空"
        )
    
    if request.step_id != step_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="路径参数和请求体中的步骤ID不一致"
        )
    
    return await init_wizard_service.complete_step(user_tenant_id, step_id, request.data)


@router.post("/tenants/{tenant_id}/init", response_model=InitWizardResponse)
async def complete_init_wizard(
    tenant_id: int = Path(..., description="组织ID"),
    init_data: InitWizardCompleteRequest = None,
    current_user: User = Depends(get_current_user),
    init_wizard_service: InitWizardService = Depends(get_init_wizard_service)
) -> InitWizardResponse:
    """
    完成初始化向导
    
    保存所有初始化数据并标记初始化完成。
    
    Args:
        tenant_id: 组织ID（路径参数）
        init_data: 初始化数据（请求体）
        current_user: 当前用户（通过依赖注入获取）
        init_wizard_service: 初始化向导服务（通过依赖注入获取）
        
    Returns:
        InitWizardResponse: 初始化完成响应
    """
    # 验证用户是否有权限访问该组织
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问该组织的初始化向导"
        )
    
    if not init_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="初始化数据不能为空"
        )
    
    result = await init_wizard_service.complete_init_wizard(tenant_id, init_data.data)
    
    return InitWizardResponse(**result)

