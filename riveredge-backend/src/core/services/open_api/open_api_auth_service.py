"""开放 API 鉴权服务：换票、校验、虚拟用户 ID。"""

from __future__ import annotations

import secrets
import uuid
from datetime import timedelta
from typing import Any, Optional

from fastapi import HTTPException, status

from core.config.open_api_module_catalog import module_keys_from_codes
from core.models.open_api_account import OpenApiAccount, OpenApiApp, OpenApiAppGrant
from core.utils.timezone_utils import now_utc
from infra.config.infra_config import infra_settings
from infra.domain.security.security import (
    create_access_token,
    get_token_payload,
    hash_password,
    verify_password,
)

# 开放 API 虚拟用户 ID 基线，避免与真实用户碰撞（rate limit / 操作日志）
OPEN_API_VIRTUAL_USER_BASE = 1_900_000_000

OPEN_API_TOKEN_TYP = "open_api"


def virtual_user_id_for_app(app_pk: int) -> int:
    return OPEN_API_VIRTUAL_USER_BASE + int(app_pk)


def is_open_api_payload(payload: Optional[dict]) -> bool:
    return bool(payload) and str(payload.get("typ") or "") == OPEN_API_TOKEN_TYP


def generate_app_secret() -> str:
    return secrets.token_urlsafe(32)


def generate_app_id() -> str:
    return f"app_{uuid.uuid4().hex[:16]}"


def default_acct_id(tenant_id: int) -> str:
    return f"KG{int(tenant_id):06d}"


class OpenApiAuthService:
    @staticmethod
    async def ensure_account(tenant_id: int, *, name: str = "默认账套") -> OpenApiAccount:
        acct = await OpenApiAccount.get_or_none(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if acct:
            return acct
        # 冲突时追加后缀
        base = default_acct_id(tenant_id)
        acct_id = base
        for i in range(1, 20):
            exists = await OpenApiAccount.get_or_none(acct_id=acct_id, deleted_at__isnull=True)
            if not exists:
                break
            acct_id = f"{base}_{i}"
        acct = await OpenApiAccount.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            acct_id=acct_id,
            name=name or "默认账套",
            status="active",
        )
        return acct

    @staticmethod
    async def issue_token(
        *,
        acct_id: str,
        app_id: str,
        app_secret: str,
        client_ip: Optional[str] = None,
    ) -> dict[str, Any]:
        acct_id = (acct_id or "").strip()
        app_id = (app_id or "").strip()
        if not acct_id or not app_id or not app_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="账套 ID / 应用 ID / 秘钥不能为空",
            )

        account = await OpenApiAccount.get_or_none(
            acct_id=acct_id,
            deleted_at__isnull=True,
        )
        if not account or account.status != "active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="账套无效或已停用",
            )

        app = await OpenApiApp.get_or_none(
            app_id=app_id,
            deleted_at__isnull=True,
        )
        if (
            not app
            or app.status != "active"
            or app.account_id != account.id
            or app.tenant_id != account.tenant_id
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="应用无效或已停用",
            )

        if app.expires_at and app.expires_at <= now_utc():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="应用已过期",
            )

        if not verify_password(app_secret, app.app_secret_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="应用秘钥错误",
            )

        if not OpenApiAuthService._ip_allowed(app.ip_allowlist, client_ip):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="来源 IP 不在应用白名单中",
            )

        grants = await OpenApiAppGrant.filter(
            app_pk=app.id,
            deleted_at__isnull=True,
        ).values_list("permission_code", flat=True)
        grant_list = list(grants)

        minutes = int(getattr(infra_settings, "OPEN_API_TOKEN_EXPIRE_MINUTES", 120) or 120)
        expires_delta = timedelta(minutes=max(5, minutes))
        virtual_uid = virtual_user_id_for_app(app.id)
        token = create_access_token(
            data={
                "sub": str(virtual_uid),
                "typ": OPEN_API_TOKEN_TYP,
                "tenant_id": account.tenant_id,
                "acct_id": account.acct_id,
                "app_id": app.app_id,
                "app_pk": app.id,
                "username": f"open_api:{app.app_id}",
                "grants": grant_list,
                "is_infra_admin": False,
                "is_tenant_admin": False,
            },
            expires_delta=expires_delta,
            secret=infra_settings.resolved_open_api_jwt_secret,
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": int(expires_delta.total_seconds()),
            "acct_id": account.acct_id,
            "app_id": app.app_id,
            "tenant_id": account.tenant_id,
            "grants": grant_list,
            "modules": module_keys_from_codes(grant_list),
        }

    @staticmethod
    def parse_open_api_token(token: str) -> Optional[dict[str, Any]]:
        if not token:
            return None
        payload = get_token_payload(
            token,
            secret=infra_settings.resolved_open_api_jwt_secret,
        )
        if not is_open_api_payload(payload):
            return None
        return payload

    @staticmethod
    def grants_allow(
        grants: list[str] | set[str] | None,
        required: list[str],
        *,
        require_all: bool = False,
    ) -> bool:
        gset = set(grants or [])
        if not required:
            return True
        if require_all:
            return all(c in gset for c in required)
        return any(c in gset for c in required)

    @staticmethod
    def _ip_allowed(allowlist_raw: Optional[str], client_ip: Optional[str]) -> bool:
        raw = (allowlist_raw or "").strip()
        if not raw:
            return True
        allow = [p.strip() for p in raw.split(",") if p.strip()]
        if not allow:
            return True
        ip = (client_ip or "").strip()
        return ip in allow


def hash_app_secret(plain: str) -> str:
    return hash_password(plain)
