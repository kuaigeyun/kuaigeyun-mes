"""UniTabs / 登录落地页：按优先级解析当前用户有效首页。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

from core.models.role import Role
from core.models.user_role import UserRole
from core.services.system.menu_service import MenuService
from core.services.system.site_setting_service import SiteSettingService

EffectiveHomeSource = Literal["role", "menu", "workplace", "fallback"]

SYSTEM_HOME_WORKPLACE = "/system/dashboard/workplace"
SYSTEM_HOME_FALLBACK = "/system/default-home"


@dataclass(frozen=True)
class EffectiveHomeResult:
    path: str
    source: EffectiveHomeSource
    role_uuid: Optional[str] = None
    menu_uuid: Optional[str] = None


class EffectiveHomeService:
    @staticmethod
    async def resolve_role_home_path(tenant_id: int, user_id: int) -> tuple[Optional[str], Optional[str]]:
        """用户任一启用角色配置了 home_path 时，取 id 最小的那条（稳定、可预期）。"""
        user_roles = await UserRole.filter(user_id=user_id).all()
        if not user_roles:
            return None, None
        role_ids = [ur.role_id for ur in user_roles]
        role = (
            await Role.filter(
                id__in=role_ids,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                is_active=True,
                home_path__not_isnull=True,
            )
            .exclude(home_path="")
            .order_by("id")
            .first()
        )
        if not role:
            return None, None
        path = (role.home_path or "").strip()
        if not path.startswith("/"):
            return None, None
        return path, str(role.uuid)

    @staticmethod
    async def _enable_system_dashboard(tenant_id: int) -> bool:
        configs = await SiteSettingService.get_settings_with_platform_fallback(tenant_id)
        raw = configs.get("enable_system_dashboard")
        if raw is None:
            return True
        if isinstance(raw, bool):
            return raw
        return str(raw).strip().lower() not in {"0", "false", "no", "off"}

    @staticmethod
    async def resolve_for_user(tenant_id: int, user_id: int) -> EffectiveHomeResult:
        """
        优先级：角色首页 > 菜单设为主页 > 系统级工作台 > 独立兜底页（不用应用中心）。
        """
        role_path, role_uuid = await EffectiveHomeService.resolve_role_home_path(tenant_id, user_id)
        if role_path:
            return EffectiveHomeResult(path=role_path, source="role", role_uuid=role_uuid)

        backend = await MenuService.get_tenant_backend_home_response(tenant_id)
        if backend.path:
            return EffectiveHomeResult(
                path=backend.path,
                source="menu",
                menu_uuid=backend.menu_uuid,
            )

        if await EffectiveHomeService._enable_system_dashboard(tenant_id):
            return EffectiveHomeResult(path=SYSTEM_HOME_WORKPLACE, source="workplace")

        return EffectiveHomeResult(path=SYSTEM_HOME_FALLBACK, source="fallback")
