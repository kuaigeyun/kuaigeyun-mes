"""开放 API 管理服务：账套、应用、授权。"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException

from core.config.open_api_module_catalog import (
    build_integration_docs,
    expand_module_keys_to_codes,
    list_module_catalog,
    module_keys_from_codes,
)
from core.models.open_api_account import OpenApiAccount, OpenApiApp, OpenApiAppGrant
from core.services.open_api.open_api_auth_service import (
    OpenApiAuthService,
    generate_app_id,
    generate_app_secret,
    hash_app_secret,
)
from core.utils.timezone_utils import now_utc


class OpenApiAdminService:
    @staticmethod
    async def get_or_create_account(tenant_id: int) -> OpenApiAccount:
        return await OpenApiAuthService.ensure_account(tenant_id)

    @staticmethod
    def serialize_account(account: OpenApiAccount) -> dict[str, Any]:
        return {
            "uuid": account.uuid,
            "acct_id": account.acct_id,
            "name": account.name,
            "status": account.status,
            "tenant_id": account.tenant_id,
            "created_at": account.created_at,
            "updated_at": account.updated_at,
        }

    @staticmethod
    async def rotate_acct_id(tenant_id: int, new_acct_id: Optional[str] = None) -> OpenApiAccount:
        account = await OpenApiAuthService.ensure_account(tenant_id)
        candidate = (new_acct_id or "").strip() or f"KG{tenant_id:06d}_{uuid.uuid4().hex[:6]}"
        clash = await OpenApiAccount.get_or_none(acct_id=candidate, deleted_at__isnull=True)
        if clash and clash.id != account.id:
            raise HTTPException(status_code=400, detail="账套 ID 已被占用")
        account.acct_id = candidate
        account.updated_at = now_utc()
        await account.save()
        return account

    @staticmethod
    async def list_apps(tenant_id: int) -> list[dict[str, Any]]:
        account = await OpenApiAuthService.ensure_account(tenant_id)
        apps = await OpenApiApp.filter(
            tenant_id=tenant_id,
            account_id=account.id,
            deleted_at__isnull=True,
        ).order_by("-id")
        out: list[dict[str, Any]] = []
        for app in apps:
            grants = await OpenApiAppGrant.filter(
                app_pk=app.id,
                deleted_at__isnull=True,
            ).values_list("permission_code", flat=True)
            grant_list = list(grants)
            out.append(OpenApiAdminService.serialize_app(app, grant_list))
        return out

    @staticmethod
    def serialize_app(app: OpenApiApp, grants: list[str]) -> dict[str, Any]:
        return {
            "uuid": app.uuid,
            "app_id": app.app_id,
            "name": app.name,
            "status": app.status,
            "ip_allowlist": app.ip_allowlist or "",
            "expires_at": app.expires_at,
            "tenant_id": app.tenant_id,
            "account_id": app.account_id,
            "grants": grants,
            "modules": module_keys_from_codes(grants),
            "created_at": app.created_at,
            "updated_at": app.updated_at,
            # 秘钥永不回显
            "app_secret": None,
        }

    @staticmethod
    async def create_app(
        tenant_id: int,
        *,
        name: str,
        module_keys: Optional[list[str]] = None,
        permission_codes: Optional[list[str]] = None,
        ip_allowlist: Optional[str] = None,
        expires_at: Optional[datetime] = None,
    ) -> dict[str, Any]:
        account = await OpenApiAuthService.ensure_account(tenant_id)
        plain_secret = generate_app_secret()
        app = await OpenApiApp.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            account_id=account.id,
            app_id=generate_app_id(),
            app_secret_hash=hash_app_secret(plain_secret),
            name=(name or "").strip() or "未命名应用",
            status="active",
            ip_allowlist=(ip_allowlist or "").strip() or None,
            expires_at=expires_at,
        )
        codes = OpenApiAdminService._resolve_codes(module_keys, permission_codes)
        await OpenApiAdminService._replace_grants(tenant_id, app.id, codes)
        data = OpenApiAdminService.serialize_app(app, codes)
        data["app_secret"] = plain_secret  # 仅创建时明文一次
        return data

    @staticmethod
    async def get_app(tenant_id: int, app_uuid: str) -> dict[str, Any]:
        app = await OpenApiApp.get_or_none(
            uuid=app_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not app:
            raise HTTPException(status_code=404, detail="应用不存在")
        grants = await OpenApiAppGrant.filter(
            app_pk=app.id,
            deleted_at__isnull=True,
        ).values_list("permission_code", flat=True)
        return OpenApiAdminService.serialize_app(app, list(grants))

    @staticmethod
    async def update_app(
        tenant_id: int,
        app_uuid: str,
        *,
        name: Optional[str] = None,
        status: Optional[str] = None,
        ip_allowlist: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        clear_expires: bool = False,
        module_keys: Optional[list[str]] = None,
        permission_codes: Optional[list[str]] = None,
        update_grants: bool = False,
    ) -> dict[str, Any]:
        app = await OpenApiApp.get_or_none(
            uuid=app_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not app:
            raise HTTPException(status_code=404, detail="应用不存在")
        if name is not None:
            app.name = name.strip() or app.name
        if status is not None:
            if status not in ("active", "disabled"):
                raise HTTPException(status_code=400, detail="status 仅支持 active|disabled")
            app.status = status
        if ip_allowlist is not None:
            app.ip_allowlist = ip_allowlist.strip() or None
        if clear_expires:
            app.expires_at = None
        elif expires_at is not None:
            app.expires_at = expires_at
        app.updated_at = now_utc()
        await app.save()

        if update_grants:
            codes = OpenApiAdminService._resolve_codes(module_keys, permission_codes)
            await OpenApiAdminService._replace_grants(tenant_id, app.id, codes)
        else:
            codes = list(
                await OpenApiAppGrant.filter(
                    app_pk=app.id,
                    deleted_at__isnull=True,
                ).values_list("permission_code", flat=True)
            )
        return OpenApiAdminService.serialize_app(app, codes)

    @staticmethod
    async def reset_secret(tenant_id: int, app_uuid: str) -> dict[str, Any]:
        app = await OpenApiApp.get_or_none(
            uuid=app_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not app:
            raise HTTPException(status_code=404, detail="应用不存在")
        plain = generate_app_secret()
        app.app_secret_hash = hash_app_secret(plain)
        app.updated_at = now_utc()
        await app.save()
        grants = list(
            await OpenApiAppGrant.filter(
                app_pk=app.id,
                deleted_at__isnull=True,
            ).values_list("permission_code", flat=True)
        )
        data = OpenApiAdminService.serialize_app(app, grants)
        data["app_secret"] = plain
        return data

    @staticmethod
    async def delete_app(tenant_id: int, app_uuid: str) -> None:
        app = await OpenApiApp.get_or_none(
            uuid=app_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not app:
            raise HTTPException(status_code=404, detail="应用不存在")
        now = now_utc()
        app.deleted_at = now
        app.status = "disabled"
        await app.save()
        await OpenApiAppGrant.filter(app_pk=app.id, deleted_at__isnull=True).update(
            deleted_at=now
        )

    @staticmethod
    def module_catalog() -> list[dict[str, Any]]:
        return list_module_catalog()

    @staticmethod
    def integration_docs(
        *,
        acct_id: str,
        tenant_id: int,
        base_url: str = "https://your-host.example",
    ) -> dict[str, Any]:
        return build_integration_docs(
            acct_id=acct_id,
            tenant_id=tenant_id,
            base_url=base_url,
        )

    @staticmethod
    def _resolve_codes(
        module_keys: Optional[list[str]],
        permission_codes: Optional[list[str]],
    ) -> list[str]:
        # 若显式传了 permission_codes，以细粒度码为准（可叠加 module 全选）
        codes: list[str] = []
        seen: set[str] = set()
        for c in permission_codes or []:
            c = (c or "").strip()
            if c and c not in seen:
                seen.add(c)
                codes.append(c)
        for c in expand_module_keys_to_codes(module_keys or []):
            if c not in seen:
                seen.add(c)
                codes.append(c)
        return codes

    @staticmethod
    async def _replace_grants(tenant_id: int, app_pk: int, codes: list[str]) -> None:
        now = now_utc()
        await OpenApiAppGrant.filter(app_pk=app_pk, deleted_at__isnull=True).update(
            deleted_at=now
        )
        for code in codes:
            existing = await OpenApiAppGrant.get_or_none(app_pk=app_pk, permission_code=code)
            if existing:
                existing.deleted_at = None
                existing.tenant_id = tenant_id
                existing.updated_at = now
                await existing.save()
            else:
                await OpenApiAppGrant.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    app_pk=app_pk,
                    permission_code=code,
                )
