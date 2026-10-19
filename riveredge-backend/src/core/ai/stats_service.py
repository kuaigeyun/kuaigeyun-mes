"""AI 审计日志聚合统计（只读）。"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from tortoise.functions import Count

from core.ai.schemas.stats import (
    AiAuditLogItem,
    AiAuditLogListResponse,
    AiCapabilityStat,
    AiDayStat,
    AiStatsOverviewResponse,
)
from core.models.ai_audit_log import AiAuditLog
from core.utils.timezone_utils import to_api_isoformat

# Pulse 规则引擎较重：短 TTL 进程内缓存，避免 hub 连点刷新重复扫业务表
_PULSE_COUNT_CACHE: Dict[int, Tuple[float, int]] = {}
_PULSE_COUNT_TTL_SEC = 60.0


class AiStatsService:
    @staticmethod
    async def get_capability_call_counts(*, tenant_id: int, days: int = 7) -> Dict[str, int]:
        """仅按能力聚合调用次数（能力矩阵目录用，不跑 Pulse / 知识库计数）。"""
        days = max(1, min(int(days or 7), 90))
        since = datetime.now(timezone.utc) - timedelta(days=days)
        rows = (
            await AiAuditLog.filter(tenant_id=tenant_id, created_at__gte=since)
            .annotate(c=Count("id"))
            .group_by("capability")
            .values("capability", "c")
        )
        out: Dict[str, int] = {}
        for row in rows:
            key = (row.get("capability") or "unknown").strip() or "unknown"
            out[key] = int(row.get("c") or 0)
        return out

    @staticmethod
    async def get_overview(
        *,
        tenant_id: int,
        days: int = 7,
        include_pulse: bool = False,
    ) -> AiStatsOverviewResponse:
        days = max(1, min(int(days or 7), 90))
        since = datetime.now(timezone.utc) - timedelta(days=days)

        async def _audit_bundle() -> tuple[int, Optional[int], List[AiCapabilityStat], List[AiDayStat]]:
            # 单次只取聚合列，避免整行 ORM + 多次扫表
            rows = await AiAuditLog.filter(tenant_id=tenant_id, created_at__gte=since).values(
                "created_at", "latency_ms", "capability"
            )
            total_calls = len(rows)
            latencies = [row["latency_ms"] for row in rows if row.get("latency_ms") is not None]
            avg_latency = int(sum(latencies) / len(latencies)) if latencies else None

            cap_map: Dict[str, int] = {}
            day_map: Dict[str, int] = {}
            for row in rows:
                key = (row.get("capability") or "unknown").strip() or "unknown"
                cap_map[key] = cap_map.get(key, 0) + 1
                created = row.get("created_at")
                if created is None:
                    continue
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                day_key = created.astimezone(timezone.utc).strftime("%Y-%m-%d")
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
            return total_calls, avg_latency, by_capability, by_day

        audit_coro = _audit_bundle()
        knowledge_coro = AiStatsService._knowledge_document_count(tenant_id)
        if include_pulse:
            (total_calls, avg_latency, by_capability, by_day), knowledge_count, pulse_count = (
                await asyncio.gather(
                    audit_coro,
                    knowledge_coro,
                    AiStatsService.get_pulse_suggestion_count(tenant_id),
                )
            )
        else:
            (total_calls, avg_latency, by_capability, by_day), knowledge_count = await asyncio.gather(
                audit_coro,
                knowledge_coro,
            )
            pulse_count = 0

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
    async def get_pulse_suggestion_count(tenant_id: int) -> int:
        now = time.monotonic()
        cached = _PULSE_COUNT_CACHE.get(tenant_id)
        if cached and (now - cached[0]) < _PULSE_COUNT_TTL_SEC:
            return cached[1]
        count = await AiStatsService._pulse_suggestion_count_uncached(tenant_id)
        _PULSE_COUNT_CACHE[tenant_id] = (now, count)
        return count

    @staticmethod
    async def _pulse_suggestion_count_uncached(tenant_id: int) -> int:
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
