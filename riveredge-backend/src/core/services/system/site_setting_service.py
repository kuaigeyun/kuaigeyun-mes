"""
站点设置服务模块

提供站点设置的获取和更新操作。
"""

from typing import Dict, Any
from core.models.site_setting import SiteSetting
from core.schemas.site_setting import SiteSettingUpdate


class SiteSettingService:
    """
    站点设置服务类
    
    提供站点设置的获取和更新操作。
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

