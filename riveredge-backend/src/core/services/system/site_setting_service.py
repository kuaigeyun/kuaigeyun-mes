"""
站点设置服务模块

提供站点设置的获取和更新操作。
新租户未设置 site_name、site_logo 时，自动回退到平台级设置。
"""

import re
from datetime import datetime, timezone
from typing import Dict, Any

from loguru import logger
from tortoise.exceptions import IntegrityError

from core.models.site_setting import SiteSetting
from core.schemas.site_setting import SiteSettingUpdate
from infra.exceptions.exceptions import NotFoundError
from core.utils.timezone_utils import now_utc

# 新建站点设置时的默认安全项（inactivity_timeout=0 表示不启用「无操作自动退出」）
_DEFAULT_SITE_SECURITY: Dict[str, Any] = {
    "token_check_interval": 60,
    "inactivity_timeout": 0,
    "user_cache_time": 300,
}

# 需要从平台级回退的站点设置键（租户未设置时使用平台值）
_PLATFORM_FALLBACK_KEYS = {
    "site_name": "platform_name",
    "site_logo": "platform_logo",
    "platform_name": "platform_name",
    "platform_name_en": "platform_name_en",
    "login_title": "login_title",
    "login_title_en": "login_title_en",
    "login_content": "login_content",
    "login_content_en": "login_content_en",
    "login_decoration_image": "login_decoration_image",
    "login_background_image": "login_background_image",
    "icp_license": "icp_license",
    "icp_license_en": "icp_license_en",
    "login_theme_color": "theme_color",
    "login_guest_enabled": "login_guest_enabled",
    "login_client_win_enabled": "login_client_win_enabled",
    "login_client_android_enabled": "login_client_android_enabled",
    "login_quick_enabled": "login_quick_enabled",
}

# 平台未配置时的默认值（新租户未设置时使用）
_PLATFORM_DEFAULT_VALUES = {
    "site_name": "RiverEdge SaaS",
    "site_logo": "",  # 无默认 logo 时留空
}

_PLATFORM_FALLBACK_BOOL_KEYS = {
    "login_guest_enabled",
    "login_client_win_enabled",
    "login_client_android_enabled",
    "login_quick_enabled",
    "login_decoration_enabled",
    "login_background_enabled",
}

_LOGO_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
_LOGO_FILE_CATEGORIES = ("site-logo", "platform-logo")
_SEAL_FILE_CATEGORIES = ("company-seal",)


