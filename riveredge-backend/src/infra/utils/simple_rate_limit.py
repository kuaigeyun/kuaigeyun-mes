"""进程内滑动窗口限流（用于公开登记接口等轻量场景）。"""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock
from typing import DefaultDict, List


class SlidingWindowRateLimiter:
    def __init__(self, *, max_calls: int, window_seconds: int) -> None:
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self._events: DefaultDict[str, List[float]] = defaultdict(list)
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            bucket = self._events[key]
            self._events[key] = [ts for ts in bucket if ts >= cutoff]
            if len(self._events[key]) >= self.max_calls:
                return False
            self._events[key].append(now)
            return True
