"""人工复核服务。"""

from __future__ import annotations

from decimal import Decimal
from typing import List, Optional, Tuple

from apps.common.audit_actor import apply_update_audit, operator_name_from_user
from apps.kuaivision.models.vision import (
    VisionInspectionEvent,
    VisionInspectionImage,
    VisionMeasurement,
    VisionRecipe,
    VisionReviewTask,
)
from apps.kuaivision.schemas.vision import (
    InspectionImageOut,
    MeasurementOut,
    ReviewComplete,
    ReviewTaskDetail,
    ReviewTaskItem,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class ReviewService:
    @staticmethod
    async def _event_map(tenant_id: int, event_ids: List[int]) -> dict[int, VisionInspectionEvent]:
        if not event_ids:
            return {}
        rows = await VisionInspectionEvent.filter(
            tenant_id=tenant_id, id__in=event_ids, deleted_at__isnull=True
        )
        return {int(r.id): r for r in rows}

    @staticmethod
    def _to_item(task: VisionReviewTask, event: Optional[VisionInspectionEvent]) -> ReviewTaskItem:
        return ReviewTaskItem(
            uuid=task.uuid,
            id=task.id,
            status=task.status,
            original_judgment=task.original_judgment,
            reviewed_judgment=task.reviewed_judgment,
            reason=task.reason,
            reviewed_at=task.reviewed_at,
            reviewed_by_name=task.reviewed_by_name,
            event_uuid=event.uuid if event else None,
            event_id=event.event_id if event else None,
            occurred_at=event.occurred_at if event else None,
            confidence=event.confidence if event else None,
            recipe_code=event.recipe_code if event else None,
            station_code=event.station_code if event else None,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )

    @staticmethod
    async def ensure_pending_for_event(
        tenant_id: int,
        event: VisionInspectionEvent,
        *,
        recipe: Optional[VisionRecipe] = None,
    ) -> Optional[VisionReviewTask]:
        """UNKNOWN 或置信度低于方案阈值时建待复核（幂等）。"""
        need = False
        if str(event.judgment or "").upper() == "UNKNOWN":
            need = True
        threshold = recipe.review_threshold if recipe else None
        if threshold is not None and event.confidence is not None:
            if Decimal(str(event.confidence)) < Decimal(str(threshold)):
                need = True
        if not need:
            return None
        existing = await VisionReviewTask.get_or_none(
            tenant_id=tenant_id,
            event_id=event.id,
            deleted_at__isnull=True,
        )
        if existing:
            return existing
        task = VisionReviewTask(
            tenant_id=tenant_id,
            event_id=event.id,
            status="pending",
            original_judgment=event.judgment,
        )
        await task.save()
        return task

    @staticmethod
    async def list_tasks(
        tenant_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
    ) -> Tuple[List[ReviewTaskItem], int]:
        qs = VisionReviewTask.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            qs = qs.filter(status=status)
        total = await qs.count()
        rows = await qs.order_by("-id").offset((page - 1) * page_size).limit(page_size)
        events = await ReviewService._event_map(tenant_id, [r.event_id for r in rows])
        return [ReviewService._to_item(r, events.get(r.event_id)) for r in rows], total

    @staticmethod
    async def get_detail(tenant_id: int, uuid: str) -> ReviewTaskDetail:
        task = await VisionReviewTask.get_or_none(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True)
        if not task:
            raise NotFoundError("复核任务不存在")
        event = await VisionInspectionEvent.get_or_none(
            tenant_id=tenant_id, id=task.event_id, deleted_at__isnull=True
        )
        base = ReviewService._to_item(task, event)
        measurements: List[MeasurementOut] = []
        images: List[InspectionImageOut] = []
        if event:
            ms = await VisionMeasurement.filter(
                tenant_id=tenant_id, event_id=event.id, deleted_at__isnull=True
            ).order_by("id")
            measurements = [MeasurementOut(name=m.name, value=m.value, unit=m.unit) for m in ms]
            imgs = await VisionInspectionImage.filter(
                tenant_id=tenant_id, event_id=event.id, deleted_at__isnull=True
            ).order_by("sort_order", "id")
            images = [
                InspectionImageOut(object_key=i.object_key, label=i.label, sort_order=i.sort_order)
                for i in imgs
            ]
        return ReviewTaskDetail(**base.model_dump(), measurements=measurements, images=images)

    @staticmethod
    async def complete(
        tenant_id: int, uuid: str, data: ReviewComplete, user: Optional[User]
    ) -> ReviewTaskDetail:
        task = await VisionReviewTask.get_or_none(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True)
        if not task:
            raise NotFoundError("复核任务不存在")
        if task.status == "done":
            raise ValidationError("该任务已复核")
        judgment = str(data.reviewed_judgment or "").upper()
        if judgment not in {"OK", "NG", "UNKNOWN"}:
            raise ValidationError("reviewed_judgment 仅允许 OK / NG / UNKNOWN")
        task.status = "done"
        task.reviewed_judgment = judgment
        task.reason = data.reason
        task.reviewed_at = resolve_business_datetime()
        if user is not None:
            task.reviewed_by = int(user.id)
            task.reviewed_by_name = operator_name_from_user(user)
        apply_update_audit(task, user)
        await task.save()

        event = await VisionInspectionEvent.get_or_none(
            tenant_id=tenant_id, id=task.event_id, deleted_at__isnull=True
        )
        if event:
            event.judgment = judgment
            apply_update_audit(event, user)
            await event.save()
        return await ReviewService.get_detail(tenant_id, task.uuid)

    @staticmethod
    async def pending_count(tenant_id: int) -> int:
        return await VisionReviewTask.filter(
            tenant_id=tenant_id, status="pending", deleted_at__isnull=True
        ).count()
