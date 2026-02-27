"""
上线向导 API 路由

提供角色上线准备和使用场景引导的 RESTful API 接口。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.services.onboarding.onboarding_service import OnboardingService
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


@router.get("/go-live-assistant")
async def get_go_live_assistant(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取上线助手四阶段及每项完成状态

    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        Dict[str, Any]: 四阶段 phases、每项 completed 状态、all_completed 总览
    """
    try:
        data = await OnboardingService.get_go_live_assistant(tenant_id=tenant_id)
        return {"success": True, "data": data}
    except Exception as e:
        logger.error(f"获取上线助手失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取上线助手失败: {str(e)}",
        )


@router.put("/go-live-assistant/blueprint-confirmed")
async def mark_blueprint_confirmed(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """标记业务蓝图已确认"""
    try:
        await OnboardingService.mark_blueprint_confirmed(tenant_id=tenant_id)
        return {"success": True, "message": "已标记蓝图已确认"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"标记蓝图确认失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"标记蓝图确认失败: {str(e)}",
        )


@router.put("/go-live-assistant/initial-data-verified")
async def mark_initial_data_verified(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """标记期初数据已核对"""
    try:
        await OnboardingService.mark_initial_data_verified(tenant_id=tenant_id)
        return {"success": True, "message": "已标记期初数据已核对"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"标记期初数据核对失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"标记期初数据核对失败: {str(e)}",
        )


@router.get("/system-guide")
async def get_system_go_live_guide(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取系统上线向导（从0到可开单的步骤式引导）

    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）

    Returns:
        Dict[str, Any]: 系统上线向导信息
    """
    try:
        guide = await OnboardingService.get_system_go_live_guide(tenant_id=tenant_id)
        return {
            "success": True,
            "data": guide,
        }
    except Exception as e:
        logger.error(f"获取系统上线向导失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取系统上线向导失败: {str(e)}"
        )


@router.get("/quick-start")
async def get_quick_start_tutorial(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取快速入门教程
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 快速入门教程信息
    """
    try:
        tutorial = await OnboardingService.get_quick_start_tutorial(
            tenant_id=tenant_id
        )
        return {
            "success": True,
            "data": tutorial,
        }
    except Exception as e:
        logger.error(f"获取快速入门教程失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取快速入门教程失败: {str(e)}"
        )


@router.get("/guides")
async def get_all_onboarding_guides(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取所有角色的上线准备向导
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 所有角色的上线准备向导信息
    """
    try:
        from core.services.onboarding.onboarding_service import ROLE_ONBOARDING_GUIDES
        return {
            "success": True,
            "data": {
                "guides": ROLE_ONBOARDING_GUIDES,
            },
        }
    except Exception as e:
        logger.error(f"获取所有上线向导失败: {tenant_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取所有上线向导失败: {str(e)}"
        )
