"""KU-AI 业务单据查询服务（复用 reference_resources + RBAC + DataScope）。"""

from __future__ import annotations

from typing import Any

from apps.kuaiai.services.business_document_labels import label_for_resource_key
from apps.kuaiai.services.business_document_model_registry import load_document_detail
from core.services.authorization.access_control_service import AccessControlService
from core.services.authorization.reference_registry_service import ReferenceRegistryService
from core.services.reference.reference_display_provider_registry import get_reference_display_provider
from core.services.reference.reference_display_service import ReferenceDisplayService
from infra.exceptions.exceptions import AuthorizationError, NotFoundError, ValidationError
from infra.models.user import User

KUAI_HOST_RESOURCE = "kuaiai:entry"


def _ensure_reference_providers_registered() -> None:
    try:
        from apps.kuaizhizao.reference_display.setup import register_kuaizhizao_reference_display_providers

        register_kuaizhizao_reference_display_providers()
    except Exception:
        pass
    try:
        from apps.haoligo.reference_display.setup import register_haoligo_reference_display_providers

        register_haoligo_reference_display_providers()
    except Exception:
        pass
    try:
        from apps.master_data.reference_display.setup import register_master_data_reference_display_providers

        register_master_data_reference_display_providers()
    except Exception:
        pass


class BusinessDocumentService:
    @staticmethod
    async def _can_access(
        *,
        user: User,
        tenant_id: int,
        resource_key: str,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
    ) -> bool:
        decision = await AccessControlService.check_reference_display(
            user_id=user.id,
            tenant_id=tenant_id,
            resource_key=resource_key,
            is_infra_admin=is_infra_admin,
            is_tenant_admin=is_tenant_admin,
            host_resource=KUAI_HOST_RESOURCE,
        )
        return decision.allowed

    @staticmethod
    async def list_catalog(
        *,
        tenant_id: int,
        user: User,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
        app_filter: str | None = None,
    ) -> list[dict[str, Any]]:
        _ensure_reference_providers_registered()
        registry = ReferenceRegistryService.build()
        app_key = (app_filter or "").strip().lower()
        items: list[dict[str, Any]] = []

        for resource_key, defn in sorted(registry.resources.items()):
            if defn.sensitive:
                continue
            if get_reference_display_provider(resource_key) is None:
                continue
            if app_key and not resource_key.startswith(f"{app_key}:"):
                continue
            if not await BusinessDocumentService._can_access(
                user=user,
                tenant_id=tenant_id,
                resource_key=resource_key,
                is_infra_admin=is_infra_admin,
                is_tenant_admin=is_tenant_admin,
            ):
                continue
            app_code = resource_key.split(":", 1)[0]
            items.append(
                {
                    "resource_key": resource_key,
                    "label": label_for_resource_key(resource_key),
                    "app": app_code,
                    "permission_prefix": defn.permission_prefix,
                    "has_data_scope": bool(defn.data_scope_key),
                }
            )
        return items

    @staticmethod
    async def search(
        *,
        tenant_id: int,
        user: User,
        resource_key: str,
        keyword: str | None = None,
        page: int = 1,
        page_size: int = 20,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
    ) -> dict[str, Any]:
        _ensure_reference_providers_registered()
        key = (resource_key or "").strip().lower()
        if not key:
            raise ValidationError("resource_key 不能为空")

        if not await BusinessDocumentService._can_access(
            user=user,
            tenant_id=tenant_id,
            resource_key=key,
            is_infra_admin=is_infra_admin,
            is_tenant_admin=is_tenant_admin,
        ):
            raise AuthorizationError(message="无权查询该类型业务单据")

        result = await ReferenceDisplayService.search(
            tenant_id=tenant_id,
            user=user,
            resource_key=key,
            page=page,
            page_size=min(page_size, 50),
            keyword=keyword,
            is_active=None,
            host_resource=KUAI_HOST_RESOURCE,
            is_infra_admin=is_infra_admin,
            is_tenant_admin=is_tenant_admin,
        )
        return {
            "resource_key": key,
            "label": label_for_resource_key(key),
            "items": [item.model_dump() for item in result["items"]],
            "total": result["total"],
            "page": result["page"],
            "page_size": result["page_size"],
        }

    @staticmethod
    async def get(
        *,
        tenant_id: int,
        user: User,
        resource_key: str,
        record_id: int | None = None,
        record_uuid: str | None = None,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
    ) -> dict[str, Any]:
        _ensure_reference_providers_registered()
        key = (resource_key or "").strip().lower()
        if not key:
            raise ValidationError("resource_key 不能为空")
        if record_id is None and not (record_uuid or "").strip():
            raise ValidationError("请提供 record_id 或 record_uuid")

        if not await BusinessDocumentService._can_access(
            user=user,
            tenant_id=tenant_id,
            resource_key=key,
            is_infra_admin=is_infra_admin,
            is_tenant_admin=is_tenant_admin,
        ):
            raise AuthorizationError(message="无权查看该类型业务单据")

        items = await ReferenceDisplayService.resolve(
            tenant_id=tenant_id,
            user=user,
            resource_key=key,
            record_ids=[record_id] if record_id is not None else None,
            record_uuids=[record_uuid] if record_uuid else None,
            host_resource=KUAI_HOST_RESOURCE,
            is_infra_admin=is_infra_admin,
            is_tenant_admin=is_tenant_admin,
        )
        if not items:
            raise NotFoundError("未找到对应业务单据")

        base = items[0].model_dump()
        rid = base.get("id")
        detail: dict[str, Any] | None = None
        if isinstance(rid, int):
            detail = await load_document_detail(tenant_id=tenant_id, resource_key=key, record_id=rid)

        return {
            "resource_key": key,
            "label": label_for_resource_key(key),
            "summary": base,
            "detail": detail,
        }

    @staticmethod
    async def search_multi(
        *,
        tenant_id: int,
        user: User,
        keyword: str,
        resource_keys: list[str] | None = None,
        limit_per_type: int = 5,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
    ) -> dict[str, Any]:
        kw = (keyword or "").strip()
        if not kw:
            raise ValidationError("keyword 不能为空")

        catalog = await BusinessDocumentService.list_catalog(
            tenant_id=tenant_id,
            user=user,
            is_infra_admin=is_infra_admin,
            is_tenant_admin=is_tenant_admin,
        )
        allowed = {item["resource_key"] for item in catalog}
        targets = []
        if resource_keys:
            for raw in resource_keys:
                key = (raw or "").strip().lower()
                if key in allowed:
                    targets.append(key)
        else:
            targets = sorted(allowed)

        groups: list[dict[str, Any]] = []
        for key in targets:
            try:
                result = await BusinessDocumentService.search(
                    tenant_id=tenant_id,
                    user=user,
                    resource_key=key,
                    keyword=kw,
                    page=1,
                    page_size=limit_per_type,
                    is_infra_admin=is_infra_admin,
                    is_tenant_admin=is_tenant_admin,
                )
            except (AuthorizationError, NotFoundError, ValidationError):
                continue
            if result["items"]:
                groups.append(
                    {
                        "resource_key": key,
                        "label": result["label"],
                        "items": result["items"],
                        "total": result["total"],
                    }
                )
        return {"keyword": kw, "groups": groups, "matched_types": len(groups)}
