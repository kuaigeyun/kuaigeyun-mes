"""
平台设置公开API模块

提供不需要认证的平台设置查询接口，用于登录页等公开页面。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from fastapi import APIRouter
from infra.schemas.platform_settings import PlatformSettingsResponse
from infra.services.platform_settings_service import PlatformSettingsService

# 创建路由
router = APIRouter(prefix="/platform-settings", tags=["Platform Settings (Public)"])


@router.get("/public", response_model=PlatformSettingsResponse)
async def get_platform_settings_public():
    """
    获取平台设置（公开接口）
    
    返回平台设置信息，不需要认证。
    用于登录页等公开页面显示平台信息。
    
    Returns:
        PlatformSettingsResponse: 平台设置信息
    """
    service = PlatformSettingsService()
    settings = await service.get_or_create_default_settings()
    return settings

