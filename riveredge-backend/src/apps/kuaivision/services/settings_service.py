"""租户视觉配置。"""

from __future__ import annotations

from typing import Optional

from apps.common.audit_actor import apply_update_audit
from apps.kuaivision.models.vision import VisionSettings
from apps.kuaivision.schemas.vision import SettingsResponse, SettingsUpdate
from infra.models.user import User


class SettingsService:
    @staticmethod
    async def get_or_create(tenant_id: int) -> VisionSettings:
        row = await VisionSettings.get_or_none(tenant_id=tenant_id, deleted_at__isnull=True)
        if row:
            return row
        row = VisionSettings(
            tenant_id=tenant_id,
            require_published_recipe=False,
            offline_timeout_seconds=60,
            image_retention_days=90,
            event_retention_days=180,
            buffer_alert_threshold=50,
            disk_alert_mb=1024,
        )
        await row.save()
        return row

    @staticmethod
    def _to_response(row: VisionSettings) -> SettingsResponse:
        return SettingsResponse(
            require_published_recipe=bool(row.require_published_recipe),
            offline_timeout_seconds=int(getattr(row, "offline_timeout_seconds", None) or 60),
            image_retention_days=int(getattr(row, "image_retention_days", None) or 90),
            event_retention_days=int(getattr(row, "event_retention_days", None) or 180),
            buffer_alert_threshold=int(getattr(row, "buffer_alert_threshold", None) or 50),
            disk_alert_mb=int(getattr(row, "disk_alert_mb", None) or 1024),
        )

    @staticmethod
    async def get(tenant_id: int) -> SettingsResponse:
        row = await SettingsService.get_or_create(tenant_id)
        return SettingsService._to_response(row)

    @staticmethod
    async def update(tenant_id: int, data: SettingsUpdate, user: Optional[User]) -> SettingsResponse:
        row = await SettingsService.get_or_create(tenant_id)
        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(row, key, value)
        apply_update_audit(row, user)
        await row.save()
        return SettingsService._to_response(row)
