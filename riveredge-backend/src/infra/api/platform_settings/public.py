"""
平台设置公开API模块

提供不需要认证的平台设置查询接口，用于登录页等公开页面。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from fastapi import APIRouter, Query

from core.utils.timezone_utils import now_utc
from loguru import logger

from infra.schemas.platform_settings import PlatformSettingsResponse
from infra.services.platform_settings_service import PlatformSettingsService
from infra.models.tenant import Tenant, TenantStatus
from core.services.system.site_setting_service import SiteSettingService

# 创建路由
router = APIRouter(prefix="/platform-settings", tags=["Platform - Settings (Public)"])

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
    enable_register=True,
    created_at=now_utc(),
    updated_at=now_utc(),
)


@router.get("/public", response_model=PlatformSettingsResponse)
async def get_platform_settings_public(
    tenant_domain: str | None = Query(None, description="可选：组织域名（如 kgsoft），用于返回组织级登录皮肤"),
):
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

        # 支持按组织域名叠加登录页皮肤：登录页模板不变，仅覆盖展示字段
        if tenant_domain:
            tenant = await Tenant.get_or_none(
                domain=tenant_domain.strip().lower(),
                status=TenantStatus.ACTIVE,
            )
            if tenant:
                site_settings = await SiteSettingService.get_settings_with_platform_fallback(tenant.id)
                merged = settings.model_dump()
                merged.update(
                    {
                        # 组织名/Logo 作为登录页品牌信息
                        "platform_name": (
                            site_settings.get("platform_name")
                            or site_settings.get("site_name")
                            or merged.get("platform_name")
                        ),
                        "platform_name_en": (
                            site_settings.get("platform_name_en")
                            or merged.get("platform_name_en")
                        ),
                        "platform_logo": (
                            site_settings.get("login_logo")
                            or site_settings.get("site_logo")
                            or merged.get("platform_logo")
                        ),
                        # 组织级登录文案与开关（复用平台级同名能力）
                        "login_title": site_settings.get("login_title") or merged.get("login_title"),
                        "login_title_en": site_settings.get("login_title_en") or merged.get("login_title_en"),
                        "login_content": site_settings.get("login_content") or merged.get("login_content"),
                        "login_content_en": site_settings.get("login_content_en") or merged.get("login_content_en"),
                        "login_decoration_image": site_settings.get("login_decoration_image")
                        or merged.get("login_decoration_image"),
                        "login_background_image": site_settings.get("login_background_image")
                        or merged.get("login_background_image"),
                        "login_decoration_enabled": site_settings.get("login_decoration_enabled")
                        if site_settings.get("login_decoration_enabled") is not None
                        else merged.get("login_decoration_enabled"),
                        "login_background_enabled": site_settings.get("login_background_enabled")
                        if site_settings.get("login_background_enabled") is not None
                        else merged.get("login_background_enabled"),
                        "icp_license": site_settings.get("icp_license") or merged.get("icp_license"),
                        "icp_license_en": site_settings.get("icp_license_en") or merged.get("icp_license_en"),
                        "theme_color": site_settings.get("login_theme_color")
                        or site_settings.get("theme_color")
                        or merged.get("theme_color"),
                        "login_guest_enabled": site_settings.get("login_guest_enabled")
                        if site_settings.get("login_guest_enabled") is not None
                        else merged.get("login_guest_enabled"),
                        "login_client_win_enabled": site_settings.get("login_client_win_enabled")
                        if site_settings.get("login_client_win_enabled") is not None
                        else merged.get("login_client_win_enabled"),
                        "login_client_android_enabled": site_settings.get("login_client_android_enabled")
                        if site_settings.get("login_client_android_enabled") is not None
                        else merged.get("login_client_android_enabled"),
                        "login_quick_enabled": site_settings.get("login_quick_enabled")
                        if site_settings.get("login_quick_enabled") is not None
                        else merged.get("login_quick_enabled"),
                        "enable_register": site_settings.get("enable_register")
                        if site_settings.get("enable_register") is not None
                        else (merged.get("enable_register") if merged.get("enable_register") is not None else True),
                    }
                )
                return PlatformSettingsResponse(**merged)
            logger.warning("组织登录皮肤未匹配到租户，fallback 到平台默认: tenant_domain={}", tenant_domain)

        return settings
    except Exception as e:
        logger.error(
            f"获取平台设置失败，返回默认值: {e}",
            exc_info=True,
        )
        return DEFAULT_PLATFORM_SETTINGS

