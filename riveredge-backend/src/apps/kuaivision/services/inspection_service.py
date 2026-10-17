"""检测记录查询。"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Tuple

from tortoise.expressions import Q

from apps.kuaivision.models.vision import (
    VisionAgent,
    VisionInspectionEvent,
    VisionInspectionImage,
    VisionMeasurement,
)
from apps.kuaivision.schemas.vision import (
    DashboardSummary,
    InspectionDetail,
    InspectionImageOut,
    InspectionListItem,
    MeasurementOut,
)
from core.utils.timezone_utils import now_utc, to_site_date
from infra.exceptions.exceptions import NotFoundError


class InspectionService:
    @staticmethod
    async def _thickness_map(tenant_id: int, event_ids: List[int]) -> dict[int, Decimal]:
        if not event_ids:
            return {}
        rows = await VisionMeasurement.filter(
            tenant_id=tenant_id,
            event_id__in=event_ids,
            deleted_at__isnull=True,
            name="thickness_mm",
        )
        return {int(r.event_id): r.value for r in rows if r.value is not None}

    @staticmethod
    async def _agent_code_map(tenant_id: int, agent_ids: List[int]) -> dict[int, str]:
        ids = [i for i in agent_ids if i]
        if not ids:
            return {}
        rows = await VisionAgent.filter(tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True)
        return {int(r.id): r.code for r in rows}

    @staticmethod
    def _to_list_item(
        event: VisionInspectionEvent,
        thickness: Optional[Decimal],
        agent_code: Optional[str] = None,
    ) -> InspectionListItem:
        return InspectionListItem(
            uuid=event.uuid,
            event_id=event.event_id,
            occurred_at=event.occurred_at,
            judgment=event.judgment,
            confidence=event.confidence,
            recipe_code=event.recipe_code,
            recipe_version=event.recipe_version,
            station_code=event.station_code,
            camera_code=event.camera_code,
            agent_code=agent_code,
            duration_ms=event.duration_ms,
            work_order_code=event.work_order_code,
            batch_no=event.batch_no,
            thickness_mm=thickness,
            created_by_name=getattr(event, "created_by_name", None),
            updated_by_name=getattr(event, "updated_by_name", None),
            created_at=event.created_at,
            updated_at=event.updated_at,
        )

    @staticmethod
    async def list_inspections(
        tenant_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
        q: Optional[str] = None,
        judgment: Optional[str] = None,
        station_code: Optional[str] = None,
        recipe_code: Optional[str] = None,
    ) -> Tuple[List[InspectionListItem], int]:
        qs = VisionInspectionEvent.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if judgment:
            qs = qs.filter(judgment=judgment.upper())
        if station_code:
            qs = qs.filter(station_code=station_code)
        if recipe_code:
            qs = qs.filter(recipe_code=recipe_code)
        if q:
            qs = qs.filter(
                Q(event_id__icontains=q)
                | Q(work_order_code__icontains=q)
                | Q(batch_no__icontains=q)
                | Q(station_code__icontains=q)
                | Q(recipe_code__icontains=q)
            )
        total = await qs.count()
        events = await qs.order_by("-occurred_at", "-id").offset((page - 1) * page_size).limit(page_size)
        thickness = await InspectionService._thickness_map(tenant_id, [e.id for e in events])
        agent_codes = await InspectionService._agent_code_map(
            tenant_id, [int(e.agent_id) for e in events if e.agent_id]
        )
        items = [
            InspectionService._to_list_item(
                e, thickness.get(e.id), agent_codes.get(int(e.agent_id)) if e.agent_id else None
            )
            for e in events
        ]
        return items, total

    @staticmethod
    async def get_detail(tenant_id: int, uuid: str) -> InspectionDetail:
        event = await VisionInspectionEvent.get_or_none(
            tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True
        )
        if not event:
            raise NotFoundError("检测记录不存在")
        measurements = await VisionMeasurement.filter(
            tenant_id=tenant_id, event_id=event.id, deleted_at__isnull=True
        ).order_by("id")
        images = await VisionInspectionImage.filter(
            tenant_id=tenant_id, event_id=event.id, deleted_at__isnull=True
        ).order_by("sort_order", "id")
        thickness = None
        for m in measurements:
            if m.name == "thickness_mm" and m.value is not None:
                thickness = m.value
                break
        agent_code = None
        if event.agent_id:
            agent = await VisionAgent.get_or_none(
                tenant_id=tenant_id, id=event.agent_id, deleted_at__isnull=True
            )
            agent_code = agent.code if agent else None
        base = InspectionService._to_list_item(event, thickness, agent_code)
        return InspectionDetail(
            **base.model_dump(),
            operation_code=event.operation_code,
            duration_ms=event.duration_ms,
            step_results=event.step_results,
            remark=event.remark,
            measurements=[
                MeasurementOut(name=m.name, value=m.value, unit=m.unit) for m in measurements
            ],
            images=[
                InspectionImageOut(object_key=i.object_key, label=i.label, sort_order=i.sort_order)
                for i in images
            ],
        )

    @staticmethod
    async def dashboard_summary(tenant_id: int) -> DashboardSummary:
        from apps.kuaivision.models.vision import VisionAgent

        today = to_site_date(now_utc())
        # 简化：最近事件按站点日历日过滤；量大后改为 UTC 日界区间查询。
        recent = await VisionInspectionEvent.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).order_by("-occurred_at").limit(5000)
        today_events = [e for e in recent if to_site_date(e.occurred_at) == today]
        ok = sum(1 for e in today_events if e.judgment == "OK")
        ng = sum(1 for e in today_events if e.judgment == "NG")
        unknown = sum(1 for e in today_events if e.judgment == "UNKNOWN")
        total = len(today_events)
        ok_rate = (ok / total) if total else None
        from apps.kuaivision.services.review_service import ReviewService

        agent_qs = VisionAgent.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        agent_count = await agent_qs.count()
        agent_enabled = await agent_qs.filter(is_enabled=True).count()
        last_agent = await VisionAgent.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, last_heartbeat_at__isnull=False
        ).order_by("-last_heartbeat_at").first()
        pending_reviews = await ReviewService.pending_count(tenant_id)
        return DashboardSummary(
            events_today=total,
            ok_today=ok,
            ng_today=ng,
            unknown_today=unknown,
            ok_rate_today=ok_rate,
            agent_count=agent_count,
            agent_enabled=agent_enabled,
            pending_reviews=pending_reviews,
            last_agent_heartbeat_at=last_agent.last_heartbeat_at if last_agent else None,
        )
