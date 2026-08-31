"""
平台设置服务模块

提供平台设置相关的业务逻辑处理。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

from typing import Optional

from core.utils.timezone_utils import now_utc
from infra.models.platform_settings import PlatformSettings
from infra.models.tenant import Tenant, TenantStatus
from infra.schemas.platform_settings import (
    PlatformSettingsCreate,
    PlatformSettingsUpdate,
    PlatformSettingsResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


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
    
    async def _validate_default_tenant_id(self, default_tenant_id: Optional[int]) -> None:
        """校验默认登录租户存在且为激活状态；None 表示清除。"""
        if default_tenant_id is None:
            return
        if default_tenant_id <= 0:
            raise ValidationError("默认登录组织 ID 无效")
        tenant = await Tenant.get_or_none(id=default_tenant_id)
        if not tenant:
            raise ValidationError("默认登录组织不存在")
        if tenant.status != TenantStatus.ACTIVE:
            raise ValidationError("默认登录组织须为激活状态")

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

        await self._validate_default_tenant_id(data.default_tenant_id)
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
        update_data = data.model_dump(exclude_unset=True)
        if "default_tenant_id" in update_data:
            await self._validate_default_tenant_id(update_data.get("default_tenant_id"))
        if "official_api_library_host" in update_data:
            from infra.constants.official_registry import (
                normalize_official_api_library_host_input,
            )

            raw_host = update_data.get("official_api_library_host")
            if raw_host is None or str(raw_host).strip() == "":
                update_data["official_api_library_host"] = None
            else:
                update_data["official_api_library_host"] = normalize_official_api_library_host_input(
                    str(raw_host)
                )

        settings = await PlatformSettings.first()
        
        if not settings:
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
                login_title_en=data.login_title_en,
                login_content=data.login_content,
                login_content_en=data.login_content_en,
                login_decoration_image=data.login_decoration_image,
                login_background_image=data.login_background_image,
                login_decoration_enabled=data.login_decoration_enabled if data.login_decoration_enabled is not None else True,
                login_background_enabled=data.login_background_enabled if data.login_background_enabled is not None else True,
                icp_license=data.icp_license,
                icp_license_en=data.icp_license_en,
                theme_color=data.theme_color,
                tenant_auto_approve=data.tenant_auto_approve if data.tenant_auto_approve is not None else False,
                default_tenant_id=data.default_tenant_id,
                float_button_enabled=data.float_button_enabled if data.float_button_enabled is not None else True,
                copyright_menu_enabled=data.copyright_menu_enabled if data.copyright_menu_enabled is not None else True,
                custom_apps_contact_qr_enabled=(
                    data.custom_apps_contact_qr_enabled
                    if data.custom_apps_contact_qr_enabled is not None
                    else False
                ),
                login_guest_enabled=data.login_guest_enabled if data.login_guest_enabled is not None else True,
                login_client_win_enabled=data.login_client_win_enabled if data.login_client_win_enabled is not None else True,
                login_client_android_enabled=data.login_client_android_enabled if data.login_client_android_enabled is not None else True,
                login_quick_enabled=data.login_quick_enabled if data.login_quick_enabled is not None else True,
                enable_register=data.enable_register if data.enable_register is not None else True,
            )
            settings = await PlatformSettings.create(**create_data.model_dump(exclude_unset=True))
        else:
            # 更新现有设置
            from core.utils.login_page_settings import resolve_login_visual_layers, validate_login_visual_layers

            visual_layer_keys = {
                "login_decoration_enabled",
                "login_background_enabled",
                "login_decoration_image",
                "login_background_image",
            }
            if visual_layer_keys & update_data.keys():
                current = {
                    "login_decoration_enabled": settings.login_decoration_enabled,
                    "login_background_enabled": settings.login_background_enabled,
                }
                decoration_enabled, background_enabled = resolve_login_visual_layers(update_data, current)
                validate_login_visual_layers(decoration_enabled, background_enabled)
            for key, value in update_data.items():
                setattr(settings, key, value)
            settings.updated_at = now_utc()
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

