"""AI 审计日志聚合统计（只读）。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from core.ai.schemas.stats import (
    AiAuditLogItem,
    AiAuditLogListResponse,
    AiCapabilityStat,
    AiDayStat,
    AiStatsOverviewResponse,
)
from core.models.ai_audit_log import AiAuditLog
from core.utils.timezone_utils import to_api_isoformat


class AiStatsService:
    @staticmethod
    async def get_overview(*, tenant_id: int, days: int = 7) -> AiStatsOverviewResponse:
        days = max(1, min(int(days or 7), 90))
        since = datetime.now(timezone.utc) - timedelta(days=days)

        base_qs = AiAuditLog.filter(tenant_id=tenant_id, created_at__gte=since)
        total_calls = await base_qs.count()

        logs = await base_qs.all()
        avg_latency: Optional[int] = None
        latencies = [row.latency_ms for row in logs if row.latency_ms is not None]
        if latencies:
            avg_latency = int(sum(latencies) / len(latencies))

        cap_map: Dict[str, int] = {}
        day_map: Dict[str, int] = {}
        for row in logs:
            cap = (row.capability or "unknown").strip() or "unknown"
            cap_map[cap] = cap_map.get(cap, 0) + 1
            day_key = row.created_at.astimezone(timezone.utc).strftime("%Y-%m-%d")
            day_map[day_key] = day_map.get(day_key, 0) + 1

        by_capability = [
            AiCapabilityStat(capability=k, count=v)
            for k, v in sorted(cap_map.items(), key=lambda x: (-x[1], x[0]))
        ]

        day_cursor = since.astimezone(timezone.utc).date()
        end_day = datetime.now(timezone.utc).date()
        by_day: List[AiDayStat] = []
        while day_cursor <= end_day:
            key = day_cursor.isoformat()
            by_day.append(AiDayStat(day=key, count=day_map.get(key, 0)))
            day_cursor += timedelta(days=1)

        pulse_count = await AiStatsService._pulse_suggestion_count(tenant_id)
        knowledge_count = await AiStatsService._knowledge_document_count(tenant_id)

        empty_reason: Optional[str] = None
        if total_calls == 0:
            empty_reason = "统计周期内暂无 AI 调用审计记录，使用 KU-AI 后将自动采集"

        return AiStatsOverviewResponse(
            days=days,
            total_calls=total_calls,
            avg_latency_ms=avg_latency,
            pulse_suggestion_count=pulse_count,
            knowledge_document_count=knowledge_count,
            by_capability=by_capability,
            by_day=by_day,
            empty_reason=empty_reason,
        )

    @staticmethod
    async def list_audit_logs(
        *,
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        capability: Optional[str] = None,
    ) -> AiAuditLogListResponse:
        page = max(1, int(page or 1))
        page_size = max(1, min(int(page_size or 20), 100))

        qs = AiAuditLog.filter(tenant_id=tenant_id)
        if capability:
            qs = qs.filter(capability=capability.strip())

        total = await qs.count()
        rows = (
            await qs.order_by("-created_at")
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        items = [
            AiAuditLogItem(
                uuid=row.uuid,
                route=row.route,
                capability=row.capability,
                model=row.model,
                latency_ms=row.latency_ms,
                prompt_tokens=row.prompt_tokens,
                completion_tokens=row.completion_tokens,
                status_code=row.status_code,
                error_message=row.error_message,
                created_at=to_api_isoformat(row.created_at) or "",
                user_id=row.user_id,
            )
            for row in rows
        ]

        empty_reason: Optional[str] = None
        if total == 0:
            empty_reason = "暂无 AI 审计记录"

        return AiAuditLogListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            empty_reason=empty_reason,
        )

    @staticmethod
    async def _pulse_suggestion_count(tenant_id: int) -> int:
        try:
            from apps.kuaiai.services.suggestion_service import SuggestionService

            service = SuggestionService()
            items = await service.get_pulse_suggestions(tenant_id)
            return len(items or [])
        except ImportError:
            return 0
        except Exception:
            return 0

    @staticmethod
    async def _knowledge_document_count(tenant_id: int) -> int:
        try:
            from apps.kuaiai.models.knowledge import KuaiKnowledgeDocument

            return await KuaiKnowledgeDocument.filter(tenant_id=tenant_id, deleted_at__isnull=True).count()
        except ImportError:
            return 0
        except Exception:
            return 0
