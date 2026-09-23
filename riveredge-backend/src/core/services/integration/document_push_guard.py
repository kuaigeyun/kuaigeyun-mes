"""外推熔断 / 配额 / 同单 in-flight（进程内最小可用）。

维度键：tenant_id × category × connector_type × target_profile。
dry_run 不占配额、不触发熔断、不占同单锁。
"""

from __future__ import annotations

import time
from contextlib import contextmanager
from dataclasses import dataclass
from threading import Lock
from typing import Dict, Iterator, Set, Tuple

from infra.exceptions.exceptions import ValidationError
from infra.utils.simple_rate_limit import SlidingWindowRateLimiter

DimKey = Tuple[int, str, str, str]
SourceInflightKey = Tuple[int, str, int, str]


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


class DocumentPushSourceInflight:
    """同一源单据 × 目标 profile 外推互斥，拒绝并发重复请求。"""

    def __init__(self) -> None:
        self._lock = Lock()
        self._inflight: Set[SourceInflightKey] = set()

    @staticmethod
    def key(
        tenant_id: int,
        *,
        source_type: str,
        source_id: int,
        target_profile: str,
    ) -> SourceInflightKey:
        return (
            int(tenant_id),
            str(source_type or "").strip(),
            int(source_id),
            str(target_profile or "").strip(),
        )

    def try_acquire(self, key: SourceInflightKey) -> bool:
        with self._lock:
            if key in self._inflight:
                return False
            self._inflight.add(key)
            return True

    def release(self, key: SourceInflightKey) -> None:
        with self._lock:
            self._inflight.discard(key)

    @contextmanager
    def hold(
        self,
        tenant_id: int,
        *,
        source_type: str,
        source_id: int,
        target_profile: str,
        dry_run: bool = False,
    ) -> Iterator[None]:
        if dry_run:
            yield
            return
        key = self.key(
            tenant_id,
            source_type=source_type,
            source_id=source_id,
            target_profile=target_profile,
        )
        if not self.try_acquire(key):
            raise ValidationError("该单据正在推送中，请勿重复提交")
        try:
            yield
        finally:
            self.release(key)


document_push_source_inflight = DocumentPushSourceInflight()


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
