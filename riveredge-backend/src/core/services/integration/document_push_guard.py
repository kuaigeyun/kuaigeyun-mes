"""外推熔断 / 配额（进程内最小可用）。

维度键：tenant_id × category × connector_type × target_profile。
dry_run 不占配额、不触发熔断。
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from threading import Lock
from typing import Dict, Tuple

from infra.exceptions.exceptions import ValidationError
from infra.utils.simple_rate_limit import SlidingWindowRateLimiter

DimKey = Tuple[int, str, str, str]


@dataclass
class CircuitState:
    consecutive_failures: int = 0
    opened_until: float = 0.0


class DocumentPushGuard:
    def __init__(
        self,
        *,
        max_calls_per_minute: int = 60,
        failure_threshold: int = 5,
        cooldown_seconds: float = 60.0,
    ) -> None:
        self._limiter = SlidingWindowRateLimiter(
            max_calls=max(1, int(max_calls_per_minute)),
            window_seconds=60,
        )
        self._failure_threshold = max(1, int(failure_threshold))
        self._cooldown_seconds = max(1.0, float(cooldown_seconds))
        self._circuits: Dict[DimKey, CircuitState] = {}
        self._lock = Lock()

    @staticmethod
    def dim_key(
        tenant_id: int,
        *,
        category: str,
        connector_type: str,
        target_profile: str,
    ) -> DimKey:
        return (
            int(tenant_id),
            str(category or "other").strip() or "other",
            str(connector_type or "").strip() or "unknown",
            str(target_profile or "").strip() or "unknown",
        )

    def _rate_key(self, key: DimKey) -> str:
        return "|".join(str(part) for part in key)

    def assert_allowed(
        self,
        tenant_id: int,
        *,
        category: str,
        connector_type: str,
        target_profile: str,
        dry_run: bool = False,
    ) -> None:
        if dry_run:
            return
        key = self.dim_key(
            tenant_id,
            category=category,
            connector_type=connector_type,
            target_profile=target_profile,
        )
        now = time.monotonic()
        with self._lock:
            state = self._circuits.get(key) or CircuitState()
            if state.opened_until > now:
                remain = int(state.opened_until - now) + 1
                raise ValidationError(
                    f"外推熔断中（{category}/{connector_type}/{target_profile}），"
                    f"约 {remain}s 后可重试"
                )
            if not self._limiter.allow(self._rate_key(key)):
                raise ValidationError(
                    f"外推配额超限（{category}/{connector_type}/{target_profile}），"
                    "请稍后再试"
                )

    def record_outcome(
        self,
        tenant_id: int,
        *,
        category: str,
        connector_type: str,
        target_profile: str,
        success: bool,
        dry_run: bool = False,
    ) -> None:
        if dry_run:
            return
        key = self.dim_key(
            tenant_id,
            category=category,
            connector_type=connector_type,
            target_profile=target_profile,
        )
        now = time.monotonic()
        with self._lock:
            state = self._circuits.get(key) or CircuitState()
            if success:
                state.consecutive_failures = 0
                state.opened_until = 0.0
            else:
                state.consecutive_failures += 1
                if state.consecutive_failures >= self._failure_threshold:
                    state.opened_until = now + self._cooldown_seconds
                    state.consecutive_failures = 0
            self._circuits[key] = state


document_push_guard = DocumentPushGuard()


def resolve_push_dimensions(
    *,
    target_profile: str,
    connector_type: str | None = None,
) -> tuple[str, str, str]:
    from core.services.integration.document_push_pipeline import (
        category_for_connector_type,
    )
    from core.services.integration.document_push_readiness import (
        connector_type_for_profile,
    )

    profile = str(target_profile or "").strip()
    ctype = str(connector_type or "").strip() or connector_type_for_profile(profile)
    category = category_for_connector_type(ctype) or "other"
    return category, ctype, profile
