"""
平台设置管理 API 模块

提供平台设置管理相关的 RESTful API 接口。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from fastapi import APIRouter, Depends, HTTPException, status
from infra.schemas.platform_settings import (
    PlatformSettingsCreate,
    PlatformSettingsUpdate,
    PlatformSettingsResponse
)
from infra.services.platform_settings_service import PlatformSettingsService
from infra.api.deps.deps import get_current_infra_superadmin
from infra.models.infra_superadmin import InfraSuperAdmin

# 创建路由
router = APIRouter(prefix="/platform-settings", tags=["Platform Settings"])


@router.get("", response_model=PlatformSettingsResponse)
async def get_platform_settings(
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    获取平台设置
    
    返回平台设置信息。如果不存在，则返回默认设置。
    
    Args:
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        PlatformSettingsResponse: 平台设置信息
    """
    service = PlatformSettingsService()
    settings = await service.get_or_create_default_settings()
    return settings


@router.post("", response_model=PlatformSettingsResponse, status_code=status.HTTP_201_CREATED)
async def create_platform_settings(
    data: PlatformSettingsCreate,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    创建平台设置
    
    创建平台设置并保存到数据库。
    注意：平台设置是全局唯一的，只能创建一个。
    如果已存在平台设置，则抛出异常。
    
    Args:
        data: 平台设置创建数据
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        PlatformSettingsResponse: 创建的平台设置信息
        
    Raises:
        HTTPException: 当平台设置已存在时抛出
    """
    service = PlatformSettingsService()
    try:
        settings = await service.create_settings(data)
        return settings
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("", response_model=PlatformSettingsResponse)
async def update_platform_settings(
    data: PlatformSettingsUpdate,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    更新平台设置
    
    更新平台设置信息。如果平台设置不存在，则创建新的设置。
    只更新提供的字段。
    
    Args:
        data: 平台设置更新数据
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        PlatformSettingsResponse: 更新后的平台设置信息
    """
    service = PlatformSettingsService()
    settings = await service.update_settings(data)
    return settings


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_platform_settings(
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    删除平台设置
    
    删除平台设置。删除后，系统将使用默认设置。
    
    Args:
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        None
    """
    service = PlatformSettingsService()
    deleted = await service.delete_settings()
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="平台设置不存在"
        )

