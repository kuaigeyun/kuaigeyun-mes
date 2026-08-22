"""写入请求敏感词拦截：扫 JSON / 表单 / 查询串，不扫 multipart 二进制。"""

from __future__ import annotations

import json
import re
from typing import Any, Callable, Optional
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
from infra.services.sensitive_word_blacklist_service import SensitiveWordBlacklistService
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


def _value_at_path(payload: Any, field_path: str) -> Optional[str]:
    if not field_path:
        return None
    current: Any = payload
    tokens = [part for part in re.split(r"\.|\[|\]", field_path) if part]
    for token in tokens:
        if isinstance(current, dict):
            current = current.get(token)
        elif isinstance(current, list):
            try:
                current = current[int(token)]
            except (ValueError, IndexError, TypeError):
                return None
        else:
            return None
    if isinstance(current, str):
        return current
    if current is None:
        return None
    return str(current)


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
        blacklist_service = SensitiveWordBlacklistService()

        hit = self._scan_query(request, service)
        if hit:
            if tenant_id is not None and await blacklist_service.is_tenant_word_allowlisted(tenant_id, hit[1]):
                return await call_next(request)
            return await self._reject(request, hit[0], hit[1], hit[2])

        content_type = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
        if content_type.startswith("multipart/form-data"):
            return await call_next(request)

        body = await request.body()
        if body:
            hit = self._scan_body(body, content_type, service)
            if hit:
                if tenant_id is not None and await blacklist_service.is_tenant_word_allowlisted(tenant_id, hit[1]):
                    async def receive():
                        return {"type": "http.request", "body": body, "more_body": False}

                    return await call_next(Request(request.scope, receive))
                return await self._reject(request, hit[0], hit[1], hit[2])

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
    def _scan_query(request: Request, service: SensitiveWordService) -> Optional[tuple[str, str, Optional[str]]]:
        for key, values in request.query_params.multi_items():
            payload = {key: values}
            found = service.find_in_payload(payload)
            if found:
                snippet = _value_at_path(payload, found[0])
                return found[0], found[1], snippet
        return None

    @staticmethod
    def _scan_body(
        body: bytes,
        content_type: str,
        service: SensitiveWordService,
    ) -> Optional[tuple[str, str, Optional[str]]]:
        if content_type == "application/json" or content_type.endswith("+json"):
            try:
                payload = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return None
            found = service.find_in_payload(payload)
            if found:
                return found[0], found[1], _value_at_path(payload, found[0])
            return None

        if content_type == "application/x-www-form-urlencoded":
            try:
                decoded = body.decode("utf-8")
            except UnicodeDecodeError:
                return None
            parsed = {key: values for key, values in parse_qs(decoded, keep_blank_values=True).items()}
            found = service.find_in_payload(parsed)
            if found:
                return found[0], found[1], _value_at_path(parsed, found[0])
            return None

        return None

    @staticmethod
    async def _reject(
        request: Request,
        field: str,
        matched: str,
        content_snippet: Optional[str] = None,
    ) -> JSONResponse:
        ip = get_client_ip(request)
        user_id = get_request_user_id(request)
        tenant_id = get_request_tenant_id(request)
        exc = await SensitiveWordIpGuardService.instance().build_validation_error(
            ip,
            field=field,
            matched=matched,
            user_id=user_id,
            tenant_id=tenant_id,
            request_path=request.url.path,
            content_snippet=content_snippet,
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
