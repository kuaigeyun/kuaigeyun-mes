"""租户密码策略读取与应用。"""

from __future__ import annotations

from typing import Any, Optional

from core.domain.security.password_policy import (
    PASSWORD_MODE_SIMPLE,
    PASSWORD_MODE_STRENGTHENED,
    PasswordPolicy,
    apply_password_security_patch,
    merge_password_security,
    normalize_password_security,
    password_policy_from_security,
    user_requires_password_change,
)

PASSWORD_SECURITY_KEYS = (
    "password_mode",
    "password_min_length",
    "password_min_char_classes",
    "password_check_personal_weak",
    "password_max_age_days",
    "password_reset_help",
)
from core.services.system.site_setting_service import SiteSettingService
from core.utils.timezone_utils import resolve_business_datetime
from infra.models.user import User


class PasswordPolicyService:
    @staticmethod
    async def get_policy(tenant_id: int) -> PasswordPolicy:
        site = await SiteSettingService.get_settings(tenant_id)
        security = (site.settings or {}).get("security")
        return password_policy_from_security(security)

    @staticmethod
    async def get_public_policy(tenant_id: int) -> dict[str, Any]:
        policy = await PasswordPolicyService.get_policy(tenant_id)
        return policy.to_public_dict()

    @staticmethod
    def user_requires_change(user: User, policy: PasswordPolicy) -> bool:
        return user_requires_password_change(
            must_change_password=bool(getattr(user, "must_change_password", False)),
            password_changed_at=getattr(user, "password_changed_at", None),
            policy=policy,
        )

    @staticmethod
    async def merge_security_dict(
        tenant_id: int,
        current_security: Optional[dict[str, Any]],
        incoming_security: Optional[dict[str, Any]],
    ) -> dict[str, Any]:
        base = dict(current_security or {})
        if incoming_security:
            base.update(dict(incoming_security))
        patch = {key: base[key] for key in PASSWORD_SECURITY_KEYS if key in base}
        prev = merge_password_security(current_security)
        normalized_password = apply_password_security_patch(current_security, patch)
        merged = {**base, **normalized_password}
        prev_mode = prev.get("password_mode")
        new_mode = normalized_password.get("password_mode")
        if prev_mode != PASSWORD_MODE_STRENGTHENED and new_mode == PASSWORD_MODE_STRENGTHENED:
            await PasswordPolicyService._on_enable_strengthened(tenant_id)
        if prev_mode == PASSWORD_MODE_STRENGTHENED and new_mode == PASSWORD_MODE_SIMPLE:
            await PasswordPolicyService._on_disable_strengthened(tenant_id)
        return merged

    @staticmethod
    def normalize_security_fragment(raw: Optional[dict[str, Any]]) -> dict[str, Any]:
        if not raw:
            return merge_password_security(None)
        patch = {key: raw[key] for key in PASSWORD_SECURITY_KEYS if key in raw}
        if not patch:
            return merge_password_security(raw)
        return normalize_password_security({**merge_password_security(raw), **patch})

    @staticmethod
    async def _on_enable_strengthened(tenant_id: int) -> None:
        now = resolve_business_datetime()
        await User.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            password_changed_at__isnull=True,
        ).update(password_changed_at=now)

    @staticmethod
    async def _on_disable_strengthened(tenant_id: int) -> None:
        await User.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            must_change_password=True,
        ).update(must_change_password=False)
