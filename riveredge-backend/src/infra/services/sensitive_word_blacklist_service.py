"""敏感词黑名单与组织级放行服务。"""

from __future__ import annotations

from typing import Any, Optional

from loguru import logger

from core.services.content.sensitive_word_ip_guard import SensitiveWordIpGuardService
from core.services.content.sensitive_word_service import normalize_text
from core.utils.timezone_utils import resolve_business_datetime
from infra.models.sensitive_word_control import (
    SensitiveWordBan,
    SensitiveWordViolation,
    TenantSensitiveWordAllowlist,
)
from infra.models.tenant import Tenant
from infra.models.user import User


def _truncate_snippet(text: Optional[str], limit: int = 500) -> Optional[str]:
    if not text:
        return None
    cleaned = str(text).strip()
    if not cleaned:
        return None
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1] + "…"


class SensitiveWordBlacklistService:
    async def list_enabled_tenants(self) -> list[dict[str, Any]]:
        rows = await Tenant.filter(sensitive_word_enabled=True).order_by("name").all()
        return [{"id": row.id, "name": row.name, "domain": row.domain} for row in rows]

    async def get_meta(self) -> dict[str, Any]:
        enabled_tenants = await self.list_enabled_tenants()
        return {
            "menu_visible": len(enabled_tenants) > 0,
            "enabled_tenant_count": len(enabled_tenants),
            "enabled_tenants": enabled_tenants,
        }

    async def is_tenant_word_allowlisted(self, tenant_id: Optional[int], word: str) -> bool:
        if tenant_id is None:
            return False
        normalized = normalize_text(word)
        if not normalized:
            return False
        return await TenantSensitiveWordAllowlist.filter(
            tenant_id=tenant_id,
            word=normalized,
        ).exists()

    async def list_bans(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        tenant_id: Optional[int] = None,
        active_only: bool = True,
    ) -> dict[str, Any]:
        enabled_ids = await Tenant.filter(sensitive_word_enabled=True).values_list("id", flat=True)
        if not enabled_ids:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}

        query = SensitiveWordBan.filter(tenant_id__in=enabled_ids)
        if tenant_id is not None:
            query = query.filter(tenant_id=tenant_id)
        if active_only:
            query = query.filter(is_active=True)

        total = await query.count()
        rows = (
            await query.order_by("-banned_at")
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        tenant_map = {
            t.id: t
            for t in await Tenant.filter(id__in={row.tenant_id for row in rows}).all()
        }
        user_ids = {row.user_id for row in rows}
        users = await User.filter(id__in=user_ids).all() if user_ids else []
        user_map = {u.id: u for u in users}

        items = []
        for row in rows:
            tenant = tenant_map.get(row.tenant_id)
            user = user_map.get(row.user_id)
            items.append(self._serialize_ban(row, tenant, user))
        return {"items": items, "total": total, "page": page, "page_size": page_size}

    async def unban(self, ban_id: int) -> SensitiveWordBan:
        ban = await SensitiveWordBan.get_or_none(id=ban_id)
        if ban is None:
            raise ValueError("封禁记录不存在")
        if not ban.is_active:
            return ban

        guard = SensitiveWordIpGuardService.instance()
        await guard.clear_subject(
            ban.client_ip,
            user_id=ban.user_id,
        )

        ban.is_active = False
        ban.unbanned_at = resolve_business_datetime()
        await ban.save(update_fields=["is_active", "unbanned_at", "updated_at"])
        logger.info(
            "敏感词黑名单解封 ban_id={} tenant_id={} user_id={} ip={}",
            ban.id,
            ban.tenant_id,
            ban.user_id,
            ban.client_ip,
        )
        return ban

    async def list_allowlist(
        self,
        *,
        tenant_id: int,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        tenant = await Tenant.get_or_none(id=tenant_id)
        if tenant is None or not tenant.sensitive_word_enabled:
            return {"items": [], "total": 0, "page": page, "page_size": page_size}

        query = TenantSensitiveWordAllowlist.filter(tenant_id=tenant_id)
        total = await query.count()
        rows = (
            await query.order_by("-created_at")
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return {
            "items": [self._serialize_allowlist(row) for row in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def add_allowlist_word(
        self,
        tenant_id: int,
        word: str,
        note: Optional[str] = None,
    ) -> TenantSensitiveWordAllowlist:
        tenant = await Tenant.get_or_none(id=tenant_id)
        if tenant is None or not tenant.sensitive_word_enabled:
            raise ValueError("组织未开启敏感词控制")

        normalized = normalize_text(word)
        if not normalized:
            raise ValueError("放行词不能为空")

        existing = await TenantSensitiveWordAllowlist.get_or_none(
            tenant_id=tenant_id,
            word=normalized,
        )
        if existing is not None:
            return existing

        return await TenantSensitiveWordAllowlist.create(
            tenant_id=tenant_id,
            word=normalized,
            note=(note or "").strip() or None,
        )

    async def remove_allowlist_word(self, allowlist_id: int) -> None:
        row = await TenantSensitiveWordAllowlist.get_or_none(id=allowlist_id)
        if row is None:
            raise ValueError("放行记录不存在")
        await row.delete()

    async def record_violation_event(
        self,
        *,
        tenant_id: int,
        user_id: int,
        client_ip: str,
        request_path: str,
        field_path: str,
        matched_word: str,
        content_snippet: Optional[str],
        strike_count: int,
        ip_banned: bool,
    ) -> SensitiveWordViolation:
        violation = await SensitiveWordViolation.create(
            tenant_id=tenant_id,
            user_id=user_id,
            client_ip=client_ip,
            request_path=request_path,
            field_path=field_path,
            matched_word=matched_word,
            content_snippet=_truncate_snippet(content_snippet),
            strike_count=strike_count,
        )

        if ip_banned:
            await self._upsert_active_ban(
                tenant_id=tenant_id,
                user_id=user_id,
                client_ip=client_ip,
                violation=violation,
            )
        return violation

    async def _upsert_active_ban(
        self,
        *,
        tenant_id: int,
        user_id: int,
        client_ip: str,
        violation: SensitiveWordViolation,
    ) -> SensitiveWordBan:
        existing = await SensitiveWordBan.get_or_none(
            tenant_id=tenant_id,
            user_id=user_id,
            client_ip=client_ip,
            is_active=True,
        )
        if existing is not None:
            existing.trigger_request_path = violation.request_path
            existing.trigger_field_path = violation.field_path
            existing.trigger_matched_word = violation.matched_word
            existing.trigger_content_snippet = violation.content_snippet
            await existing.save(
                update_fields=[
                    "trigger_request_path",
                    "trigger_field_path",
                    "trigger_matched_word",
                    "trigger_content_snippet",
                    "updated_at",
                ]
            )
            return existing

        return await SensitiveWordBan.create(
            tenant_id=tenant_id,
            user_id=user_id,
            client_ip=client_ip,
            banned_at=resolve_business_datetime(),
            is_active=True,
            trigger_request_path=violation.request_path,
            trigger_field_path=violation.field_path,
            trigger_matched_word=violation.matched_word,
            trigger_content_snippet=violation.content_snippet,
        )

    @staticmethod
    def _serialize_ban(
        ban: SensitiveWordBan,
        tenant: Optional[Tenant],
        user: Optional[User],
    ) -> dict[str, Any]:
        return {
            "id": ban.id,
            "tenant_id": ban.tenant_id,
            "tenant_name": tenant.name if tenant else None,
            "user_id": ban.user_id,
            "username": user.username if user else None,
            "full_name": user.full_name if user else None,
            "client_ip": ban.client_ip,
            "banned_at": ban.banned_at,
            "unbanned_at": ban.unbanned_at,
            "is_active": ban.is_active,
            "trigger_request_path": ban.trigger_request_path,
            "trigger_field_path": ban.trigger_field_path,
            "trigger_matched_word": ban.trigger_matched_word,
            "trigger_content_snippet": ban.trigger_content_snippet,
        }

    @staticmethod
    def _serialize_allowlist(row: TenantSensitiveWordAllowlist) -> dict[str, Any]:
        return {
            "id": row.id,
            "tenant_id": row.tenant_id,
            "word": row.word,
            "note": row.note,
            "created_at": row.created_at,
        }
