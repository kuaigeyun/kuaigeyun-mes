"""外推 SLO：category × connector_type × target_profile。dry_run 单独计数。"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock
from typing import Dict, List, Tuple

DimKey = Tuple[str, str, str]


@dataclass
class PushSloBucket:
    attempts: int = 0
    success: int = 0
    failed: int = 0
    dry_run: int = 0
    duration_ms_sum: int = 0
    duration_ms_max: int = 0

    def record(self, *, success: bool, duration_ms: int, dry_run: bool) -> None:
        if dry_run:
            self.dry_run += 1
            return
        self.attempts += 1
        if success:
            self.success += 1
        else:
            self.failed += 1
        ms = max(0, int(duration_ms or 0))
        self.duration_ms_sum += ms
        if ms > self.duration_ms_max:
            self.duration_ms_max = ms

    def as_dict(self) -> dict:
        avg = round(self.duration_ms_sum / self.attempts, 2) if self.attempts else 0.0
        rate = round(self.success / self.attempts, 4) if self.attempts else 0.0
        return {
            "attempts": self.attempts,
            "success": self.success,
            "failed": self.failed,
            "dry_run": self.dry_run,
            "success_rate": rate,
            "duration_ms_avg": avg,
            "duration_ms_max": self.duration_ms_max,
        }


@dataclass
class DocumentPushSloRegistry:
    _buckets: Dict[DimKey, PushSloBucket] = field(default_factory=dict)
    _lock: Lock = field(default_factory=Lock)

    def record(
        self,
        *,
        category: str,
        connector_type: str,
        target_profile: str,
        success: bool,
        duration_ms: int = 0,
        dry_run: bool = False,
    ) -> None:
        key = (
            str(category or "other").strip() or "other",
            str(connector_type or "").strip() or "unknown",
            str(target_profile or "").strip() or "unknown",
        )
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = PushSloBucket()
                self._buckets[key] = bucket
            bucket.record(success=success, duration_ms=duration_ms, dry_run=dry_run)

    def snapshot(self) -> List[dict]:
        with self._lock:
            rows: List[dict] = []
            for (category, connector_type, target_profile), bucket in sorted(
                self._buckets.items()
            ):
                row = bucket.as_dict()
                row.update(
                    {
                        "category": category,
                        "connector_type": connector_type,
                        "target_profile": target_profile,
                    }
                )
                rows.append(row)
            return rows


document_push_slo = DocumentPushSloRegistry()
