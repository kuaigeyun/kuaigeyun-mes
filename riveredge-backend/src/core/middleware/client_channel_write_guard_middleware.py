"""写请求官方客户端渠道门禁（全站）。

对 /api/* 的 POST/PUT/PATCH/DELETE：必须携带白名单 X-Client-Channel。
integration 渠道可配置 IP 允名单。公开认证类接口豁免。
"""

from __future__ import annotations

from typing import Callable

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.security.security_signals import security_signals
from core.utils.client_channel import CLIENT_CHANNEL_HEADER, normalize_client_channel
from core.utils.interactive_client_guard import (
    WRITE_METHODS,
    is_client_channel_guard_exempt_path,
    request_has_official_client_channel,
    resolve_request_client_channel,
)
from infra.exceptions.exceptions import AuthorizationError, create_error_response
from infra.utils.client_ip import get_client_ip


class ClientChannelWriteGuardMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        logger.info("客户端渠道写门禁中间件已初始化")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self._should_guard(request):
            return await call_next(request)

        if not request_has_official_client_channel(request):
            security_signals.hit(
                "client_channel_reject",
                detail=f"{request.method} {request.url.path}",
            )
            exc = AuthorizationError(
                "非官方客户端禁止调用写接口；"
                "请使用系统客户端（携带 X-Client-Channel），"
                "或对接时使用 X-Client-Channel: integration"
            )
            return JSONResponse(
                status_code=exc.status_code,
                content=create_error_response(exc, request_path=request.url.path),
            )

        if not self._integration_ip_allowed(request):
            security_signals.hit(
                "integration_ip_reject",
                detail=f"{get_client_ip(request)} {request.url.path}",
            )
            exc = AuthorizationError("integration 渠道来源 IP 不在允许列表中")
            return JSONResponse(
                status_code=exc.status_code,
                content=create_error_response(exc, request_path=request.url.path),
            )

        return await call_next(request)

    @staticmethod
    def _integration_ip_allowed(request: Request) -> bool:
        code = resolve_request_client_channel(request)
        raw = None
        headers = getattr(request, "headers", None)
        if headers is not None and code is None:
            raw = headers.get(CLIENT_CHANNEL_HEADER) or headers.get(CLIENT_CHANNEL_HEADER.lower())
            code = normalize_client_channel(raw)
        if code != "integration":
            return True
        try:
            from infra.config.infra_config import infra_settings

            allow = list(getattr(infra_settings, "INTEGRATION_CLIENT_IP_ALLOWLIST", []) or [])
        except Exception:
            allow = []
        if not allow:
            return True
        ip = (get_client_ip(request) or "").strip()
        return ip in allow

    @staticmethod
    def _should_guard(request: Request) -> bool:
        try:
            from infra.config.infra_config import infra_settings

            if not bool(getattr(infra_settings, "CLIENT_CHANNEL_WRITE_GUARD_ENABLED", True)):
                return False
        except Exception:
            pass

        if request.method not in WRITE_METHODS:
            return False
        path = request.url.path or ""
        if not path.startswith("/api/"):
            return False
        if is_client_channel_guard_exempt_path(path):
            return False
        return True
