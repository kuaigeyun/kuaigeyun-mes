"""写入请求敏感词拦截：扫 JSON / 表单 / 查询串，不扫 multipart 二进制。"""

from __future__ import annotations

import json
from typing import Callable, Optional
from urllib.parse import parse_qs

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.services.content.sensitive_word_ip_guard import (
    SensitiveWordIpGuardService,
    tenant_has_sensitive_word_control,
)
from core.services.content.sensitive_word_service import SensitiveWordService
from infra.exceptions.exceptions import create_error_response
from infra.utils.client_ip import get_client_ip
from infra.utils.request_identity import get_request_tenant_id, get_request_user_id

_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH"})
_EXCLUDED_PATHS = frozenset(
    {
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
        "/api/v1/auth/guest-login",
    }
)


class SensitiveWordMiddleware(BaseHTTPMiddleware):
    """对 /api/ 下的写入请求扫描用户可见字符串。"""

    def __init__(self, app):
        super().__init__(app)
        SensitiveWordService.instance()
        logger.info("敏感词中间件已初始化")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self._should_scan(request):
            return await call_next(request)

        tenant_id = get_request_tenant_id(request)
        if tenant_id is not None and not await tenant_has_sensitive_word_control(tenant_id):
            return await call_next(request)

        service = SensitiveWordService.instance()
        hit = self._scan_query(request, service)
        if hit:
            return await self._reject(request, hit[0], hit[1])

        content_type = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
        if content_type.startswith("multipart/form-data"):
            return await call_next(request)

        body = await request.body()
        if body:
            hit = self._scan_body(body, content_type, service)
            if hit:
                return await self._reject(request, hit[0], hit[1])

        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        return await call_next(Request(request.scope, receive))

    @staticmethod
    def _should_scan(request: Request) -> bool:
        if request.method not in _WRITE_METHODS:
            return False
        path = request.url.path
        if not path.startswith("/api/"):
            return False
        return path not in _EXCLUDED_PATHS

    @staticmethod
    def _scan_query(request: Request, service: SensitiveWordService) -> Optional[tuple[str, str]]:
        for key, values in request.query_params.multi_items():
            found = service.find_in_payload({key: values})
            if found:
                return found
        return None

    @staticmethod
    def _scan_body(
        body: bytes,
        content_type: str,
        service: SensitiveWordService,
    ) -> Optional[tuple[str, str]]:
        if content_type == "application/json" or content_type.endswith("+json"):
            try:
                payload = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return None
            return service.find_in_payload(payload)

        if content_type == "application/x-www-form-urlencoded":
            try:
                decoded = body.decode("utf-8")
            except UnicodeDecodeError:
                return None
            parsed = {key: values for key, values in parse_qs(decoded, keep_blank_values=True).items()}
            return service.find_in_payload(parsed)

        return None

    @staticmethod
    async def _reject(request: Request, field: str, matched: str) -> JSONResponse:
        ip = get_client_ip(request)
        user_id = get_request_user_id(request)
        exc = await SensitiveWordIpGuardService.instance().build_validation_error(
            ip,
            field=field,
            matched=matched,
            user_id=user_id,
        )
        logger.warning(
            "敏感词拦截 path={} ip={} user_id={} field={} matched={} strike={}",
            request.url.path,
            ip,
            user_id,
            field,
            matched,
            exc.details.get("strike_count"),
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=create_error_response(exception=exc, request_path=str(request.url.path)),
        )
