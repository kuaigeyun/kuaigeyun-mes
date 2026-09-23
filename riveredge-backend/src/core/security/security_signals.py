"""轻量安全信号：计数 + 周期性 warning，不打 DB。"""

from __future__ import annotations

import time
from threading import Lock
from typing import DefaultDict
from collections import defaultdict

from loguru import logger


class SecuritySignals:
    def __init__(self, *, window_seconds: float = 60.0, warn_every: int = 20) -> None:
        self.window_seconds = window_seconds
        self.warn_every = max(1, int(warn_every))
        self._counts: DefaultDict[str, int] = defaultdict(int)
        self._window_start = time.monotonic()
        self._lock = Lock()

    def hit(self, name: str, *, detail: str = "") -> None:
        with self._lock:
            now = time.monotonic()
            if now - self._window_start >= self.window_seconds:
                self._counts.clear()
                self._window_start = now
            self._counts[name] += 1
            n = self._counts[name]
            if n == 1 or n % self.warn_every == 0:
                logger.warning(
                    "security_signal name={} count={} detail={}",
                    name,
                    n,
                    detail[:200],
                )


security_signals = SecuritySignals()
