"""
应用中心组织自主启停权限服务。

平台在组织管理中按分类授权；套餐 PRO 能力为硬顶。
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from core.config.application_center_permissions import (
    APPLICATION_CENTER_PERMISSION_CONFIG_KEY,
    ALL_CATEGORIES,
    AppCenterCategory,
    default_category_permissions,
    normalize_category_permissions,
    resolve_app_center_category,
)
from core.config.industry_app_catalog import requires_pro_license_for_app
from core.services.application.application_service import ApplicationService
from infra.services.package_service import PackageService
from infra.services.tenant_service import TenantService


class ApplicationCenterPermissionService:
    @staticmethod
    async def get_category_permissions(tenant_id: int) -> Dict[str, Dict[str, bool]]:
        row = await TenantService().get_tenant_config(
            tenant_id, APPLICATION_CENTER_PERMISSION_CONFIG_KEY
        )
        raw = row.config_value if row else None
        return normalize_category_permissions(raw)

    @staticmethod
    async def set_category_permissions(
        tenant_id: int,
        permissions: Dict[str, Any],
    ) -> Dict[str, Dict[str, bool]]:
        normalized = normalize_category_permissions(permissions)
        await TenantService().set_tenant_config(
            tenant_id,
            APPLICATION_CENTER_PERMISSION_CONFIG_KEY,
            normalized,
            description="应用中心分类自主启停权限",
        )
        return normalized

    @staticmethod
    async def get_package_controls(tenant_id: int) -> Dict[str, Any]:
        return await ApplicationService._resolve_package_controls(tenant_id)

    @staticmethod
    def package_allows_pro_apps(controls: Dict[str, Any]) -> bool:
        return bool(controls.get("allow_pro_apps"))

    @staticmethod
    async def app_requires_pro_entitlement(app_code: str) -> bool:
        manifest = ApplicationService._get_manifest_by_code(app_code)
        manifest_is_pro = bool(manifest.get("is_pro", False)) if manifest else False
        return requires_pro_license_for_app(app_code, is_pro=manifest_is_pro)

    @staticmethod
    def resolve_category_for_application(application: Dict[str, Any]) -> AppCenterCategory:
        code = str(application.get("code") or "")
        manifest = ApplicationService._get_manifest_by_code(code) if code else None
        manifest_is_pro = bool(manifest.get("is_pro", False)) if manifest else False
        is_dedicated = ApplicationService.effective_is_dedicated(application)
        return resolve_app_center_category(
            code,
            is_dedicated=is_dedicated,
            manifest_is_pro=manifest_is_pro,
        )

    @staticmethod
    async def build_center_capabilities(tenant_id: int) -> Dict[str, Any]:
        permissions = await ApplicationCenterPermissionService.get_category_permissions(
            tenant_id
        )
        package = await ApplicationCenterPermissionService.get_package_controls(tenant_id)
        allow_pro = ApplicationCenterPermissionService.package_allows_pro_apps(package)

        effective: Dict[str, Dict[str, Any]] = {}
        for cat in ALL_CATEGORIES:
            org_allowed = bool(
                permissions.get(cat, {}).get("allow_self_service_toggle", False)
            )
            if cat == "pro":
                package_allows = allow_pro
                can_toggle = org_allowed and package_allows
            elif cat == "industry":
                # 免费行业包不依赖 PRO；付费行业包在 can_self_service_toggle_app 按应用校验
                package_allows = True
                can_toggle = org_allowed
            else:
                package_allows = True
                can_toggle = org_allowed
            effective[cat] = {
                "allow_self_service_toggle": org_allowed,
                "package_allows": package_allows,
                "can_self_service_toggle": can_toggle,
            }

        return {
            "category_permissions": permissions,
            "package": {
                "allow_pro_apps": allow_pro,
                "allowed_app_codes": list(package.get("allowed_app_codes") or []),
            },
            "effective": effective,
        }

    @staticmethod
    async def can_self_service_toggle_app(
        tenant_id: int,
        application: Dict[str, Any],
    ) -> bool:
        category = ApplicationCenterPermissionService.resolve_category_for_application(
            application
        )
        caps = await ApplicationCenterPermissionService.build_center_capabilities(tenant_id)
        effective = caps.get("effective", {}).get(category, {})
        if not effective.get("can_self_service_toggle"):
            return False

        app_code = str(application.get("code") or "")
        if await ApplicationCenterPermissionService.app_requires_pro_entitlement(app_code):
            if not ApplicationCenterPermissionService.package_allows_pro_apps(
                caps.get("package", {})
            ):
                return False
        return True

    @staticmethod
    async def assert_enable_allowed_by_package(tenant_id: int, app_code: str) -> None:
        from infra.exceptions.exceptions import ValidationError

        if not await ApplicationService._is_app_allowed_by_package(tenant_id, app_code):
            raise ValidationError("当前套餐未包含该应用，无法启用。")

        if await ApplicationCenterPermissionService.app_requires_pro_entitlement(app_code):
            controls = await ApplicationCenterPermissionService.get_package_controls(
                tenant_id
            )
            if not ApplicationCenterPermissionService.package_allows_pro_apps(controls):
                raise ValidationError("当前套餐不支持 PRO 应用，无法启用该应用。")
