"""
ReDoc / OpenAPI 文档 HTTP Basic 认证

仅当环境变量同时配置用户名与密码时生效；未配置时保持原有可直接访问行为。
"""

from __future__ import annotations

import base64
import binascii
import secrets

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


def _is_protected_docs_path(path: str) -> bool:
    if path == "/openapi.json":
        return True
    if path == "/redoc" or path.startswith("/redoc/"):
        return True
    if path == "/docs" or path.startswith("/docs/"):
        return True
    return False


class DocsBasicAuthMiddleware(BaseHTTPMiddleware):
    """对交互式 API 文档路径要求 Basic Auth（由 infra_settings 开关控制）。"""

    async def dispatch(self, request: Request, call_next):
        from infra.config.infra_config import infra_settings

        if not infra_settings.docs_basic_auth_enabled:
            return await call_next(request)

        if request.scope.get("type") != "http":
            return await call_next(request)

        path = request.url.path
        if not _is_protected_docs_path(path):
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Basic "):
            return _docs_unauthorized()

        try:
            raw = base64.b64decode(auth_header[6:].strip(), validate=True)
            decoded = raw.decode("utf-8")
        except (UnicodeDecodeError, binascii.Error, ValueError):
            logger.debug("文档 Basic Auth：Authorization 解码失败 path={}", path)
            return _docs_unauthorized()

        username, sep, password = decoded.partition(":")
        if sep != ":":
            return _docs_unauthorized()

        expected_user = infra_settings.DOCS_BASIC_AUTH_USER.strip()
        expected_pass = infra_settings.DOCS_BASIC_AUTH_PASSWORD

        if not secrets.compare_digest(username, expected_user) or not secrets.compare_digest(
            password, expected_pass
        ):
            logger.debug("文档 Basic Auth：凭证错误 path={}", path)
            return _docs_unauthorized()

        return await call_next(request)


def _docs_unauthorized() -> Response:
    return Response(
        status_code=401,
        headers={"WWW-Authenticate": 'Basic realm="RiverEdge API Documentation"'},
        content="Authentication required",
        media_type="text/plain",
    )
