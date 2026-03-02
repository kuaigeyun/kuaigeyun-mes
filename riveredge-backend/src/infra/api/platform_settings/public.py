"""
平台设置公开API模块

提供不需要认证的平台设置查询接口，用于登录页等公开页面。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from datetime import datetime, timezone
from fastapi import APIRouter
from loguru import logger

from infra.schemas.platform_settings import PlatformSettingsResponse
from infra.services.platform_settings_service import PlatformSettingsService

# 创建路由
router = APIRouter(prefix="/platform-settings", tags=["Platform Settings (Public)"])

# 降级默认值：数据库异常时返回，确保登录页可加载
DEFAULT_PLATFORM_SETTINGS = PlatformSettingsResponse(
    id=0,
    platform_name="RiverEdge SaaS Framework",
    platform_logo=None,
    favicon=None,
    platform_description=None,
    platform_contact_email=None,
    platform_contact_phone=None,
    platform_website=None,
    login_title=None,
    login_content=None,
    icp_license=None,
    theme_color="#1890ff",
    created_at=datetime.now(timezone.utc),
    updated_at=datetime.now(timezone.utc),
)


@router.get("/public", response_model=PlatformSettingsResponse)
async def get_platform_settings_public():
    """
    获取平台设置（公开接口）
    
    返回平台设置信息，不需要认证。
    用于登录页等公开页面显示平台信息。
    数据库异常时返回默认值，确保登录页可加载。
    
    Returns:
        PlatformSettingsResponse: 平台设置信息
    """
    try:
        service = PlatformSettingsService()
        settings = await service.get_or_create_default_settings()
        return settings
    except Exception as e:
        logger.error(
            f"获取平台设置失败，返回默认值: {e}",
            exc_info=True,
        )
        return DEFAULT_PLATFORM_SETTINGS

