"""
平台设置服务模块

提供平台设置相关的业务逻辑处理。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from typing import Optional
from infra.models.platform_settings import PlatformSettings
from infra.schemas.platform_settings import (
    PlatformSettingsCreate,
    PlatformSettingsUpdate,
    PlatformSettingsResponse
)
from infra.exceptions.exceptions import NotFoundError


class PlatformSettingsService:
    """
    平台设置服务类
    
    处理平台设置相关的所有业务逻辑
    """
    
    async def get_settings(self) -> Optional[PlatformSettingsResponse]:
        """
        获取平台设置
        
        平台设置是全局唯一的，如果不存在则返回None。
        
        Returns:
            Optional[PlatformSettingsResponse]: 平台设置信息，如果不存在则返回None
        """
        settings = await PlatformSettings.first()
        if not settings:
            return None
        return PlatformSettingsResponse.model_validate(settings)
    
    async def get_or_create_default_settings(self) -> PlatformSettingsResponse:
        """
        获取或创建默认平台设置
        
        如果平台设置不存在，则创建默认设置。
        
        Returns:
            PlatformSettingsResponse: 平台设置信息
        """
        settings = await PlatformSettings.first()
        if not settings:
            # 创建默认设置
            settings = await PlatformSettings.create(
                platform_name="RiverEdge SaaS Framework"
            )
        return PlatformSettingsResponse.model_validate(settings)
    
    async def create_settings(
        self,
        data: PlatformSettingsCreate
    ) -> PlatformSettingsResponse:
        """
        创建平台设置
        
        平台设置是全局唯一的，如果已存在则抛出异常。
        
        Args:
            data: 平台设置创建数据
            
        Returns:
            PlatformSettingsResponse: 创建的平台设置信息
            
        Raises:
            ValueError: 当平台设置已存在时抛出
        """
        existing = await PlatformSettings.first()
        if existing:
            raise ValueError("平台设置已存在，请使用更新接口")
        
        settings = await PlatformSettings.create(**data.model_dump())
        return PlatformSettingsResponse.model_validate(settings)
    
    async def update_settings(
        self,
        data: PlatformSettingsUpdate
    ) -> PlatformSettingsResponse:
        """
        更新平台设置
        
        如果平台设置不存在，则创建新的设置。
        
        Args:
            data: 平台设置更新数据
            
        Returns:
            PlatformSettingsResponse: 更新后的平台设置信息
        """
        settings = await PlatformSettings.first()
        
        if not settings:
            # 如果不存在，创建新设置
            # 如果不存在，创建新设置
            create_data = PlatformSettingsCreate(
                platform_name=data.platform_name or "RiverEdge SaaS Framework",
                platform_logo=data.platform_logo,
                favicon=data.favicon,
                platform_description=data.platform_description,
                platform_contact_email=data.platform_contact_email,
                platform_contact_phone=data.platform_contact_phone,
                platform_website=data.platform_website,
                login_title=data.login_title,
                login_content=data.login_content,
                icp_license=data.icp_license,
                theme_color=data.theme_color,
            )
            settings = await PlatformSettings.create(**create_data.model_dump(exclude_unset=True))
        else:
            # 更新现有设置
            from datetime import datetime
            update_data = data.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(settings, key, value)
            settings.updated_at = datetime.utcnow()
            await settings.save()
        
        return PlatformSettingsResponse.model_validate(settings)
    
    async def delete_settings(self) -> bool:
        """
        删除平台设置
        
        Returns:
            bool: 删除是否成功
        """
        settings = await PlatformSettings.first()
        if settings:
            await settings.delete()
            return True
        return False

