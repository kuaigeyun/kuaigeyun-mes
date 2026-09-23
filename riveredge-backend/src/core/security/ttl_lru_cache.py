"""进程内 TTL 缓存（限流旁路 / 幂等结果），有上限避免内存涨。"""

from __future__ import annotations

import time
from collections import OrderedDict
from threading import Lock
from typing import Generic, Optional, TypeVar

T = TypeVar("T")


class TtlLruCache(Generic[T]):
    def __init__(self, *, max_size: int = 10000, default_ttl_seconds: float = 60.0) -> None:
        self.max_size = max(100, int(max_size))
        self.default_ttl_seconds = float(default_ttl_seconds)
        self._data: OrderedDict[str, tuple[float, T]] = OrderedDict()
        self._lock = Lock()

    def get(self, key: str) -> Optional[T]:
        now = time.monotonic()
        with self._lock:
            item = self._data.get(key)
            if item is None:
                return None
            expires_at, value = item
            if expires_at <= now:
                self._data.pop(key, None)
                return None
            self._data.move_to_end(key)
            return value

    def set(self, key: str, value: T, *, ttl_seconds: Optional[float] = None) -> None:
        ttl = self.default_ttl_seconds if ttl_seconds is None else float(ttl_seconds)
        expires_at = time.monotonic() + max(0.1, ttl)
        with self._lock:
            self._data[key] = (expires_at, value)
            self._data.move_to_end(key)
            while len(self._data) > self.max_size:
                self._data.popitem(last=False)

    def delete(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)
