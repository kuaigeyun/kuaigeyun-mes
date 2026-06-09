"""引用资源展示服务：鉴权 + 路由至 DisplayProvider。"""

from __future__ import annotations

from typing import Any, Optional

from core.schemas.reference_display import ReferenceDisplayItem
from core.services.authorization.access_control_service import AccessControlService
from core.services.authorization.reference_registry_service import ReferenceRegistryService
from core.services.reference.reference_display_provider_registry import get_reference_display_provider
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class ReferenceDisplayService:
    @staticmethod
    def _format_label(*, code: str | None, name: str | None, record_id: int | None) -> str:
        c = (code or "").strip()
        n = (name or "").strip()
        if c and n:
            return f"{c} - {n}"
        if n:
            return n
        if c:
            return c
        if record_id is not None:
            return str(record_id)
        return ""

    @staticmethod
    def _to_item(row: dict[str, Any]) -> ReferenceDisplayItem:
        rid = row.get("id")
        label = str(row.get("label") or "").strip()
        if not label:
            label = ReferenceDisplayService._format_label(
                code=row.get("code"),
                name=row.get("name"),
                record_id=int(rid) if rid is not None else None,
            )
        extra = {
            k: v
            for k, v in row.items()
            if k not in {"id", "uuid", "code", "name", "label"}
        }
        return ReferenceDisplayItem(
            id=int(rid) if rid is not None else None,
            uuid=row.get("uuid"),
            code=row.get("code"),
            name=row.get("name"),
            label=label,
            extra=extra,
        )

    @staticmethod
    async def ensure_display_access(
        *,
        user_id: int,
        tenant_id: int,
        resource_key: str,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
        host_resource: str | None = None,
    ) -> None:
        decision = await AccessControlService.check_reference_display(
            user_id=user_id,
            tenant_id=tenant_id,
            resource_key=resource_key,
            is_infra_admin=is_infra_admin,
            is_tenant_admin=is_tenant_admin,
            host_resource=host_resource,
        )
        if not decision.allowed:
            from infra.exceptions.exceptions import AuthorizationError

            raise AuthorizationError(
                message="无权引用该资源",
                details={"reason": decision.reason, "required": decision.required},
            )

    @staticmethod
    async def search(
        *,
        tenant_id: int,
        user: User,
        resource_key: str,
        page: int = 1,
        page_size: int = 50,
        keyword: str | None = None,
        is_active: bool | None = True,
        host_resource: str | None = None,
        extra: dict[str, Any] | None = None,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
    ) -> dict[str, Any]:
        key = (resource_key or "").strip().lower()
        registry = ReferenceRegistryService.build()
        if key not in registry.resources:
            raise NotFoundError(f"未知引用资源: {key}")

        await ReferenceDisplayService.ensure_display_access(
            user_id=user.id,
            tenant_id=tenant_id,
            resource_key=key,
            is_infra_admin=is_infra_admin,
            is_tenant_admin=is_tenant_admin,
            host_resource=host_resource,
        )

        provider = get_reference_display_provider(key)
        if provider is None:
            raise ValidationError(f"引用资源 {key} 尚未注册 DisplayProvider")

        raw = await provider.search(
            tenant_id=tenant_id,
            user=user,
            page=page,
            page_size=page_size,
            keyword=keyword,
            is_active=is_active,
            extra=extra,
        )
        items = [ReferenceDisplayService._to_item(i) for i in (raw.get("items") or [])]
        return {
            "items": items,
            "total": int(raw.get("total") or 0),
            "page": int(raw.get("page") or page),
            "page_size": int(raw.get("page_size") or page_size),
        }

    @staticmethod
    async def resolve(
        *,
        tenant_id: int,
        user: User,
        resource_key: str,
        record_ids: list[int] | None = None,
        record_uuids: list[str] | None = None,
        host_resource: str | None = None,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
    ) -> list[ReferenceDisplayItem]:
        key = (resource_key or "").strip().lower()
        registry = ReferenceRegistryService.build()
        if key not in registry.resources:
            raise NotFoundError(f"未知引用资源: {key}")

        await ReferenceDisplayService.ensure_display_access(
            user_id=user.id,
            tenant_id=tenant_id,
            resource_key=key,
            is_infra_admin=is_infra_admin,
            is_tenant_admin=is_tenant_admin,
            host_resource=host_resource,
        )

        provider = get_reference_display_provider(key)
        if provider is None:
            raise ValidationError(f"引用资源 {key} 尚未注册 DisplayProvider")

        rows = await provider.resolve(
            tenant_id=tenant_id,
            user=user,
            record_ids=record_ids,
            record_uuids=record_uuids,
        )
        return [ReferenceDisplayService._to_item(r) for r in rows]
