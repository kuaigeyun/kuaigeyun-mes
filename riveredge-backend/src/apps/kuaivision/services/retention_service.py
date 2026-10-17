"""原图与事件保留清理。"""

from __future__ import annotations

from datetime import timedelta

from apps.kuaivision.models.vision import VisionInspectionEvent, VisionInspectionImage, VisionSettings
from apps.kuaivision.services.settings_service import SettingsService
from core.utils.timezone_utils import resolve_business_datetime


class RetentionService:
    @staticmethod
    async def purge_for_tenant(tenant_id: int) -> dict[str, int]:
        settings = await SettingsService.get(tenant_id)
        now = resolve_business_datetime()
        image_cutoff = now - timedelta(days=max(int(settings.image_retention_days or 90), 1))
        event_cutoff = now - timedelta(days=max(int(settings.event_retention_days or 180), 1))

        # 过期原图：硬删行（不可再访问）；事件摘要仍可按策略保留
        images_deleted = await VisionInspectionImage.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            created_at__lt=image_cutoff,
        ).delete()

        # 过期事件：软删（列表不再展示；measurements 可后续再清）
        events = await VisionInspectionEvent.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            occurred_at__lt=event_cutoff,
        )
        events_soft_deleted = 0
        for event in events:
            event.deleted_at = now
            await event.save(update_fields=["deleted_at", "updated_at"])
            events_soft_deleted += 1

        return {
            "images_deleted": int(images_deleted or 0),
            "events_soft_deleted": events_soft_deleted,
        }

    @staticmethod
    async def purge_all_tenants() -> dict[str, int]:
        tenant_ids = await VisionSettings.all().values_list("tenant_id", flat=True)
        # 无 settings 行的租户也要扫有事件的租户
        from apps.kuaivision.models.vision import VisionInspectionEvent

        event_tenants = await VisionInspectionEvent.filter(deleted_at__isnull=True).distinct().values_list(
            "tenant_id", flat=True
        )
        ids = sorted({int(t) for t in list(tenant_ids) + list(event_tenants) if t is not None})
        totals = {"images_deleted": 0, "events_soft_deleted": 0, "tenants": 0}
        for tid in ids:
            part = await RetentionService.purge_for_tenant(int(tid))
            totals["images_deleted"] += part["images_deleted"]
            totals["events_soft_deleted"] += part["events_soft_deleted"]
            totals["tenants"] += 1
        return totals
