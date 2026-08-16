"""证照台账服务。"""

from __future__ import annotations

from typing import Any, Optional

from apps.kuaioa.models.license import KuaioaLicense
from apps.kuaioa.schemas.license import LicenseCreate, LicenseUpdate
from apps.kuaioa.services.kuaioa_list_core import (
    apply_create_audit_by_user_id,
    build_keyword_q,
    generate_daily_code,
    model_to_dict,
    parse_optional_date,
    touch_updated,
)
from core.utils.timezone_utils import resolve_business_datetime, to_site_date
from infra.exceptions.exceptions import NotFoundError


class LicenseRegistryService:
    async def list_licenses(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        license_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        q = KuaioaLicense.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if license_type:
            q = q.filter(license_type=license_type)
        if status:
            q = q.filter(status=status)
        if keyword:
            q = q.filter(build_keyword_q(keyword, "license_code", "license_name", "holder_name"))
        rows = await q.order_by("expiry_date", "-updated_at")
        return [model_to_dict(row) for row in rows]

    async def get_license(self, tenant_id: int, license_id: int) -> dict[str, Any]:
        row = await KuaioaLicense.get_or_none(
            id=license_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("证照不存在")
        return model_to_dict(row)

    async def create_license(
        self, tenant_id: int, data: LicenseCreate, user_id: int
    ) -> dict[str, Any]:
        license_code = await generate_daily_code(
            KuaioaLicense, tenant_id, "LC", code_field="license_code"
        )
        create_payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "license_code": license_code,
            "license_name": data.license_name.strip(),
            "license_type": data.license_type,
            "issuing_authority": data.issuing_authority,
            "holder_name": data.holder_name,
            "issue_date": parse_optional_date(data.issue_date),
            "expiry_date": parse_optional_date(data.expiry_date),
            "reminder_days": data.reminder_days,
            "file_uuid": data.file_uuid,
            "notes": data.notes,
            "status": "valid",
        }
        await apply_create_audit_by_user_id(create_payload, user_id)
        row = await KuaioaLicense.create(**create_payload)
        return model_to_dict(row)

    async def update_license(
        self, tenant_id: int, license_id: int, data: LicenseUpdate, user_id: int
    ) -> dict[str, Any]:
        row = await KuaioaLicense.get_or_none(
            id=license_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("证照不存在")
        payload = data.model_dump(exclude_unset=True)
        for key in ("issue_date", "expiry_date"):
            if key in payload:
                payload[key] = parse_optional_date(payload[key])
        for key, value in payload.items():
            setattr(row, key, value)
        await touch_updated(row, user_id)
        await row.save()
        return model_to_dict(row)

    async def delete_license(self, tenant_id: int, license_id: int, user_id: int) -> None:
        row = await KuaioaLicense.get_or_none(
            id=license_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("证照不存在")
        row.deleted_at = resolve_business_datetime()
        await touch_updated(row, user_id)
        await row.save()

    async def list_expiring(self, tenant_id: int, within_days: int = 30) -> list[dict[str, Any]]:
        today = to_site_date(resolve_business_datetime())
        rows = await KuaioaLicense.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            expiry_date__isnull=False,
            status="valid",
        ).order_by("expiry_date")
        result = []
        for row in rows:
            if not row.expiry_date:
                continue
            delta = (row.expiry_date - today).days
            reminder = row.reminder_days or 30
            if delta <= reminder:
                item = model_to_dict(row)
                item["days_until_expiry"] = delta
                result.append(item)
        return result
