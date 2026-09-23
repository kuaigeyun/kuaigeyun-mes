"""API 写限流中间件：进程内滑动窗口，不读 body、不打 DB。"""

from __future__ import annotations

from typing import Callable

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.security.security_signals import security_signals
from core.security.write_path_policy import is_api_write, is_critical_write_path
from infra.exceptions.exceptions import RateLimitError, create_error_response
from infra.utils.client_ip import get_client_ip
from infra.utils.request_identity import get_request_tenant_id, get_request_user_id
from infra.utils.simple_rate_limit import SlidingWindowRateLimiter


class ApiWriteRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._normal = SlidingWindowRateLimiter(max_calls=120, window_seconds=60)
        self._critical = SlidingWindowRateLimiter(max_calls=30, window_seconds=60)
        self._anon = SlidingWindowRateLimiter(max_calls=30, window_seconds=60)
        logger.info("API 写限流中间件已初始化")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self._enabled():
            return await call_next(request)
        path = request.url.path or ""
        if not is_api_write(request.method, path):
            return await call_next(request)

        tenant_id = get_request_tenant_id(request)
        user_id = get_request_user_id(request)
        critical = is_critical_write_path(path)
        if user_id is not None:
            key = f"u:{tenant_id or 0}:{user_id}:{'c' if critical else 'n'}"
            limiter = self._critical if critical else self._normal
        else:
            ip = get_client_ip(request) or "unknown"
            key = f"ip:{ip}:w"
            limiter = self._anon

        # 允许配置覆盖额度
        self._apply_limits_from_settings()
        if not limiter.allow(key):
            security_signals.hit(
                "rate_limited",
                detail=f"{request.method} {path} key={key}",
            )
            exc = RateLimitError("请求过于频繁，请稍后再试")
            return JSONResponse(
                status_code=exc.status_code,
                content=create_error_response(exc, request_path=path),
                headers={"Retry-After": "60"},
            )
        return await call_next(request)

    def _apply_limits_from_settings(self) -> None:
        try:
            from infra.config.infra_config import infra_settings

            n = int(getattr(infra_settings, "API_WRITE_RATE_LIMIT_PER_MINUTE", 120) or 120)
            c = int(getattr(infra_settings, "API_CRITICAL_WRITE_RATE_LIMIT_PER_MINUTE", 30) or 30)
            self._normal.max_calls = max(1, n)
            self._critical.max_calls = max(1, c)
        except Exception:
            pass

    @staticmethod
    def _enabled() -> bool:
        try:
            from infra.config.infra_config import infra_settings

            return bool(getattr(infra_settings, "API_WRITE_RATE_LIMIT_ENABLED", True))
        except Exception:
            return True
