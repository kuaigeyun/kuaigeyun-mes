"""API 幂等中间件（轻量）：

- Idempotency-Key：缓存成功 JSON 响应短时回放
- 关键路径无键：短窗内重复提交返回 409（不缓存大体，防连点）

不读请求体；显式键时读取响应流并回写（仅成功且体较小）。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Optional

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.security.security_signals import security_signals
from core.security.ttl_lru_cache import TtlLruCache
from core.security.write_path_policy import (
    IDEMPOTENCY_HEADER,
    is_api_write,
    is_critical_write_path,
)
from infra.exceptions.exceptions import ConflictError, create_error_response
from infra.utils.request_identity import get_request_tenant_id, get_request_user_id

_INFLIGHT = object()
_SOFT_DONE = object()


@dataclass
class _CachedResponse:
    status_code: int
    body: bytes
    media_type: str
    headers: dict[str, str]


class ApiIdempotencyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._cache: TtlLruCache[Any] = TtlLruCache(max_size=8000, default_ttl_seconds=300.0)
        logger.info("API 幂等中间件已初始化")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self._enabled():
            return await call_next(request)
        path = request.url.path or ""
        if not is_api_write(request.method, path):
            return await call_next(request)

        tenant_id = get_request_tenant_id(request) or 0
        user_id = get_request_user_id(request) or 0
        explicit = (request.headers.get(IDEMPOTENCY_HEADER) or "").strip()
        soft_ttl = self._soft_ttl()
        explicit_ttl = self._explicit_ttl()

        mode = "none"
        cache_key: Optional[str] = None
        ttl = soft_ttl
        if explicit:
            mode = "explicit"
            cache_key = f"idem:{tenant_id}:{user_id}:{explicit[:128]}"
            ttl = explicit_ttl
        elif is_critical_write_path(path) and user_id:
            mode = "soft"
            cache_key = f"soft:{tenant_id}:{user_id}:{request.method}:{path}"
            ttl = soft_ttl

        if not cache_key:
            return await call_next(request)

        cached = self._cache.get(cache_key)
        if cached is _INFLIGHT:
            security_signals.hit("idempotency_inflight", detail=path)
            return self._conflict(path, "相同请求正在处理中，请勿重复提交")
        if mode == "soft" and cached is _SOFT_DONE:
            security_signals.hit("idempotency_soft_reject", detail=path)
            return self._conflict(path, "请勿重复提交")
        if mode == "explicit" and isinstance(cached, _CachedResponse):
            security_signals.hit("idempotency_replay", detail=path)
            return Response(
                content=cached.body,
                status_code=cached.status_code,
                media_type=cached.media_type,
                headers={**cached.headers, "X-Idempotency-Replay": "1"},
            )

        self._cache.set(cache_key, _INFLIGHT, ttl_seconds=max(ttl, 5.0))
        try:
            response = await call_next(request)
            if not (200 <= response.status_code < 300):
                self._cache.delete(cache_key)
                return response

            if mode == "soft":
                self._cache.set(cache_key, _SOFT_DONE, ttl_seconds=ttl)
                return response

            # explicit：读取响应体以便回放
            raw_b = await self._read_body(response)
            if 0 < len(raw_b) <= 256 * 1024:
                ctype = (response.headers.get("content-type") or "application/json").split(";", 1)[
                    0
                ].strip()
                hop = {
                    k: v
                    for k, v in response.headers.items()
                    if k.lower() in ("content-type", "location")
                }
                self._cache.set(
                    cache_key,
                    _CachedResponse(
                        status_code=response.status_code,
                        body=raw_b,
                        media_type=ctype or "application/json",
                        headers=hop,
                    ),
                    ttl_seconds=ttl,
                )
                return Response(
                    content=raw_b,
                    status_code=response.status_code,
                    media_type=ctype or "application/json",
                    headers=dict(response.headers),
                )

            self._cache.delete(cache_key)
            return Response(
                content=raw_b,
                status_code=response.status_code,
                media_type=response.media_type,
                headers=dict(response.headers),
            )
        except Exception:
            self._cache.delete(cache_key)
            raise

    @staticmethod
    async def _read_body(response: Response) -> bytes:
        raw = getattr(response, "body", None)
        if isinstance(raw, (bytes, bytearray)) and raw:
            return bytes(raw)
        chunks: list[bytes] = []
        iterator = getattr(response, "body_iterator", None)
        if iterator is None:
            return b""
        async for chunk in iterator:
            if isinstance(chunk, bytes):
                chunks.append(chunk)
            else:
                chunks.append(bytes(chunk))
        return b"".join(chunks)

    @staticmethod
    def _conflict(path: str, message: str) -> JSONResponse:
        exc = ConflictError(message)
        return JSONResponse(
            status_code=exc.status_code,
            content=create_error_response(exc, request_path=path),
        )

    @staticmethod
    def _enabled() -> bool:
        try:
            from infra.config.infra_config import infra_settings

            return bool(getattr(infra_settings, "API_IDEMPOTENCY_GUARD_ENABLED", True))
        except Exception:
            return True

    @staticmethod
    def _soft_ttl() -> float:
        try:
            from infra.config.infra_config import infra_settings

            return float(getattr(infra_settings, "API_IDEMPOTENCY_SOFT_TTL_SECONDS", 2.5) or 2.5)
        except Exception:
            return 2.5

    @staticmethod
    def _explicit_ttl() -> float:
        try:
            from infra.config.infra_config import infra_settings

            return float(getattr(infra_settings, "API_IDEMPOTENCY_TTL_SECONDS", 300) or 300)
        except Exception:
            return 300.0
