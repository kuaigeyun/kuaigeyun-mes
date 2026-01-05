"""
上线向导 API 路由

提供角色上线准备和使用场景引导的 RESTful API 接口。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.services.onboarding_service import OnboardingService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError
from loguru import logger

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


@router.get("/roles/{role_id}/guide")
async def get_role_onboarding_guide(
    role_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取角色上线准备向导
    
    Args:
        role_id: 角色ID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 角色上线准备向导信息
    """
    try:
        guide = await OnboardingService.get_role_onboarding_guide(
            tenant_id=tenant_id,
            role_id=role_id
        )
        return {
            "success": True,
            "data": guide,
        }
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"获取角色上线向导失败: {role_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色上线向导失败: {str(e)}"
        )


@router.get("/roles/{role_id}/scenarios")
async def get_role_scenario_guide(
    role_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取角色使用场景向导
    
    Args:
        role_id: 角色ID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 角色使用场景向导信息
    """
    try:
        guide = await OnboardingService.get_role_scenario_guide(
            tenant_id=tenant_id,
            role_id=role_id
        )
        return {
            "success": True,
            "data": guide,
        }
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"获取角色场景向导失败: {role_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色场景向导失败: {str(e)}"
        )


@router.get("/roles/by-code/{role_code}/guide")
async def get_role_onboarding_guide_by_code(
    role_code: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    根据角色代码获取角色上线准备向导
    
    Args:
        role_code: 角色代码
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 角色上线准备向导信息
    """
    try:
        guide = await OnboardingService.get_role_onboarding_guide(
            tenant_id=tenant_id,
            role_code=role_code
        )
        return {
            "success": True,
            "data": guide,
        }
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"获取角色上线向导失败: {role_code}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色上线向导失败: {str(e)}"
        )


@router.get("/roles/by-code/{role_code}/scenarios")
async def get_role_scenario_guide_by_code(
    role_code: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    根据角色代码获取角色使用场景向导
    
    Args:
        role_code: 角色代码
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 角色使用场景向导信息
    """
    try:
        guide = await OnboardingService.get_role_scenario_guide(
            tenant_id=tenant_id,
            role_code=role_code
        )
        return {
            "success": True,
            "data": guide,
        }
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"获取角色场景向导失败: {role_code}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色场景向导失败: {str(e)}"
        )

