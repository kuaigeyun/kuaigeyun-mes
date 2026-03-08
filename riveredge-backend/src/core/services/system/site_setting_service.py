"""
站点设置服务模块

提供站点设置的获取和更新操作。
新租户未设置 site_name、site_logo 时，自动回退到平台级设置。
"""

from typing import Dict, Any
from core.models.site_setting import SiteSetting
from core.schemas.site_setting import SiteSettingUpdate


# 需要从平台级回退的站点设置键（租户未设置时使用平台值）
_PLATFORM_FALLBACK_KEYS = {
    "site_name": "platform_name",
    "site_logo": "platform_logo",
}

# 平台未配置时的默认值（新租户未设置时使用）
_PLATFORM_DEFAULT_VALUES = {
    "site_name": "RiverEdge SaaS",
    "site_logo": "",  # 无默认 logo 时留空
}


class SiteSettingService:
    """
    站点设置服务类
    
    提供站点设置的获取和更新操作。
    新租户未设置 site_name、site_logo 时，自动回退到平台级设置。
    """
    
    @staticmethod
    async def get_settings(tenant_id: int) -> SiteSetting:
        """
        获取站点设置（如果不存在则创建）
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            SiteSetting: 站点设置对象
        """
        settings = await SiteSetting.get_or_none(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if not settings:
            settings = await SiteSetting.create(
                tenant_id=tenant_id,
                settings={}
            )
        return settings
    
    @staticmethod
    async def get_settings_with_platform_fallback(tenant_id: int) -> Dict[str, Any]:
        """
        获取站点设置，租户未设置的 site_name、site_logo 回退到平台级。
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            Dict[str, Any]: 合并后的设置项（含平台回退）
        """
        site_settings = await SiteSettingService.get_settings(tenant_id)
        tenant_settings = dict(site_settings.settings or {})
        
        # 获取平台设置用于回退（新租户未设置时显示平台级默认）
        from infra.models.platform_settings import PlatformSettings
        platform = await PlatformSettings.first()
        for site_key, platform_attr in _PLATFORM_FALLBACK_KEYS.items():
            tenant_val = tenant_settings.get(site_key)
            if not tenant_val or (isinstance(tenant_val, str) and not tenant_val.strip()):
                # 优先使用平台配置，其次使用系统默认
                platform_val = getattr(platform, platform_attr, None) if platform else None
                if platform_val and (not isinstance(platform_val, str) or platform_val.strip()):
                    tenant_settings[site_key] = platform_val
                elif site_key in _PLATFORM_DEFAULT_VALUES and _PLATFORM_DEFAULT_VALUES[site_key]:
                    tenant_settings[site_key] = _PLATFORM_DEFAULT_VALUES[site_key]

        return tenant_settings
    
    @staticmethod
    async def update_settings(
        tenant_id: int,
        data: SiteSettingUpdate
    ) -> SiteSetting:
        """
        更新站点设置
        
        Args:
            tenant_id: 组织ID
            data: 站点设置更新数据
            
        Returns:
            SiteSetting: 更新后的站点设置对象
        """
        site_settings = await SiteSettingService.get_settings(tenant_id)
        site_settings.update_settings(data.settings)
        await site_settings.save()
        return site_settings

