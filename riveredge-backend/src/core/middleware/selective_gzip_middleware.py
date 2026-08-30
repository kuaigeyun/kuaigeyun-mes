"""GZip 选择：流式 NDJSON/SSE 进度不可压缩缓冲，否则前端一直停在「正在处理…」。"""

from __future__ import annotations

from typing import Callable

from starlette.middleware.gzip import GZipMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send


def _should_skip_gzip(scope: Scope) -> bool:
    if scope.get("type") != "http":
        return False
    qs = (scope.get("query_string") or b"").decode("latin-1")
    if "stream=true" in qs or "stream=1" in qs:
        return True
    # Accept 显式要流式进度时也不走 GZip
    headers = {
        k.decode("latin-1").lower(): v.decode("latin-1")
        for k, v in (scope.get("headers") or [])
    }
    accept = headers.get("accept", "")
    return "application/x-ndjson" in accept or "text/event-stream" in accept


class SelectiveGZipMiddleware:
    """对 sync stream 跳过 GZip，其余请求仍走 Starlette GZipMiddleware。"""

    def __init__(self, app: ASGIApp, minimum_size: int = 500, compresslevel: int = 9) -> None:
        self.app = app
        self.gzip = GZipMiddleware(app, minimum_size=minimum_size, compresslevel=compresslevel)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if _should_skip_gzip(scope):
            await self.app(scope, receive, send)
            return
        await self.gzip(scope, receive, send)
