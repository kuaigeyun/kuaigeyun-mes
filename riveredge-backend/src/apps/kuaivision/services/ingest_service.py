"""检测结果入站（device_token）。"""

from __future__ import annotations

from typing import Any, Optional

from apps.kuaivision.models.vision import (
    VisionInspectionEvent,
    VisionInspectionImage,
    VisionMeasurement,
    VisionRecipe,
)
from apps.kuaivision.schemas.vision import IngestBatchPayload, IngestBatchResponse, IngestPayload, IngestResponse
from apps.kuaivision.services.agent_service import AgentService
from apps.kuaivision.services.recipe_service import RecipeService
from apps.kuaivision.services.review_service import ReviewService
from apps.kuaivision.services.settings_service import SettingsService
from core.utils.timezone_utils import coerce_business_datetime_to_utc, resolve_business_datetime
from infra.exceptions.exceptions import ValidationError


class IngestService:
    @staticmethod
    def _normalize_occurred_at(raw: Any):
        if raw is None:
            return resolve_business_datetime()
        coerced = coerce_business_datetime_to_utc(raw)
        return coerced or resolve_business_datetime()

    @staticmethod
    async def ingest(device_token: str, payload: IngestPayload) -> IngestResponse:
        agent = await AgentService.get_by_token(device_token)
        judgment = str(payload.judgment or "").upper()
        if judgment not in {"OK", "NG", "UNKNOWN"}:
            raise ValidationError("judgment 仅允许 OK / NG / UNKNOWN")

        existing = await VisionInspectionEvent.get_or_none(
            tenant_id=agent.tenant_id,
            event_id=payload.event_id,
            deleted_at__isnull=True,
        )
        if existing:
            return IngestResponse(accepted=0, duplicated=1, event_uuid=existing.uuid, message="duplicated")

        recipe: Optional[VisionRecipe] = None
        if payload.recipe_code:
            recipe = await VisionRecipe.get_or_none(
                tenant_id=agent.tenant_id,
                code=payload.recipe_code.strip(),
                deleted_at__isnull=True,
            )
            settings = await SettingsService.get(agent.tenant_id)
            if settings.require_published_recipe:
                pub = await RecipeService.find_published(
                    agent.tenant_id,
                    payload.recipe_code.strip(),
                    payload.recipe_version,
                )
                if not pub:
                    raise ValidationError("入站要求已发布方案版本，未找到匹配 published 版本")

        event = await VisionInspectionEvent.create(
            tenant_id=agent.tenant_id,
            event_id=payload.event_id.strip(),
            agent_id=agent.id,
            occurred_at=IngestService._normalize_occurred_at(payload.occurred_at),
            judgment=judgment,
            confidence=payload.confidence,
            recipe_code=payload.recipe_code,
            recipe_version=payload.recipe_version,
            station_code=payload.station_code,
            camera_code=payload.camera_code,
            work_order_code=payload.work_order_code,
            operation_code=payload.operation_code,
            batch_no=payload.batch_no,
            duration_ms=payload.duration_ms,
            step_results=payload.step_results,
            remark=payload.remark,
        )

        for m in payload.measurements or []:
            await VisionMeasurement.create(
                tenant_id=agent.tenant_id,
                event_id=event.id,
                name=m.name.strip(),
                value=m.value,
                unit=m.unit,
            )

        for idx, key in enumerate(payload.image_refs or []):
            object_key = str(key or "").strip()
            if not object_key:
                continue
            await VisionInspectionImage.create(
                tenant_id=agent.tenant_id,
                event_id=event.id,
                object_key=object_key,
                sort_order=idx,
            )

        await ReviewService.ensure_pending_for_event(agent.tenant_id, event, recipe=recipe)

        agent.last_heartbeat_at = resolve_business_datetime()
        await agent.save(update_fields=["last_heartbeat_at", "updated_at"])

        return IngestResponse(accepted=1, duplicated=0, event_uuid=event.uuid, message="ok")

    @staticmethod
    async def ingest_batch(device_token: str, payload: IngestBatchPayload) -> IngestBatchResponse:
        accepted = 0
        duplicated = 0
        failed = 0
        for item in payload.items:
            try:
                res = await IngestService.ingest(device_token, item)
                accepted += int(res.accepted or 0)
                duplicated += int(res.duplicated or 0)
            except Exception:
                failed += 1
        return IngestBatchResponse(accepted=accepted, duplicated=duplicated, failed=failed)
