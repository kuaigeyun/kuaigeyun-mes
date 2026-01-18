"""
角色场景 API 路由

提供角色使用场景和工作台定制的 RESTful API 接口。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.services.role_scenario_service import RoleScenarioService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError
from loguru import logger

router = APIRouter(tags=["Role Scenarios"])


@router.get("/{role_id}/scenarios")
async def get_role_scenarios(
    role_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取角色使用场景
    
    Args:
        role_id: 角色ID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 角色使用场景信息
    """
    try:
        scenarios = await RoleScenarioService.get_role_scenarios(
            tenant_id=tenant_id,
            role_id=role_id
        )
        return {
            "success": True,
            "data": scenarios,
        }
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"获取角色场景失败: {role_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色场景失败: {str(e)}"
        )


@router.get("/{role_id}/dashboard")
async def get_role_dashboard(
    role_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取角色工作台配置
    
    Args:
        role_id: 角色ID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 角色工作台配置
    """
    try:
        dashboard = await RoleScenarioService.get_role_dashboard(
            tenant_id=tenant_id,
            role_id=role_id
        )
        return {
            "success": True,
            "data": dashboard,
        }
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"获取角色工作台失败: {role_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色工作台失败: {str(e)}"
        )


@router.get("/{role_id}/permissions")
async def get_role_permissions(
    role_id: int,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取角色权限
    
    Args:
        role_id: 角色ID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 角色权限信息
    """
    try:
        permissions = await RoleScenarioService.get_role_permissions(
            tenant_id=tenant_id,
            role_id=role_id
        )
        return {
            "success": True,
            "data": permissions,
        }
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"获取角色权限失败: {role_id}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色权限失败: {str(e)}"
        )


@router.get("/by-code/{role_code}/scenarios")
async def get_role_scenarios_by_code(
    role_code: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    根据角色代码获取角色使用场景
    
    Args:
        role_code: 角色代码
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 角色使用场景信息
    """
    try:
        scenarios = await RoleScenarioService.get_role_scenarios(
            tenant_id=tenant_id,
            role_code=role_code
        )
        return {
            "success": True,
            "data": scenarios,
        }
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"获取角色场景失败: {role_code}, 错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色场景失败: {str(e)}"
        )


@router.get("/scenarios")
async def get_all_role_scenarios(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取所有角色使用场景
    
    Args:
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 所有角色使用场景信息
    """
    try:
        scenarios = await RoleScenarioService.get_role_scenarios(
            tenant_id=tenant_id
        )
        return {
            "success": True,
            "data": scenarios,
        }
    except Exception as e:
        logger.error(f"获取所有角色场景失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取所有角色场景失败: {str(e)}"
        )
