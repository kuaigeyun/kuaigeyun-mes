"""写接口路径分级（限流 / 软幂等），O(路径扫描) 无 IO。"""

from __future__ import annotations

import re

from core.utils.interactive_client_guard import is_client_channel_guard_exempt_path

WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# 关键状态流转 / 下推 / 确认（短窗软幂等 + 更严限流）
_CRITICAL_PATH_RE = re.compile(
    r"/(submit|approve|unapprove|reject|confirm|withdraw|release|revoke|execute|"
    r"complete|freeze|unfreeze|push-[a-z0-9\-]+|pull-from-[a-z0-9\-]+|"
    r"generate-orders|push-all|recompute|firm-planned)(/|$)",
    re.IGNORECASE,
)

IDEMPOTENCY_HEADER = "Idempotency-Key"


def is_api_write(method: str, path: str) -> bool:
    if method not in WRITE_METHODS:
        return False
    if not (path or "").startswith("/api/"):
        return False
    if is_client_channel_guard_exempt_path(path):
        return False
    return True


def is_critical_write_path(path: str) -> bool:
    return bool(_CRITICAL_PATH_RE.search(path or ""))
