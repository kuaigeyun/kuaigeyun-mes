"""AI 请求审计中间件。"""

from __future__ import annotations

import time
from typing import Callable, Optional

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.models.ai_audit_log import AiAuditLog

_AI_PATH_PREFIX = "/api/v1/core/ai"
_LEGACY_AI_PATHS = (
    "/api/v1/core/site-settings/integrations/deepseek/completions",
)


class AiAuditMiddleware(BaseHTTPMiddleware):
    """记录 AI 网关请求的 tenant/user/route/latency。"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if not self._is_ai_path(path):
            return await call_next(request)

        started = time.perf_counter()
        response = await call_next(request)
        latency_ms = int((time.perf_counter() - started) * 1000)

        tenant_id, user_id = self._extract_identity(request)
        capability = self._parse_capability(path)
        await self._persist_audit(
            tenant_id=tenant_id,
            user_id=user_id,
            route=path,
            capability=capability,
            latency_ms=latency_ms,
            status_code=response.status_code,
        )
        return response

    @staticmethod
    def _is_ai_path(path: str) -> bool:
        if path.startswith(_AI_PATH_PREFIX):
            return True
        return path in _LEGACY_AI_PATHS

    @staticmethod
    def _parse_capability(path: str) -> Optional[str]:
        if "/chat/completions" in path:
            return "chat"
        if "/draft/structure" in path:
            return "draft"
        if "/agent/run" in path:
            return "agent"
        if "/jobs" in path:
            return "jobs"
        if "/status" in path:
            return "status"
        return None

    @staticmethod
    def _extract_identity(request: Request) -> tuple[Optional[int], Optional[int]]:
        tenant_raw = request.headers.get("X-Tenant-ID") or request.headers.get("x-tenant-id")
        tenant_id: Optional[int] = None
        if tenant_raw and str(tenant_raw).strip().isdigit():
            tenant_id = int(str(tenant_raw).strip())

        user_id: Optional[int] = None
        state = getattr(request, "state", None)
        if state is not None:
            user = getattr(state, "user", None)
            if user is not None and getattr(user, "id", None) is not None:
                user_id = int(user.id)
        return tenant_id, user_id

    @staticmethod
    async def _persist_audit(
        *,
        tenant_id: Optional[int],
        user_id: Optional[int],
        route: str,
        capability: Optional[str],
        latency_ms: int,
        status_code: int,
        model: Optional[str] = None,
        prompt_tokens: Optional[int] = None,
        completion_tokens: Optional[int] = None,
        error_message: Optional[str] = None,
    ) -> None:
        if tenant_id is None:
            return
        try:
            await AiAuditLog.create(
                tenant_id=tenant_id,
                user_id=user_id,
                route=route,
                capability=capability,
                model=model,
                latency_ms=latency_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                status_code=status_code,
                error_message=error_message,
            )
        except Exception as exc:
            logger.warning("AI 审计写入失败 route={} error={}", route, exc)
