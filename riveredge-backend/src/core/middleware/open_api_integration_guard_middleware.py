"""integration 渠道强制开放 API 凭证。

对 /api/* 的 POST/PUT/PATCH/DELETE：当 X-Client-Channel 为 integration（含别名）时，
Bearer Token 必须为 typ=open_api 的开放凭证；普通用户 JWT 一律 403。
换票等公开路径豁免。
"""

from __future__ import annotations

from typing import Callable

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.security.security_signals import security_signals
from core.services.open_api.open_api_auth_service import (
    OpenApiAuthService,
    virtual_user_id_for_app,
)
from core.utils.client_channel import CLIENT_CHANNEL_HEADER, normalize_client_channel
from core.utils.interactive_client_guard import (
    WRITE_METHODS,
    is_client_channel_guard_exempt_path,
    resolve_request_client_channel,
)
from infra.exceptions.exceptions import AuthorizationError, create_error_response


class OpenApiIntegrationGuardMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        logger.info("开放 API integration 凭证门禁已初始化")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self._should_guard(request):
            return await call_next(request)

        path = (request.url.path or "").split("?", 1)[0]
        if is_client_channel_guard_exempt_path(path):
            return await call_next(request)

        channel = resolve_request_client_channel(request)
        if channel is None:
            raw = request.headers.get(CLIENT_CHANNEL_HEADER) or request.headers.get(
                CLIENT_CHANNEL_HEADER.lower()
            )
            channel = normalize_client_channel(raw)
        if channel != "integration":
            return await call_next(request)

        auth = request.headers.get("Authorization") or ""
        token = ""
        if auth.lower().startswith("bearer "):
            token = auth[7:].strip()
        payload = OpenApiAuthService.parse_open_api_token(token) if token else None
        if not payload:
            security_signals.hit(
                "open_api_credential_reject",
                detail=f"{request.method} {path}",
            )
            exc = AuthorizationError(
                "integration 渠道必须使用开放 API Token（账套+应用秘钥换票）；"
                "普通用户登录 Token 不可用于对接写接口"
            )
            return JSONResponse(
                status_code=exc.status_code,
                content=create_error_response(exc, request_path=path),
            )

        # 预填 state，供限流 / 操作日志 / 后续依赖复用
        try:
            app_pk = int(payload.get("app_pk") or 0)
            request.state.jwt_payload = payload
            request.state.open_api_grants = list(payload.get("grants") or [])
            request.state.open_api_app_id = payload.get("app_id")
            request.state.open_api_acct_id = payload.get("acct_id")
            request.state.open_api_app_pk = app_pk
            tid = payload.get("tenant_id")
            request.state.tenant_id = int(tid) if tid is not None else None
            request.state.user_id = (
                virtual_user_id_for_app(app_pk)
                if app_pk
                else int(payload.get("sub") or 0)
            )
        except Exception:
            pass

        return await call_next(request)

    @staticmethod
    def _should_guard(request: Request) -> bool:
        try:
            from infra.config.infra_config import infra_settings

            if not bool(
                getattr(infra_settings, "OPEN_API_INTEGRATION_CREDENTIAL_REQUIRED", True)
            ):
                return False
        except Exception:
            pass

        if request.method not in WRITE_METHODS:
            return False
        path = request.url.path or ""
        if not path.startswith("/api/"):
            return False
        return True