class SiteSettingService:
    """
    站点设置服务类
    
    提供站点设置的获取和更新操作。
    新租户未设置 site_name、site_logo 时，自动回退到平台级设置。
    """
    
    @staticmethod
    async def _active_settings_for_tenant(tenant_id: int) -> list[SiteSetting]:
        return await SiteSetting.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).order_by("id").all()

    @staticmethod
    async def _canonical_settings(rows: list[SiteSetting]) -> SiteSetting:
        """同一租户仅保留最早一条；历史并发脏数据软删其余。"""
        if not rows:
            raise ValueError("rows must not be empty")
        canonical = rows[0]
        if len(rows) == 1:
            return canonical

        now = now_utc()
        for duplicate in rows[1:]:
            duplicate.deleted_at = now
            await duplicate.save(update_fields=["deleted_at", "updated_at"])
        logger.warning(
            "站点设置 tenant_id={} 存在 {} 条重复记录，已保留 id={} 并软删其余",
            canonical.tenant_id,
            len(rows),
            canonical.id,
        )
        return canonical

    @staticmethod
    async def _resolve_site_logo_value(tenant_id: int, logo: Any) -> str:
        """
        校验 site_logo：URL 原样返回；UUID 须对应存在文件（本租户或 logo 分类跨租户）。
        无效 UUID 返回空串，避免前端反复请求已删除文件。
        """
        if not logo or not isinstance(logo, str):
            return ""
        logo = logo.strip()
        if not logo:
            return ""
        if not _LOGO_UUID_RE.match(logo):
            return logo

        from core.models.file import File
        from core.services.file.file_service import FileService

        try:
            await FileService.get_file_by_uuid(tenant_id, logo)
            return logo
        except NotFoundError:
            pass

        file = await File.filter(
            uuid=logo,
            category__in=_LOGO_FILE_CATEGORIES,
            deleted_at__isnull=True,
        ).first()
        if file:
            return logo

        logger.warning(
            "site_logo 引用无效（文件不存在）: tenant_id={} uuid={}",
            tenant_id,
            logo,
        )
        return ""

    @staticmethod
    async def _resolve_company_seal_value(tenant_id: int, seal: Any) -> str:
        """校验 company_seal：URL 原样返回；UUID 须对应本租户 company-seal 文件。"""
        if not seal or not isinstance(seal, str):
            return ""
        seal = seal.strip()
        if not seal:
            return ""
        if not _LOGO_UUID_RE.match(seal):
            return seal

        from core.models.file import File
        from core.services.file.file_service import FileService

        try:
            file = await FileService.get_file_by_uuid(tenant_id, seal)
            if file.category in _SEAL_FILE_CATEGORIES:
                return seal
        except NotFoundError:
            pass

        file = await File.filter(
            uuid=seal,
            category__in=_SEAL_FILE_CATEGORIES,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if file:
            return seal

        logger.warning(
            "company_seal 引用无效（文件不存在）: tenant_id={} uuid={}",
            tenant_id,
            seal,
        )
        return ""

    @staticmethod
    async def get_settings(tenant_id: int) -> SiteSetting:
        """
        获取站点设置（如果不存在则创建）
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            SiteSetting: 站点设置对象
        """
        rows = await SiteSettingService._active_settings_for_tenant(tenant_id)
        if rows:
            return await SiteSettingService._canonical_settings(rows)

        try:
            return await SiteSetting.create(
                tenant_id=tenant_id,
                settings={"security": {**_DEFAULT_SITE_SECURITY}},
            )
        except IntegrityError:
            rows = await SiteSettingService._active_settings_for_tenant(tenant_id)
            if rows:
                return await SiteSettingService._canonical_settings(rows)
            raise
    
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
            should_fallback = False
            if site_key in _PLATFORM_FALLBACK_BOOL_KEYS:
                # 布尔项仅在未设置（None）时回退；False 必须视为显式覆盖
                should_fallback = tenant_val is None
            else:
                should_fallback = (not tenant_val) or (
                    isinstance(tenant_val, str) and not tenant_val.strip()
                )
            if should_fallback:
                # 优先使用平台配置，其次使用系统默认
                platform_val = getattr(platform, platform_attr, None) if platform else None
                if site_key in _PLATFORM_FALLBACK_BOOL_KEYS:
                    if platform_val is not None:
                        tenant_settings[site_key] = platform_val
                elif platform_val and (not isinstance(platform_val, str) or platform_val.strip()):
                    tenant_settings[site_key] = platform_val
                elif site_key in _PLATFORM_DEFAULT_VALUES and _PLATFORM_DEFAULT_VALUES[site_key]:
                    tenant_settings[site_key] = _PLATFORM_DEFAULT_VALUES[site_key]

        tenant_settings["site_logo"] = await SiteSettingService._resolve_site_logo_value(
            tenant_id,
            tenant_settings.get("site_logo"),
        )
        tenant_settings["company_seal"] = await SiteSettingService._resolve_company_seal_value(
            tenant_id,
            tenant_settings.get("company_seal"),
        )

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
        await site_settings.save(update_fields=["settings"])
        return site_settings

    @staticmethod
    async def set_inactivity_timeout_for_all_tenants(inactivity_timeout: int = 0) -> Dict[str, Any]:
        """
        批量更新所有租户的站点设置：security.inactivity_timeout。
        0 表示禁用前端「无操作自动退出」（与站点配置说明一致）。

        Args:
            inactivity_timeout: 不活动超时秒数，默认 0

        Returns:
            包含处理租户数量与目标值的字典
        """
        from infra.models.tenant import Tenant

        tenants = await Tenant.all()
        tenant_count = len(tenants)
        updated = 0
        for t in tenants:
            site = await SiteSettingService.get_settings(t.id)
            st = dict(site.settings or {})
            sec = dict(st.get("security") or {})
            sec["inactivity_timeout"] = inactivity_timeout
            # 若从未配置过 security，补齐常用键，避免仅含 inactivity_timeout
            if not st.get("security"):
                sec.setdefault("token_check_interval", _DEFAULT_SITE_SECURITY["token_check_interval"])
                sec.setdefault("user_cache_time", _DEFAULT_SITE_SECURITY["user_cache_time"])
            st["security"] = sec
            site.settings = st
            await site.save()
            updated += 1
        return {
            "tenant_count": tenant_count,
            "updated": updated,
            "inactivity_timeout": inactivity_timeout,
        }

